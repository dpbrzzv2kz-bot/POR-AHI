import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import {searchReviews,type ReviewCategory,type ReviewFormat} from './discovery';
import type {Review} from './posts';

type Results={key:string;reviews:Review[];nextOffset:number|null;loading:boolean;error:string};
export default function useDiscovery(userId:string|null,version:number,enabled:boolean,category:ReviewCategory='Todas'){
 const [query,setQuery]=useState(''),[format,setFormat]=useState<ReviewFormat>('Todos');
 const [page,setPage]=useState({key:'',offset:0}),[attempt,setAttempt]=useState(0);
 const [results,setResults]=useState<Results>({key:'',reviews:[],nextOffset:null,loading:false,error:''});
 const key=JSON.stringify([query,category,format,userId,version,enabled]);
 const offset=page.key===key?page.offset:0;
 useEffect(()=>{
  if(!enabled){
   let active=true;
   Promise.resolve().then(()=>{if(active){setPage({key:'',offset:0});setResults({key:'',reviews:[],nextOffset:null,loading:false,error:''});}});
   return()=>{active=false;};
  }
  let active=true;const controller=new AbortController();let deadline:ReturnType<typeof setTimeout>|undefined;
  Promise.resolve().then(()=>{if(active)setResults(previous=>({key,reviews:offset&&previous.key===key?previous.reviews:[],nextOffset:offset||null,loading:true,error:''}));});
  const timer=setTimeout(async()=>{
   deadline=setTimeout(()=>controller.abort(),15000);
   try{
    if(!supabase)throw new Error('La conexión todavía no está configurada.');
    const found=await searchReviews(supabase,{query,category,format},offset,controller.signal);
    if(active)setResults(previous=>({key,reviews:[...new Map([...(offset&&previous.key===key?previous.reviews:[]),...found.reviews].map(r=>[r.id,r])).values()],nextOffset:found.nextOffset,loading:false,error:''}));
   }catch(e){if(active)setResults(previous=>({...previous,key,loading:false,error:e instanceof Error?e.message:'No se pudo completar la búsqueda.'}));}
   finally{clearTimeout(deadline);}
  },offset?0:400);
  return()=>{active=false;clearTimeout(timer);clearTimeout(deadline);controller.abort();};
 },[key,query,category,format,offset,attempt,enabled]);
 const current=enabled&&results.key===key?results:{key,reviews:[],nextOffset:null,loading:enabled,error:''};
 return {...current,query,setQuery,category,format,setFormat,retry:()=>setAttempt(n=>n+1),more:()=>{if(!current.loading&&!current.error&&current.nextOffset!==null)setPage({key,offset:current.nextOffset});}};
}
