import {useCallback,useEffect,useRef,useState} from 'react';
import {loadNotifications,markNotificationsRead,type Notification} from './notifications';
export default function useNotifications(userId:string|null){
 const [state,setState]=useState<{owner:string|null;rows:Notification[];unread:number;loading:boolean;error:string}>({owner:null,rows:[],unread:0,loading:false,error:''});
 const [busy,setBusy]=useState(false);const generation=useRef(0),mutationGeneration=useRef(0),lock=useRef(false);
 const refresh=useCallback(async()=>{const version=++generation.current;
  if(!userId){setState({owner:null,rows:[],unread:0,loading:false,error:''});return;}
  setState(p=>({owner:userId,rows:p.owner===userId?p.rows:[],unread:p.owner===userId?p.unread:0,loading:true,error:''}));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const data=await loadNotifications(userId,controller.signal);if(version===generation.current)setState({owner:userId,...data,loading:false,error:''});}
  catch(e){if(version===generation.current)setState(p=>({...p,loading:false,error:e instanceof Error?e.message:'No se pudieron cargar los avisos.'}));}
  finally{clearTimeout(timer);}
 },[userId]);
 useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(active){lock.current=false;setBusy(false);refresh();}});const timer=userId?setInterval(refresh,30000):null;
  return()=>{active=false;generation.current++;mutationGeneration.current++;if(timer)clearInterval(timer);};
 },[refresh,userId]);
 const mark=async(id?:string)=>{if(!userId||lock.current)return false;lock.current=true;setBusy(true);
  const version=mutationGeneration.current;
  try{await markNotificationsRead(userId,id);if(version!==mutationGeneration.current)return false;await refresh();return true;}
  catch(e){if(version===mutationGeneration.current)setState(p=>({...p,error:e instanceof Error?e.message:'No se pudo marcar como leído.'}));return false;}
  finally{if(version===mutationGeneration.current){lock.current=false;setBusy(false);}}
 };
 const current=state.owner===userId?state:{owner:userId,rows:[],unread:0,loading:!!userId,error:''};
 return {...current,busy,refresh,mark};
}
