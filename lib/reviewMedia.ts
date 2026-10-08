import type {SupabaseClient} from '@supabase/supabase-js';
import type {Review,Media} from './posts';
import {waitForOperation} from './resumable.ts';

export type ReviewRow={id:string;user_id:string;author_name:string;category:string;place:string;description:string;kind:'image'|'video';media_path:string;edit_version:number;created_at?:string;is_short?:boolean;address?:string|null;rating?:number|null};
export async function hydrateReviews(client:SupabaseClient,rows:ReviewRow[],signal?:AbortSignal):Promise<Review[]>{
 if(!rows.length)return [];
 const signed=await waitForOperation(client.storage.from('review-media').createSignedUrls(rows.map(r=>r.media_path),3600),signal);
 if(signed.error)throw new Error('No se pudieron cargar las fotos y videos. Pulsa Actualizar.');
 const urls=new Map(signed.data?.map(r=>[r.path,r.signedUrl]));
 const reviews:Review[]=rows.map(r=>{const uri=urls.get(r.media_path);if(!uri)throw new Error('Algún archivo no pudo cargarse. Pulsa Actualizar.');return {id:r.id,userId:r.user_id,author:r.author_name,category:r.category,place:r.place,text:r.description,version:r.edit_version,createdAt:r.created_at,kind:r.kind,media:{uri,type:r.kind},cloud:true,isShort:r.is_short===true,address:r.address||undefined,rating:r.rating||undefined,color:'#2b3933',symbol:'↗'};});
 return attachExtras(client,reviews,signal);
}

// Fotos y videos adicionales de cada publicación (post_media). Si no se pueden cargar, se muestra solo la portada.
async function attachExtras(client:SupabaseClient,reviews:Review[],signal?:AbortSignal):Promise<Review[]>{
 try{
  const found=await waitForOperation(client.from('post_media').select('post_id,position,kind,media_path').in('post_id',reviews.map(r=>r.id)).order('position',{ascending:true}),signal);
  if(found.error||!found.data?.length)return reviews;
  const signed=await waitForOperation(client.storage.from('review-media').createSignedUrls(found.data.map(row=>row.media_path),3600),signal);
  if(signed.error)return reviews;
  const urls=new Map(signed.data?.map(row=>[row.path,row.signedUrl]));
  const extra=new Map<string,Media[]>();
  for(const row of found.data){const uri=urls.get(row.media_path);if(!uri)continue;const list=extra.get(row.post_id)||[];list.push({uri,type:row.kind});extra.set(row.post_id,list);}
  return reviews.map(r=>{const more=extra.get(r.id);return more&&r.media?{...r,items:[r.media,...more]}:r;});
 }catch{return reviews;}
}
