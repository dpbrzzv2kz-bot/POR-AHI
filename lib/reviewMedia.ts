import type {SupabaseClient} from '@supabase/supabase-js';
import type {Review} from './posts';
import {waitForOperation} from './resumable.ts';

export type ReviewRow={id:string;user_id:string;author_name:string;category:string;place:string;description:string;kind:'image'|'video';media_path:string;edit_version:number};
export async function hydrateReviews(client:SupabaseClient,rows:ReviewRow[],signal?:AbortSignal):Promise<Review[]>{
 if(!rows.length)return [];
 const signed=await waitForOperation(client.storage.from('review-media').createSignedUrls(rows.map(r=>r.media_path),3600),signal);
 if(signed.error)throw new Error('No se pudieron cargar las fotos y videos. Pulsa Actualizar.');
 const urls=new Map(signed.data?.map(r=>[r.path,r.signedUrl]));
 return rows.map(r=>{const uri=urls.get(r.media_path);if(!uri)throw new Error('Algún archivo no pudo cargarse. Pulsa Actualizar.');return {id:r.id,userId:r.user_id,author:r.author_name,category:r.category,place:r.place,text:r.description,version:r.edit_version,kind:r.kind,media:{uri,type:r.kind},cloud:true,color:'#2b3933',symbol:'↗'};});
}
