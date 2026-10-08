import {supabase} from './supabase';
export type PostStats={likes:number;comments:number;tomatoes:number};
export type Comment={id:string;user_id:string;author_name:string;body:string;created_at:string;parent_id:string|null};
export async function loadLibrary(userId:string,signal?:AbortSignal){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 let likes=supabase.from('post_likes').select('post_id').eq('user_id',userId);
 let saves=supabase.from('bookmarks').select('post_id').eq('user_id',userId).order('created_at',{ascending:false});
 let tomatoes=supabase.from('post_tomatoes').select('post_id').eq('user_id',userId);
 if(signal){likes=likes.abortSignal(signal);saves=saves.abortSignal(signal);tomatoes=tomatoes.abortSignal(signal);}
 const [a,b,c]=await Promise.all([likes,saves,tomatoes]);
 if(a.error||b.error||c.error)throw new Error('No se pudieron cargar tus me gusta y guardados. Pulsa Reintentar.');
 return {liked:(a.data||[]).map(r=>r.post_id),saved:(b.data||[]).map(r=>r.post_id),tomatoed:(c.data||[]).map(r=>r.post_id)};
}
export async function loadStats(ids:string[],signal?:AbortSignal):Promise<Record<string,PostStats>>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 if(!ids.length)return {};
 let request=supabase.from('post_stats').select('post_id,likes_count,comments_count,tomatoes_count').in('post_id',ids);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw new Error('No se pudieron cargar los contadores. Pulsa Actualizar publicaciones.');
 return Object.fromEntries((data||[]).map(r=>[r.post_id,{likes:Number(r.likes_count),comments:Number(r.comments_count),tomatoes:Number(r.tomatoes_count)}]));
}
export async function setInteraction(userId:string,postId:string,kind:'like'|'tomato'|'save',enabled:boolean){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const table=kind==='like'?'post_likes':kind==='tomato'?'post_tomatoes':'bookmarks';
 const {error}=enabled?await supabase.from(table).upsert({user_id:userId,post_id:postId},{onConflict:'user_id,post_id',ignoreDuplicates:true}):await supabase.from(table).delete().eq('user_id',userId).eq('post_id',postId);
 if(error)throw new Error('No se pudo guardar el cambio. Comprueba tu sesión y vuelve a intentar.');
}
export async function loadComments(postId:string,signal?:AbortSignal):Promise<Comment[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 let request=supabase.from('comments').select('id,user_id,author_name,body,created_at,parent_id').eq('post_id',postId).is('deleted_at',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(200);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw new Error('No se pudieron cargar los comentarios. Vuelve a intentar.');
 return (data||[]).reverse();
}
export async function addComment(userId:string,postId:string,body:string,id:string,parentId?:string|null){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const text=body.trim();if(!text||text.length>1000)throw new Error('Escribe un comentario de 1 a 1000 caracteres.');
 const {error}=await supabase.from('comments').upsert({id,user_id:userId,post_id:postId,author_name:'',body:text,parent_id:parentId||null},{onConflict:'id',ignoreDuplicates:true});
 if(error)throw new Error('No se pudo publicar. Guarda tu nombre y @usuario en Perfil y vuelve a intentar.');
}
export async function removeComment(userId:string,id:string,restore=false){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const {data,error}=await supabase.from('comments').update({deleted_at:restore?null:new Date().toISOString()}).eq('id',id).eq('user_id',userId).select('id');
 if(error||!data?.length)throw new Error('No se pudo cambiar el comentario. Vuelve a intentar.');
}
export function commentId(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3)|8).toString(16);});}

// Total de corazones y tomates que han recibido las publicaciones de una persona (suma los contadores públicos de cada una).
export async function loadReceivedReactions(userId:string,signal?:AbortSignal):Promise<{likes:number;tomatoes:number}>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 let request=supabase.from('posts').select('id').eq('user_id',userId).limit(300);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw new Error('No se pudieron cargar las reacciones.');
 const ids=(data||[]).map(row=>row.id as string);
 let likes=0,tomatoes=0;
 for(let start=0;start<ids.length;start+=50){
  const stats=await loadStats(ids.slice(start,start+50),signal);
  for(const stat of Object.values(stats)){likes+=stat.likes;tomatoes+=stat.tomatoes;}
 }
 return {likes,tomatoes};
}

// Reacciones a comentarios (corazón o tomate): contadores públicos y la reacción propia de cada comentario.
export type CommentReaction='heart'|'tomato';
export type CommentStats={hearts:number;tomatoes:number};
export async function loadCommentReactions(userId:string,ids:string[],signal?:AbortSignal):Promise<{stats:Record<string,CommentStats>;mine:Record<string,CommentReaction>}>{
 const stats:Record<string,CommentStats>={},mine:Record<string,CommentReaction>={};
 if(!supabase||!ids.length)return {stats,mine};
 try{
  for(let start=0;start<ids.length;start+=100){
   const chunk=ids.slice(start,start+100);
   let counts=supabase.from('comment_stats').select('comment_id,hearts_count,tomatoes_count').in('comment_id',chunk);
   let own=supabase.from('comment_reactions').select('comment_id,kind').eq('user_id',userId).in('comment_id',chunk);
   if(signal){counts=counts.abortSignal(signal);own=own.abortSignal(signal);}
   const [a,b]=await Promise.all([counts,own]);
   if(a.error||b.error)throw new Error('reacciones');
   for(const row of a.data||[])stats[row.comment_id]={hearts:Number(row.hearts_count),tomatoes:Number(row.tomatoes_count)};
   for(const row of b.data||[])mine[row.comment_id]=row.kind as CommentReaction;
  }
 }catch{/* Sin reacciones los comentarios se siguen viendo. */}
 return {stats,mine};
}
export async function setCommentReaction(userId:string,commentId:string,kind:CommentReaction|null,previous?:CommentReaction){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const fail=()=>new Error('No se pudo guardar tu reacción. Intenta de nuevo.');
 // upsert intentaría reescribir user_id y comment_id, y solo se permite cambiar kind: se inserta o se actualiza kind por separado.
 const change=async()=>{const {data,error}=await supabase!.from('comment_reactions').update({kind}).eq('user_id',userId).eq('comment_id',commentId).select('comment_id');if(error||!data?.length)throw fail();};
 if(kind===null){const {error}=await supabase.from('comment_reactions').delete().eq('user_id',userId).eq('comment_id',commentId);if(error)throw fail();return;}
 if(previous){await change();return;}
 const {error}=await supabase.from('comment_reactions').insert({user_id:userId,comment_id:commentId,kind});
 if(!error)return;
 if(error.code==='23505'){await change();return;} // ya existía (estado desactualizado): solo se cambia el tipo
 throw fail();
}
