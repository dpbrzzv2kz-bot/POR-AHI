import {supabase} from './supabase';
import {prepareMedia, mediaSource, mediaExtension} from './media';
import {uploadInChunks, checkSignal, waitForOperation, type UploadProgress} from './resumable';
import {hydrateReviews} from './reviewMedia';

export type Media={uri:string;type:'image'|'video';mimeType?:string;fileName?:string;file?:File;size?:number;duration?:number};
export type Review={id:string;category:string;place:string;text:string;author:string;color:string;symbol:string;media?:Media;kind?:'image'|'video';userId?:string;near?:boolean;cloud?:boolean;version?:number;createdAt?:string;items?:Media[];isShort?:boolean;address?:string;rating?:number};
export type Story={id:string;userId:string;name:string;expires:number;media?:Media;color:string};
const bucket='review-media';
type PublishOptions={signal?:AbortSignal;progress?:(value:UploadProgress)=>void};
export async function loadPosts(filter?:{userId?:string;userIds?:string[];postIds?:string[];shorts?:boolean},signal?:AbortSignal):Promise<Review[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 if(filter?.userIds&&!filter.userIds.length)return [];
 if(filter?.postIds&&!filter.postIds.length)return [];
 let request=supabase.from('posts').select('id,user_id,author_name,category,place,description,kind,media_path,edit_version,created_at,is_short,address,rating').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
 if(filter?.shorts!==undefined)request=request.eq('is_short',filter.shorts);
 if(filter?.userId)request=request.eq('user_id',filter.userId);
 if(filter?.userIds)request=request.in('user_id',filter.userIds);
 if(filter?.postIds)request=request.in('id',filter.postIds);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw new Error('No se pudieron cargar las publicaciones. Pulsa Actualizar.');
 return hydrateReviews(supabase,data||[],signal);
}
export async function loadStories():Promise<Story[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const {data,error}=await supabase.from('stories').select('id,user_id,author_name,kind,media_path,expires_at').order('created_at',{ascending:false}).limit(60);
 if(error)throw new Error('No se pudieron cargar las stories. Pulsa Actualizar publicaciones.');
 const groups=new Map<number,typeof data>();
 for(const row of data||[]){const remaining=Math.floor((Date.parse(row.expires_at)-Date.now())/1000);if(remaining<1)continue;const ttl=Math.min(3600,remaining);const rows=groups.get(ttl)||[];rows.push(row);groups.set(ttl,rows);}
 const result=await Promise.all([...groups].map(async([ttl,rows])=>{
  const signed=await supabase!.storage.from(bucket).createSignedUrls(rows!.map(r=>r.media_path),ttl);
  if(signed.error)throw new Error('No se pudieron cargar los archivos de las stories. Pulsa Actualizar publicaciones.');
  const urls=new Map(signed.data?.map(r=>[r.path,r.signedUrl]));
  return rows!.flatMap(row=>{const uri=urls.get(row.media_path);if(!uri)return [];return [{id:row.id,userId:row.user_id,name:row.author_name,expires:Date.parse(row.expires_at),media:{uri,type:row.kind} as Media,color:'#596e59'}];});
 }));
 return result.flat();
}
export async function publishPost(media:Media,place:string,category:string,text:string,pathToken:string,options:PublishOptions={},location?:{lat:number;lng:number;address?:string}|null,extras:Media[]=[],isShort=false,rating=0){
 const fields={category,place:place.trim(),description:text.trim(),...(location?{lat:location.lat,lng:location.lng,...(location.address?{address:location.address.slice(0,300)}:{})}:{}),...(isShort?{is_short:true}:rating>=1&&rating<=5?{rating}:{})};
 if(extras.length>9)throw new Error('Una publicación puede tener hasta 10 fotos o videos.');
 if(extras.length&&!isShort)return publishPostMany([media,...extras],pathToken,fields,options);
 return publishVisual(media,pathToken,'posts',fields,options);
}
export async function publishStory(media:Media,pathToken:string,options:PublishOptions={}){
 return publishVisual(media,pathToken,'stories',{},options);
}
async function publishVisual(media:Media,pathToken:string,table:'posts'|'stories',fields:Record<string,string|number|boolean>,options:PublishOptions){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 checkSignal(options.signal);
 options.progress?.({phase:'preparing',sent:0,total:media.size||0});
 const {data:{user},error:authError}=await waitForOperation(supabase.auth.getUser(),options.signal);
 if(authError||!user)throw new Error('Inicia sesión desde Perfil antes de publicar.');
 const {data:profile,error:profileError}=await waitForOperation(supabase.from('profiles').select('display_name,username').eq('id',user.id).maybeSingle(),options.signal);
 if(profileError||!profile?.username||!profile.display_name)throw new Error('Guarda tu nombre y @usuario en Perfil antes de publicar.');
 const prepared=await waitForOperation(prepareMedia(media),options.signal),mime=prepared.mimeType!,size=prepared.size!;
 checkSignal(options.signal);
 const path=`${user.id}/${table}-${pathToken}.${mediaExtension(mime)}`;
 // A retry reuses the path so a lost response does not create duplicate posts.
 const existing=await waitForOperation(supabase.from(table).select('id').eq('media_path',path).maybeSingle(),options.signal);
 if(existing.error)throw new Error('No hay conexión con las publicaciones. Intenta de nuevo.');
 if(existing.data)return;
 const storage=supabase.storage.from(bucket);
 // If upload completion succeeded but its response was lost, skip re-uploading the immutable object.
 const completed=await waitForOperation(storage.info(path),options.signal);
 if(completed.error&&completed.error.status!==404&&completed.error.statusCode!=='404'&&!['NoSuchKey','not_found'].includes(completed.error.statusCode||''))
  throw new Error('No se pudo comprobar la carga. Revisa tu conexión y reintenta.');
 if(completed.data){
  if((completed.data.size??completed.data.metadata?.size)!==size||(completed.data.contentType??completed.data.metadata?.mimetype)!==mime)throw new Error('El archivo de este intento no coincide. Vuelve a elegirlo.');
 }else{
  const source=await waitForOperation(mediaSource(prepared),options.signal);
  const host=new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!);
  if(host.hostname.endsWith('.supabase.co'))host.hostname=host.hostname.replace('.supabase.co','.storage.supabase.co');
  host.pathname='/storage/v1/upload/resumable';
  await uploadInChunks({...source,size,mime,path,endpoint:host.toString(),signal:options.signal,progress:options.progress,
   authorization:async()=>{
    const {data:{session}}=await supabase!.auth.getSession();
    if(!session||session.user.id!==user.id)throw new Error('La sesión cambió. Inicia sesión y publica de nuevo.');
    return {authorization:`Bearer ${session.access_token}`,apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!};
   }});
 }
 checkSignal(options.signal);
 const {data:{session}}=await waitForOperation(supabase.auth.getSession(),options.signal);
 if(!session||session.user.id!==user.id)throw new Error('La sesión cambió. Inicia sesión y publica de nuevo.');
 options.progress?.({phase:'confirming',sent:size,total:size});
 // The form stops offering Pause at this point; a request received by the server may commit.
 const result=await waitForOperation(supabase.from(table).insert({user_id:user.id,author_name:profile.display_name,...fields,kind:media.type,media_path:path}),options.signal);
 if(result.error){
  const check=await waitForOperation(supabase.from(table).select('id').eq('media_path',path).maybeSingle(),options.signal);
  if(!check.data)throw new Error('No se pudo confirmar la publicación. Vuelve a intentar; tu archivo elegido se conservará.');
 }
}

// Sube un archivo solo si no está ya en Storage (un reintento no lo repite) y valida que sea el mismo.
async function uploadIfMissing(input:{media:Media;path:string;size:number;mime:string;userId:string;options:PublishOptions;progress:(value:UploadProgress)=>void}){
 const storage=supabase!.storage.from(bucket);
 const completed=await waitForOperation(storage.info(input.path),input.options.signal);
 if(completed.error&&completed.error.status!==404&&completed.error.statusCode!=='404'&&!['NoSuchKey','not_found'].includes(completed.error.statusCode||''))
  throw new Error('No se pudo comprobar la carga. Revisa tu conexión y reintenta.');
 if(completed.data){
  if((completed.data.size??completed.data.metadata?.size)!==input.size||(completed.data.contentType??completed.data.metadata?.mimetype)!==input.mime)throw new Error('El archivo de este intento no coincide. Vuelve a elegirlo.');
  return;
 }
 const source=await waitForOperation(mediaSource(input.media),input.options.signal);
 const host=new URL(process.env.EXPO_PUBLIC_SUPABASE_URL!);
 if(host.hostname.endsWith('.supabase.co'))host.hostname=host.hostname.replace('.supabase.co','.storage.supabase.co');
 host.pathname='/storage/v1/upload/resumable';
 await uploadInChunks({...source,size:input.size,mime:input.mime,path:input.path,endpoint:host.toString(),signal:input.options.signal,progress:input.progress,
  authorization:async()=>{
   const {data:{session}}=await supabase!.auth.getSession();
   if(!session||session.user.id!==input.userId)throw new Error('La sesión cambió. Inicia sesión y publica de nuevo.');
   return {authorization:`Bearer ${session.access_token}`,apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!};
  }});
}
// Publicación con varias fotos o videos: la primera es la portada (posts.media_path); el resto va en post_media.
// Todo es reintentable: cada archivo se sube una sola vez, la publicación se crea una sola vez y los extras se guardan sin duplicar.
async function publishPostMany(items:Media[],pathToken:string,fields:Record<string,string|number|boolean>,options:PublishOptions){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 checkSignal(options.signal);
 options.progress?.({phase:'preparing',sent:0,total:items.reduce((n,m)=>n+(m.size||0),0)});
 const {data:{user},error:authError}=await waitForOperation(supabase.auth.getUser(),options.signal);
 if(authError||!user)throw new Error('Inicia sesión desde Perfil antes de publicar.');
 const {data:profile,error:profileError}=await waitForOperation(supabase.from('profiles').select('display_name,username').eq('id',user.id).maybeSingle(),options.signal);
 if(profileError||!profile?.username||!profile.display_name)throw new Error('Guarda tu nombre y @usuario en Perfil antes de publicar.');
 const prepared:Media[]=[];
 for(const item of items){prepared.push(await waitForOperation(prepareMedia(item),options.signal));checkSignal(options.signal);}
 const total=prepared.reduce((n,m)=>n+m.size!,0);
 const paths=prepared.map((m,i)=>`${user.id}/posts-${pathToken}${i?'-'+i:''}.${mediaExtension(m.mimeType!)}`);
 const found=await waitForOperation(supabase.from('posts').select('id').eq('media_path',paths[0]).maybeSingle(),options.signal);
 if(found.error)throw new Error('No hay conexión con las publicaciones. Intenta de nuevo.');
 let postId:string|undefined=found.data?.id;
 let before=0;
 for(let i=0;i<prepared.length;i++){
  const size=prepared[i].size!,offset=before;before+=size;
  if(i===0&&postId)continue; // portada ya publicada en un intento anterior
  await uploadIfMissing({media:prepared[i],path:paths[i],size,mime:prepared[i].mimeType!,userId:user.id,options,
   progress:value=>options.progress?.({...value,sent:offset+Math.min(value.sent,size),total,accepted:value.accepted===undefined?undefined:offset+value.accepted})});
 }
 checkSignal(options.signal);
 const {data:{session}}=await waitForOperation(supabase.auth.getSession(),options.signal);
 if(!session||session.user.id!==user.id)throw new Error('La sesión cambió. Inicia sesión y publica de nuevo.');
 options.progress?.({phase:'confirming',sent:total,total});
 if(!postId){
  const result=await waitForOperation(supabase.from('posts').insert({user_id:user.id,author_name:profile.display_name,...fields,kind:prepared[0].type,media_path:paths[0]}),options.signal);
  const check=await waitForOperation(supabase.from('posts').select('id').eq('media_path',paths[0]).maybeSingle(),options.signal);
  if(!check.data)throw new Error(result.error?'No se pudo confirmar la publicación. Vuelve a intentar; tus archivos elegidos se conservarán.':'No se pudo confirmar la publicación. Revisa tu conexión y reintenta.');
  postId=check.data.id;
 }
 const rest=prepared.slice(1).map((m,i)=>({post_id:postId,user_id:user.id,position:i+2,kind:m.type,media_path:paths[i+1]}));
 const saved=await waitForOperation(supabase.from('post_media').upsert(rest,{onConflict:'media_path',ignoreDuplicates:true}),options.signal);
 if(saved.error)throw new Error('La publicación se creó, pero faltó guardar todas las fotos y videos. Pulsa Reintentar publicación.');
}

// Ubicaciones de las reseñas de una persona (lat/lng ya son públicas con cada reseña). Alimentan el mapa de estados del perfil.
export async function loadVisitedPoints(userId:string,signal?:AbortSignal):Promise<{lat:number;lng:number}[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,15000),snapshot=new Date().toISOString();
 const points:{lat:number;lng:number}[]=[];
 let after:string|undefined;
 try{
  for(;;){
   if(controller.signal.aborted)throw new Error('No se pudo cargar el mapa de estados.');
   let request=supabase.from('posts').select('id,lat,lng').eq('user_id',userId).eq('is_short',false).not('lat','is',null).not('lng','is',null).lte('created_at',snapshot).order('id',{ascending:true}).limit(250).abortSignal(controller.signal);
   if(after)request=request.gt('id',after);
   const {data,error}=await request;
   if(error||controller.signal.aborted)throw new Error('No se pudo cargar el mapa de estados.');
   const rows=data||[];
   for(const row of rows){const lat=Number(row.lat),lng=Number(row.lng);if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)points.push({lat,lng});}
   if(rows.length<250)break;
   const last=rows[rows.length-1].id;
   if(!last||last===after)throw new Error('No se pudo cargar el mapa de estados.');
   after=last;
  }
  return points;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
