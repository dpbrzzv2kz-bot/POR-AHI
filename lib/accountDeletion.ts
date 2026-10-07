import {createClient,type SupabaseClient} from '@supabase/supabase-js';

export const DELETE_CONFIRMATION='ELIMINAR';
export type DeletionProgress='starting'|'files'|'account';
const messages:Record<string,string>={
 SIGN_IN_REQUIRED:'Cierra sesión y vuelve a entrar a la cuenta que quieres eliminar.',
 RECENT_SIGN_IN_REQUIRED:'Por seguridad, cierra sesión y vuelve a entrar. Después regresa a Eliminar cuenta dentro de 10 minutos.',
 LAST_MODERATOR:'Esta cuenta es la última administradora. Primero hay que asignar otra persona administradora; contacta con soporte.',
 STORAGE_REVIEW_REQUIRED:'Hay archivos que requieren revisión. Contacta con soporte; no se ha iniciado el borrado de archivos.',
 FILES_REMAIN:'Todavía hay archivos pendientes. Pulsa Reintentar eliminación para continuar.',
 DELETION_NOT_STARTED:'Vuelve a abrir Eliminar cuenta y confirma el proceso.',
 CONFIRMATION_REQUIRED:'Escribe ELIMINAR para confirmar.',
};
type BackendError={message?:string;code?:string}|null;
async function timed<T>(operation:(signal:AbortSignal)=>PromiseLike<T>):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{return await operation(controller.signal);}finally{clearTimeout(timer);}
}
export function deletionError(error:BackendError):Error{
 if(error?.code==='PGRST202')return new Error('La eliminación aún no está habilitada. Contacta con soporte.');
 const key=Object.keys(messages).find(key=>error?.message?.split(/[^A-Z_]+/).includes(key));
 return new Error(key?messages[key]:'No se pudo completar la eliminación. Revisa tu conexión y pulsa Reintentar eliminación. Los archivos retirados no se pueden recuperar.');
}
export function validateDeletionFiles(value:unknown,userId:string):string[]{
 if(!Array.isArray(value)||value.length>100)throw new Error('No se pudo verificar la lista de archivos. Contacta con soporte.');
 const prefix=`${userId}/`;
 if(value.some(path=>typeof path!=='string'||!path.startsWith(prefix)||path===prefix||path.split('/').some(part=>['.','..',''].includes(part))))
  throw new Error('No se pudo verificar la propiedad de los archivos. Contacta con soporte.');
 return [...new Set(value)];
}
export async function deletionPending(client:SupabaseClient):Promise<boolean>{
 const {data,error}=await timed(signal=>client.rpc('account_deletion',{p_action:'status'}).abortSignal(signal));
 if(error)throw deletionError(error);
 if(typeof data?.pending!=='boolean')throw new Error('No se pudo consultar el estado de la cuenta.');
 return data.pending;
}
export async function deleteOwnAccount(client:SupabaseClient,userId:string,confirmation:string,connection:{url:string;key:string},onProgress?:(stage:DeletionProgress)=>void):Promise<void>{
 if(confirmation!==DELETE_CONFIRMATION)throw deletionError({message:'CONFIRMATION_REQUIRED'});
 // Do not trust a remembered profile: verify the current Auth user before touching files.
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||user?.id!==userId)throw deletionError({message:'SIGN_IN_REQUIRED'});
 const {data:{session}}=await client.auth.getSession();
 if(!session||session.user.id!==userId)throw deletionError({message:'SIGN_IN_REQUIRED'});
 // Pin credentials for the WHOLE operation. A sign-in in another tab must never
 // change the subject of an in-progress destructive RPC or a Storage request.
 const fixed=createClient(connection.url,connection.key,{global:{
  headers:{Authorization:`Bearer ${session.access_token}`},
  fetch:(input,init)=>timed(signal=>fetch(input,{...init,signal})),
 },auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const rpc=async(action:string)=>{
  const {data,error}=await timed(signal=>fixed.rpc('account_deletion',{p_action:action,p_confirmation:confirmation}).abortSignal(signal));
  if(error)throw deletionError(error);return data;
 };
 onProgress?.('starting');await rpc('begin');onProgress?.('files');
 // Always fetch the first remaining batch. Never use offsets while deleting rows.
 // Bound work; a network failure keeps the account frozen and the next attempt resumes.
 let previous='';
 for(let batch=0;batch<1000;batch++){
  const remaining=await rpc('files'),paths=validateDeletionFiles(remaining?.files,userId);
  if(!paths.length){
   onProgress?.('account');const result=await rpc('finish');
   if(result?.deleted!==true)throw new Error('No se pudo confirmar la eliminación. Contacta con soporte.');
   // Clearing local credentials must not rely on a network logout after Auth was deleted.
   const current=await client.auth.getSession();
   if(current.data.session?.user.id===userId)await client.auth.signOut({scope:'local'});
   return;
  }
  const fingerprint=JSON.stringify(paths);
  if(fingerprint===previous)throw new Error('No se pudieron retirar los archivos pendientes. Contacta con soporte.');
  previous=fingerprint;
  const {error}=await fixed.storage.from('review-media').remove(paths);
  if(error)throw deletionError(error);
 }
 throw new Error('Quedan archivos pendientes. Pulsa Reintentar eliminación para continuar.');
}
