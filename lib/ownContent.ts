import {createClient,type SupabaseClient} from '@supabase/supabase-js';

export type ContentTarget={kind:'post'|'story';id:string};
export type ReviewDetails={place:string;category:string;text:string};
export type ContentConnection={url:string;key:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages:Record<string,string>={
 SIGN_IN_REQUIRED:'Tu sesión cambió o terminó. Vuelve a entrar a tu cuenta.',
 ACCOUNT_UNAVAILABLE:'Esta cuenta tiene una eliminación pendiente y no puede modificar publicaciones.',
 CONTENT_UNAVAILABLE:'Esta publicación ya no está disponible o pertenece a otra cuenta.',
 EDIT_BLOCKED:'Una publicación oculta por moderación no se puede editar.',
 EDIT_CONFLICT:'La reseña cambió en otra ventana. Vuelve a cargarla antes de guardar.',
 INVALID_DETAILS:'Escribe un lugar de 2 a 100 caracteres, una categoría válida y hasta 1500 caracteres de detalles.',
 STORAGE_REVIEW_REQUIRED:'El archivo requiere revisión. Contacta con soporte; no se ha iniciado su eliminación.',
 FILES_REMAIN:'Falta retirar el archivo. Reintenta la eliminación.',
 CONFIRMATION_REQUIRED:'Escribe ELIMINAR para confirmar.',
};
async function timed<T>(operation:(signal:AbortSignal)=>PromiseLike<T>):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{return await operation(controller.signal);}finally{clearTimeout(timer);}
}
export function contentError(error:{message?:string;code?:string}|null):Error{
 if(error?.code==='PGRST202')return new Error('La gestión de publicaciones aún no está habilitada.');
 const key=Object.keys(messages).find(key=>error?.message?.split(/[^A-Z_]+/).includes(key));
 return new Error(key?messages[key]:'No se pudo completar el cambio. Revisa tu conexión y reintenta.');
}
export function validateDetails(value:ReviewDetails):ReviewDetails{
 const place=value.place.trim();
 if(Array.from(place).length<2||Array.from(place).length>100||!['Comer','Divertirse','Explorar'].includes(value.category)||Array.from(value.text).length>1500)
  throw contentError({message:'INVALID_DETAILS'});
 return {...value,place};
}
function validateTarget(target:ContentTarget):void{
 if(!uuid.test(target.id)||!['post','story'].includes(target.kind))throw new Error('No se pudo verificar la publicación.');
}
export function validateContentFile(value:unknown,userId:string):string{
 if(typeof value!=='string'||!uuid.test(userId)||!value.startsWith(`${userId}/`)||value.split('/').length!==2||
  value.split('/').some(part=>!part||['.','..'].includes(part))||/[\\\u0000-\u001f]/.test(value))
  throw new Error('No se pudo verificar la propiedad del archivo.');
 return value;
}
async function fixedClient(client:SupabaseClient,userId:string,connection:ContentConnection):Promise<SupabaseClient>{
 const {data:{user},error}=await client.auth.getUser();
 const {data:{session}}=await client.auth.getSession();
 if(error||user?.id!==userId||session?.user.id!==userId)throw contentError({message:'SIGN_IN_REQUIRED'});
 // Account switches in another tab cannot change any credential mid-operation.
 return createClient(connection.url,connection.key,{global:{headers:{Authorization:`Bearer ${session.access_token}`},
  fetch:(input,init)=>timed(signal=>fetch(input,{...init,signal})),
 },auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function editOwnReview(client:SupabaseClient,userId:string,id:string,version:number,details:ReviewDetails,connection:ContentConnection):Promise<number>{
 validateTarget({kind:'post',id});const value=validateDetails(details);
 if(!Number.isSafeInteger(version)||version<0)throw new Error('Vuelve a cargar la reseña antes de editarla.');
 const fixed=await fixedClient(client,userId,connection);
 try{
  const {data,error}=await timed(signal=>fixed.rpc('edit_own_review',{p_id:id,p_version:version,p_place:value.place,p_category:value.category,p_description:value.text}).abortSignal(signal));
  if(error)throw contentError(error);
  if(data?.id!==id||data.version!==version+1)throw new Error('No se pudo confirmar el cambio. Vuelve a cargar la reseña.');
  return data.version;
 }finally{await fixed.auth.dispose();}
}
export async function pendingContent(client:SupabaseClient):Promise<ContentTarget[]>{
 const {data,error}=await timed(signal=>client.rpc('content_management',{p_action:'pending'}).abortSignal(signal));
 if(error)throw contentError(error);
 if(!Array.isArray(data?.items)||data.items.length>100)throw new Error('No se pudieron comprobar las eliminaciones pendientes.');
 return data.items.map((item:ContentTarget)=>{validateTarget(item);return {kind:item.kind,id:item.id};});
}
export async function deleteOwnContent(client:SupabaseClient,userId:string,target:ContentTarget,confirmation:string,connection:ContentConnection,onWithdrawn?:()=>void):Promise<void>{
 validateTarget(target);
 if(confirmation!=='ELIMINAR')throw contentError({message:'CONFIRMATION_REQUIRED'});
 const fixed=await fixedClient(client,userId,connection);
 const rpc=async(action:string)=>{
  const {data,error}=await timed(signal=>fixed.rpc('content_management',{p_action:action,p_kind:target.kind,p_id:target.id,p_confirmation:confirmation}).abortSignal(signal));
  if(error)throw contentError(error);return data;
 };
 try{
  const begun=await rpc('begin');
  if(begun?.deleted===true){onWithdrawn?.();return;}
  const path=validateContentFile(begun?.file,userId);
  const extras:string[]=Array.isArray(begun?.files)?begun.files.slice(0,10).map((file:unknown)=>validateContentFile(file,userId)):[];
  if(begun.pending!==true)throw new Error('No se pudo confirmar la eliminación.');
  onWithdrawn?.();
  const {error}=await fixed.storage.from('review-media').remove([path,...extras]);
  if(error)throw contentError(error);
  // SQL verifies actual Storage absence before committing cascades. A successful
  // HTTP delete alone is insufficient, and every step can safely be retried.
  const finished=await rpc('finish');
  if(finished?.deleted!==true)throw new Error('Falta confirmar la eliminación. Reintenta desde tu perfil.');
 }finally{await fixed.auth.dispose();}
}
