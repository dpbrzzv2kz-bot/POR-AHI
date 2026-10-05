import {Platform} from 'react-native';
import {File as NativeFile} from 'expo-file-system';
import {supabase} from './supabase';

export type Media={uri:string;type:'image'|'video';mimeType?:string;fileName?:string;file?:File;size?:number};
export type Review={id:string;category:string;place:string;text:string;author:string;color:string;symbol:string;media?:Media;kind?:'image'|'video';userId?:string;near?:boolean;cloud?:boolean};
export type Story={id:string;userId:string;name:string;expires:number;media?:Media;color:string};
const bucket='review-media';
const formats:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov'};
export async function loadPosts(filter?:{userId?:string;userIds?:string[];postIds?:string[]}):Promise<Review[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 if(filter?.userIds&&!filter.userIds.length)return [];
 if(filter?.postIds&&!filter.postIds.length)return [];
 let request=supabase.from('posts').select('id,user_id,author_name,category,place,description,kind,media_path').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(60);
 if(filter?.userId)request=request.eq('user_id',filter.userId);
 if(filter?.userIds)request=request.in('user_id',filter.userIds);
 if(filter?.postIds)request=request.in('id',filter.postIds);
 const {data,error}=await request;
 if(error)throw new Error('No se pudieron cargar las publicaciones. Pulsa Actualizar.');
 if(!data?.length)return [];
 const signed=await supabase.storage.from(bucket).createSignedUrls(data.map(r=>r.media_path),3600);
 if(signed.error)throw new Error('No se pudieron cargar las fotos y videos. Pulsa Actualizar.');
 const urls=new Map(signed.data?.map(r=>[r.path,r.signedUrl]));
 return data.map(r=>{const uri=urls.get(r.media_path);if(!uri)throw new Error('Algún archivo no pudo cargarse. Pulsa Actualizar.');return {id:r.id,userId:r.user_id,author:r.author_name,category:r.category,place:r.place,text:r.description,kind:r.kind,media:{uri,type:r.kind},cloud:true,color:'#2b3933',symbol:'↗'};});
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
export async function publishPost(media:Media,place:string,category:string,text:string,pathToken:string){
 return publishVisual(media,pathToken,'posts',{category,place:place.trim(),description:text.trim()});
}
export async function publishStory(media:Media,pathToken:string){
 return publishVisual(media,pathToken,'stories',{});
}
async function publishVisual(media:Media,pathToken:string,table:'posts'|'stories',fields:Record<string,string>){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw new Error('Inicia sesión desde Perfil antes de publicar.');
 const {data:profile,error:profileError}=await supabase.from('profiles').select('display_name,username').eq('id',user.id).maybeSingle();
 if(profileError||!profile?.username||!profile.display_name)throw new Error('Guarda tu nombre y @usuario en Perfil antes de publicar.');
 const ext=media.fileName?.split('.').at(-1)?.toLowerCase();
 const mime=media.mimeType||media.file?.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',mov:'video/quicktime'} as Record<string,string>)[ext||''];
 if(!mime||!formats[mime]||!mime.startsWith(media.type==='image'?'image/':'video/'))throw new Error('Usa una foto JPG, PNG o WebP, o un video MP4/MOV.');
 if((media.size||media.file?.size||0)>6291456)throw new Error('Para esta primera prueba usa un archivo de hasta 6 MB.');
 const path=`${user.id}/${table}-${pathToken}.${formats[mime]}`;
 // A retry reuses the path so a lost response does not create duplicate posts.
 const existing=await supabase.from(table).select('id').eq('media_path',path).maybeSingle();
 if(existing.error)throw new Error('No hay conexión con las publicaciones. Intenta de nuevo.');
 if(existing.data)return;
 let bytes:ArrayBuffer;
 if(Platform.OS==='web'){
  const file=media.file||await (await fetch(media.uri)).blob();bytes=await file.arrayBuffer();
 }else bytes=await new NativeFile(media.uri).arrayBuffer();
 if(bytes.byteLength>6291456)throw new Error('Para esta primera prueba usa un archivo de hasta 6 MB.');
 const upload=await supabase.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});
 if(upload.error&&upload.error.message!=='The resource already exists'&&(!('statusCode' in upload.error)||String(upload.error.statusCode)!=='409'))throw new Error('No se pudo subir el archivo. Revisa tu conexión y vuelve a intentar.');
 const result=await supabase.from(table).insert({user_id:user.id,author_name:profile.display_name,...fields,kind:media.type,media_path:path});
 if(result.error){
  const check=await supabase.from(table).select('id').eq('media_path',path).maybeSingle();
  if(!check.data)throw new Error('No se pudo confirmar la publicación. Vuelve a intentar; tu archivo elegido se conservará.');
 }
}
