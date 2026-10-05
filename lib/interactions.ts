import {supabase} from './supabase';
export type PostStats={likes:number;comments:number};
export type Comment={id:string;user_id:string;author_name:string;body:string;created_at:string};
export async function loadLibrary(userId:string,signal?:AbortSignal){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 let likes=supabase.from('post_likes').select('post_id').eq('user_id',userId);
 let saves=supabase.from('bookmarks').select('post_id').eq('user_id',userId).order('created_at',{ascending:false});
 if(signal){likes=likes.abortSignal(signal);saves=saves.abortSignal(signal);}
 const [a,b]=await Promise.all([likes,saves]);
 if(a.error||b.error)throw new Error('No se pudieron cargar tus me gusta y guardados. Pulsa Reintentar.');
 return {liked:(a.data||[]).map(r=>r.post_id),saved:(b.data||[]).map(r=>r.post_id)};
}
export async function loadStats(ids:string[],signal?:AbortSignal):Promise<Record<string,PostStats>>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 if(!ids.length)return {};
 let request=supabase.from('post_stats').select('post_id,likes_count,comments_count').in('post_id',ids);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw new Error('No se pudieron cargar los contadores. Pulsa Actualizar publicaciones.');
 return Object.fromEntries((data||[]).map(r=>[r.post_id,{likes:Number(r.likes_count),comments:Number(r.comments_count)}]));
}
export async function setInteraction(userId:string,postId:string,kind:'like'|'save',enabled:boolean){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const table=kind==='like'?'post_likes':'bookmarks';
 const {error}=enabled?await supabase.from(table).upsert({user_id:userId,post_id:postId},{onConflict:'user_id,post_id',ignoreDuplicates:true}):await supabase.from(table).delete().eq('user_id',userId).eq('post_id',postId);
 if(error)throw new Error('No se pudo guardar el cambio. Comprueba tu sesión y vuelve a intentar.');
}
export async function loadComments(postId:string,signal?:AbortSignal):Promise<Comment[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 let request=supabase.from('comments').select('id,user_id,author_name,body,created_at').eq('post_id',postId).is('deleted_at',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw new Error('No se pudieron cargar los comentarios. Vuelve a intentar.');
 return (data||[]).reverse();
}
export async function addComment(userId:string,postId:string,body:string,id:string){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const text=body.trim();if(!text||text.length>1000)throw new Error('Escribe un comentario de 1 a 1000 caracteres.');
 const {error}=await supabase.from('comments').upsert({id,user_id:userId,post_id:postId,author_name:'',body:text},{onConflict:'id',ignoreDuplicates:true});
 if(error)throw new Error('No se pudo publicar. Guarda tu nombre y @usuario en Perfil y vuelve a intentar.');
}
export async function removeComment(userId:string,id:string,restore=false){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const {data,error}=await supabase.from('comments').update({deleted_at:restore?null:new Date().toISOString()}).eq('id',id).eq('user_id',userId).select('id');
 if(error||!data?.length)throw new Error('No se pudo cambiar el comentario. Vuelve a intentar.');
}
export function commentId(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3)|8).toString(16);});}
