import {useEffect,useState} from 'react';
import {checkModerator} from './moderation';
export default function useModerator(userId:string|null){
 const [state,setState]=useState<{owner:string|null;allowed:boolean;loading:boolean;error:string}>({owner:null,allowed:false,loading:false,error:''}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true,revision=0;const check=async(initial=false)=>{const version=++revision;if(!active)return;if(initial)setState({owner:userId,allowed:false,loading:!!userId,error:''});if(!userId)return;try{const allowed=await checkModerator();if(active&&version===revision)setState({owner:userId,allowed,loading:false,error:''});}catch(e){if(active&&version===revision)setState({owner:userId,allowed:false,loading:false,error:(e as Error).message});}};Promise.resolve().then(()=>check(true));const timer=userId?setInterval(()=>check(),30000):null;return()=>{active=false;if(timer)clearInterval(timer);};},[userId,attempt]);
 return {...(state.owner===userId?state:{owner:userId,allowed:false,loading:!!userId,error:''}),retry:()=>setAttempt(n=>n+1)};
}
