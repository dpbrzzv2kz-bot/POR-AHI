import {useEffect,useState} from 'react';
import {loadPosts,type Review} from './posts';
import {sharedReviewId} from './reviewSharing';
type Result={key:string;review:Review|null;error:string;loading:boolean};
export default function useSharedReview(value:unknown,userId:string|null,version:number){
 const id=sharedReviewId(value),requested=value!==undefined;
 const [attempt,setAttempt]=useState(0),[result,setResult]=useState<Result|null>(null);
 const key=JSON.stringify([id,userId,version,attempt]);
 useEffect(()=>{
  if(!requested||!id)return;
  let active=true;const controller=new AbortController();
  const timer=setTimeout(()=>{controller.abort();if(active)setResult({key,review:null,error:'La conexión tardó demasiado. Pulsa Reintentar reseña.',loading:false});},15000);
  loadPosts({postIds:[id]},controller.signal).then(rows=>{
   if(active&&!controller.signal.aborted)setResult({key,review:rows[0]||null,error:rows.length?'':'Esta reseña ya no está disponible.',loading:false});
  }).catch(()=>{
   if(active&&!controller.signal.aborted)setResult({key,review:null,error:'No se pudo abrir la reseña. Revisa tu conexión y reintenta.',loading:false});
  }).finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[requested,id,key]);
 const current=result?.key===key?result:null;
 return {requested,valid:!!id,review:id?current?.review||null:null,loading:requested&&!!id&&!current,
  error:requested&&!id?'El enlace de esta reseña no es válido.':current?.error||'',retry:()=>setAttempt(n=>n+1)};
}
