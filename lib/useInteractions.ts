import {useCallback,useEffect,useRef,useState} from 'react';
import {loadLibrary,loadStats,setInteraction,type PostStats} from './interactions';
import {loadPosts,type Review} from './posts';
import {softReactionFeedback} from './reactionFeedback';
export default function useInteractions(userId:string|null,postIds:string[],refreshKey:Review[]){
 const [library,setLibrary]=useState<{owner:string|null;liked:string[];saved:string[];tomatoed:string[];ready:boolean}>({owner:null,liked:[],saved:[],tomatoed:[],ready:false});
 const [stats,setStats]=useState<Record<string,PostStats>>({}),[savedPosts,setSavedPosts]=useState<Review[]>([]),[savedBusy,setSavedBusy]=useState(false);
 const [error,setError]=useState(''),[statsError,setStatsError]=useState(''),[savedError,setSavedError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[statsAttempt,setStatsAttempt]=useState(0);
 const epoch=useRef(0),statsEpoch=useRef(0),lock=useRef(false);
 const idsKey=[...new Set([...postIds,...(library.owner===userId?library.saved:[])])].sort().join(',');
 const owned=library.owner===userId?library:{owner:userId,liked:[],saved:[],tomatoed:[],ready:false};
 const savedKey=owned.saved.join(',');
 const refreshCounts=useCallback(()=>setStatsAttempt(n=>n+1),[]);
 const retry=useCallback(()=>setAttempt(n=>n+1),[]);
 useEffect(()=>{let active=true;const controller=new AbortController();epoch.current++;lock.current=false;Promise.resolve().then(()=>{if(active){setBusy(false);setError('');setLibrary({owner:userId,liked:[],saved:[],tomatoed:[],ready:!userId});}});
  if(!userId)return()=>{active=false;};
  const timeout=setTimeout(()=>controller.abort(),15000);
  loadLibrary(userId,controller.signal).then(rows=>{if(active)setLibrary({owner:userId,...rows,ready:true});}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[userId,attempt]);
 useEffect(()=>{let active=true;const version=++statsEpoch.current;const controller=new AbortController();Promise.resolve().then(()=>{if(active)setStatsError('');});const timeout=setTimeout(()=>controller.abort(),15000);
  loadStats(idsKey?idsKey.split(','):[],controller.signal).then(rows=>{if(active&&version===statsEpoch.current)setStats(rows);}).catch(e=>{if(active&&version===statsEpoch.current)setStatsError(e.message);});
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[idsKey,attempt,statsAttempt,refreshKey]);
 useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(active){setSavedPosts([]);setSavedError('');setSavedBusy(!!userId&&!!savedKey);}});if(!userId||!savedKey)return()=>{active=false;};
  loadPosts({postIds:savedKey.split(',')}).then(rows=>{if(active)setSavedPosts(rows);}).catch(e=>{if(active)setSavedError(e.message);}).finally(()=>{if(active)setSavedBusy(false);});
  return()=>{active=false;};
 },[userId,savedKey,attempt,refreshKey]);
 const change=async(postId:string,kind:'like'|'tomato'|'save',cloud:boolean)=>{
  if(lock.current)return;setError('');
  if(!userId){setError('Inicia sesión desde Perfil para dar me gusta o guardar.');return;}
  if(!cloud){setError('Las maquetas no admiten interacciones. Elige una publicación real.');return;}
  if(!owned.ready){setError('Primero pulsa Reintentar para cargar tus interacciones.');return;}
  const version=epoch.current;lock.current=true;setBusy(true);
  const enabled=!(kind==='like'?owned.liked:kind==='tomato'?owned.tomatoed:owned.saved).includes(postId);
  try{await setInteraction(userId,postId,kind,enabled);
   if(version!==epoch.current)return;
   if(enabled&&(kind==='like'||kind==='tomato'))void softReactionFeedback();
   setLibrary(p=>{if(p.owner!==userId)return p;const field=kind==='like'?'liked':kind==='tomato'?'tomatoed':'saved';const next={...p,[field]:enabled?[...new Set([...p[field],postId])]:p[field].filter(id=>id!==postId)};if(enabled&&kind==='like')next.tomatoed=next.tomatoed.filter(id=>id!==postId);if(enabled&&kind==='tomato')next.liked=next.liked.filter(id=>id!==postId);return next;});
   const statVersion=++statsEpoch.current;const rows=await loadStats(idsKey?idsKey.split(','):[postId]);if(version===epoch.current&&statVersion===statsEpoch.current)setStats(rows);
  }catch(e){if(version===epoch.current)setError(e instanceof Error?e.message:'No se pudo guardar.');}
  finally{if(version===epoch.current){lock.current=false;setBusy(false);}}
 };
 return {saved:owned.saved,liked:owned.liked,tomatoed:owned.tomatoed,stats,savedPosts:userId&&library.owner===userId?savedPosts.filter(p=>owned.saved.includes(p.id)):[],savedBusy,savedError,error:error||statsError,busy,ready:owned.ready,retry,refreshCounts,change};
}
