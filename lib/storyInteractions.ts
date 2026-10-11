import {supabase} from './supabase';

// Encuestas y preguntas de las stories (migración 026). Los votos se guardan por persona; los totales llegan ya contados.
export type PollSnapshot={counts:Record<string,number[]>;mine:Record<string,number>};
export type StoryAnswer={id:string;overlayId:string;userId:string;answer:string;createdAt:string};

export async function loadPollSnapshot(storyId:string,userId:string|null,signal?:AbortSignal):Promise<PollSnapshot>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const counts:Record<string,number[]>={},mine:Record<string,number>={};
 const totals=await supabase.rpc('story_poll_counts',{p_story:storyId});
 if(totals.error)throw new Error('No se pudieron cargar los votos.');
 for(const row of (totals.data||[]) as {overlay_id:string;choice:number;votes:number|string}[]){
  const list=counts[row.overlay_id]||[0,0];
  if(row.choice===0||row.choice===1)list[row.choice]=Number(row.votes)||0;
  counts[row.overlay_id]=list;
 }
 if(userId){
  let request=supabase.from('story_poll_votes').select('overlay_id,choice').eq('story_id',storyId).eq('user_id',userId);
  if(signal)request=request.abortSignal(signal);
  const own=await request;
  if(own.error)throw new Error('No se pudo cargar tu voto.');
  for(const row of own.data||[])mine[row.overlay_id]=row.choice;
 }
 return {counts,mine};
}
export async function votePoll(storyId:string,overlayId:string,choice:number){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 if(choice!==0&&choice!==1)throw new Error('Respuesta no válida.');
 const {error}=await supabase.from('story_poll_votes').insert({story_id:storyId,overlay_id:overlayId,choice});
 if(error&&error.code!=='23505')throw new Error('No se pudo guardar tu voto. Intenta de nuevo.');
}
export async function submitAnswer(storyId:string,overlayId:string,answer:string){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const clean=answer.trim().slice(0,200);
 if(!clean)throw new Error('Escribe tu respuesta.');
 const {error}=await supabase.from('story_answers').insert({story_id:storyId,overlay_id:overlayId,answer:clean});
 if(error)throw new Error(error.code==='23505'?'Ya respondiste esta pregunta.':'No se pudo enviar tu respuesta. Intenta de nuevo.');
}
export async function loadNames(ids:string[]):Promise<Record<string,string>>{
 if(!supabase||!ids.length)return {};
 const {data}=await supabase.from('public_profiles').select('id,display_name,username').in('id',[...new Set(ids)].slice(0,60));
 return Object.fromEntries((data||[]).map(row=>[row.id,row.display_name+' (@'+row.username+')']));
}
export async function loadAnswers(storyId:string):Promise<StoryAnswer[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const {data,error}=await supabase.from('story_answers').select('id,overlay_id,user_id,answer,created_at').eq('story_id',storyId).order('created_at',{ascending:false}).limit(200);
 if(error)throw new Error('No se pudieron cargar las respuestas.');
 return (data||[]).map(row=>({id:row.id,overlayId:row.overlay_id,userId:row.user_id,answer:row.answer,createdAt:row.created_at}));
}
