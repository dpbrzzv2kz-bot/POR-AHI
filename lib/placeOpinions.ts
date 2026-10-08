import type {SupabaseClient} from '@supabase/supabase-js';

export type PlaceOpinionTotals={likes:number;tomatoes:number;reviewCount:number};
const count=(value:unknown)=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
// Match the actual address, not a review's freely chosen title. Escape LIKE wildcards.
export function addressMatch(address:string){
 const value=address.normalize('NFC').trim();
 if(!value||value.length>300||/[\u0000-\u001f\u007f]/u.test(value))throw new Error('Esta reseña no tiene una dirección válida.');
 return value.replace(/[\\%_]/g,'\\$&');
}
export async function loadPlaceOpinion(client:SupabaseClient,address:string,signal?:AbortSignal):Promise<PlaceOpinionTotals>{
 const pattern=addressMatch(address),ids=new Set<string>(),snapshot=new Date().toISOString();
 const pageSize=250;
 let after:string|undefined;
 for(;;){
  if(signal?.aborted)throw new Error('La consulta tardó demasiado. Intenta de nuevo.');
  let request=client.from('posts').select('id').eq('is_short',false).ilike('address',pattern).lte('created_at',snapshot).order('id',{ascending:true}).limit(pageSize);
  if(after)request=request.gt('id',after);
  if(signal)request=request.abortSignal(signal);
  const {data,error}=await request;
  if(error)throw new Error('No se pudo cargar la opinión de este lugar.');
  for(const row of data||[])ids.add(row.id);
  if(!data||data.length<pageSize)break;
  const last=data[data.length-1].id;
  if(!last||last===after)throw new Error('No se pudo completar la opinión del lugar.');
  after=last;
 }
 let likes=0,tomatoes=0;
 const all=[...ids];
 for(let start=0;start<all.length;start+=50){
  if(signal?.aborted)throw new Error('La consulta tardó demasiado. Intenta de nuevo.');
  let request=client.from('post_stats').select('post_id,likes_count,tomatoes_count').in('post_id',all.slice(start,start+50));
  if(signal)request=request.abortSignal(signal);
  const {data,error}=await request;
  if(error)throw new Error('No se pudieron cargar las reacciones del lugar.');
  for(const row of data||[]){likes+=count(row.likes_count);tomatoes+=count(row.tomatoes_count);}
 }
 return {likes,tomatoes,reviewCount:all.length};
}
