import type {SupabaseClient} from '@supabase/supabase-js';
import {hydrateReviews} from './reviewMedia.ts';

export const reviewCategories=['Todas','Comer','Divertirse','Explorar'] as const;
export const reviewFormats=['Todos','Fotos','Videos'] as const;
export type ReviewCategory=typeof reviewCategories[number];
export type ReviewFormat=typeof reviewFormats[number];
export type DiscoveryFilters={query:string;category:ReviewCategory;format:ReviewFormat};
export const discoveryPageSize=20;
export async function searchReviews(client:SupabaseClient,filters:DiscoveryFilters,offset=0,signal?:AbortSignal){
 if(/[\u0000-\u001f\u007f]/u.test(filters.query))throw new Error('Escribe el nombre del lugar sin caracteres de control.');
 const query=filters.query.normalize('NFC').trim().replace(/\s+/g,' ');
 if([...query].length>80||/[\u0000-\u001f\u007f*]/u.test(query))throw new Error('Escribe un nombre de lugar de hasta 80 caracteres, sin asteriscos.');
 if(!reviewCategories.includes(filters.category)||!reviewFormats.includes(filters.format)||!Number.isSafeInteger(offset)||offset<0)throw new Error('Revisa los filtros de búsqueda.');
 try{
  let request=client.from('posts').select('id,user_id,author_name,category,place,description,kind,media_path,edit_version,created_at,is_short,address,rating').eq('is_short',false).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+discoveryPageSize);
  // Literal substring search: the visitor cannot turn %, _ or \ into wildcards.
  if(query)request=request.ilike('place','%'+query.replace(/[\\%_]/g,'\\$&')+'%');
  if(filters.category!=='Todas')request=request.eq('category',filters.category);
  if(filters.format!=='Todos')request=request.eq('kind',filters.format==='Fotos'?'image':'video');
  if(signal)request=request.abortSignal(signal);
  const {data,error}=await request;
  if(error)throw error;
  const rows=data||[];
  const reviews=await hydrateReviews(client,rows.slice(0,discoveryPageSize),signal);
  return {reviews,nextOffset:rows.length>discoveryPageSize?offset+discoveryPageSize:null};
 }catch{throw new Error('No se pudo completar la búsqueda. Revisa tu conexión y pulsa Reintentar búsqueda.');}
}
