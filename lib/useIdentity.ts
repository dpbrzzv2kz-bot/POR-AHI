import {useEffect,useState} from 'react';
import {supabase} from './supabase';
export default function useIdentity(){
 const [state,setState]=useState<{id:string|null;ready:boolean}>({id:null,ready:false});
 useEffect(()=>{let active=true;let revision=0;if(!supabase){Promise.resolve().then(()=>{if(active)setState({id:null,ready:true});});return()=>{active=false;};}
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{revision++;if(active)setState({id:session?.user.id||null,ready:true});});
 const started=revision;supabase.auth.getSession().then(({data})=>{if(active&&started===revision)setState({id:data.session?.user.id||null,ready:true});});
 return()=>{active=false;subscription.unsubscribe();};},[]);
 return state;
}
