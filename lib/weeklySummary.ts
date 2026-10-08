import type {SupabaseClient} from '@supabase/supabase-js';

export type WeeklyReview={id:string;place:string;created_at:string;lat:number|null;lng:number|null;address?:string|null;is_short?:boolean};
export type WeeklySummary={reviewCount:number;newPlaceCount:number;placeCount:number;from:string;until:string};
const weekMs=7*24*60*60*1000;
const pageSize=250;
const maxRows=50000;
const failure='No se pudo cargar tu semana. Intenta de nuevo.';
const normalized=(text:string)=>text.trim().toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');

function validPoint(row:WeeklyReview){
 return typeof row.lat==='number'&&typeof row.lng==='number'&&Number.isFinite(row.lat)&&Number.isFinite(row.lng)&&Math.abs(row.lat)<=90&&Math.abs(row.lng)<=180;
}
function samePlace(a:WeeklyReview,b:WeeklyReview){
 const addressA=normalized(a.address||''),addressB=normalized(b.address||'');
 // The stored title is free-form: address, when present on both rows, identifies the place.
 if(addressA&&addressB)return addressA===addressB;
 if(normalized(a.place)!==normalized(b.place))return false;
 if(validPoint(a)&&validPoint(b)){
  // Repeated pins within 100 m are the same named place; namesakes across town stay separate.
  const rad=Math.PI/180,dLat=(a.lat!-b.lat!)*rad,dLng=(a.lng!-b.lng!)*rad;
  const chord=Math.sin(dLat/2)**2+Math.cos(a.lat!*rad)*Math.cos(b.lat!*rad)*Math.sin(dLng/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(chord),Math.sqrt(Math.max(0,1-chord)))<=100;
 }
 // When an old pin/address is missing, do not claim that the same name is a new place.
 return true;
}
function placeKeys(row:WeeklyReview){
 const keys=['name:'+normalized(row.place)];
 const address=normalized(row.address||'');
 if(address)keys.push('address:'+address);
 return keys;
}
function remember(groups:Map<string,WeeklyReview[]>,row:WeeklyReview){
 for(const key of placeKeys(row)){const list=groups.get(key)||[];list.push(row);groups.set(key,list);}
}
function alreadyRecorded(groups:Map<string,WeeklyReview[]>,row:WeeklyReview){
 return placeKeys(row).some(key=>(groups.get(key)||[]).some(place=>samePlace(place,row)));
}

export function summarizeWeek(rows:WeeklyReview[],now=new Date()):WeeklySummary{
 if(!Number.isFinite(now.getTime()))throw new Error(failure);
 const end=now.getTime(),start=end-weekMs;
 const eligible=rows.filter(row=>!row.is_short&&normalized(row.place)&&Number.isFinite(Date.parse(row.created_at))&&Date.parse(row.created_at)<=end);
 const before=eligible.filter(row=>Date.parse(row.created_at)<start);
 const recent=eligible.filter(row=>Date.parse(row.created_at)>=start);
 const distinct:WeeklyReview[]=[];
 const recentPlaces=new Map<string,WeeklyReview[]>();
 const grouped=new Map<string,WeeklyReview[]>();
 for(const row of before)remember(grouped,row);
 let newPlaceCount=0;
 for(const row of recent){
  if(alreadyRecorded(recentPlaces,row))continue;
  distinct.push(row);
  remember(recentPlaces,row);
  if(!alreadyRecorded(grouped,row))newPlaceCount++;
 }
 return {reviewCount:recent.length,newPlaceCount,placeCount:distinct.length,from:new Date(start).toISOString(),until:now.toISOString()};
}

// Reads a complete bounded snapshot of this user's review history, without downloading media.
// If a page fails or the bound is exceeded, never display a partial total as a real summary.
export async function loadWeeklySummary(client:SupabaseClient,userId:string,options:{signal?:AbortSignal;now?:Date;timeoutMs?:number}={}):Promise<WeeklySummary>{
 if(!userId.trim())throw new Error(failure);
 const now=options.now||new Date();
 if(!Number.isFinite(now.getTime()))throw new Error(failure);
 const controller=new AbortController();
 const abort=()=>controller.abort();
 if(options.signal?.aborted)controller.abort();else options.signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,options.timeoutMs??15000);
 const rows:WeeklyReview[]=[];
 let after:string|undefined;
 try{
  for(;;){
   if(controller.signal.aborted)throw new Error(failure);
   let request=client.from('posts').select('id,place,created_at,lat,lng,address,is_short').eq('user_id',userId).eq('is_short',false).lte('created_at',now.toISOString()).order('id',{ascending:true}).limit(pageSize).abortSignal(controller.signal);
   if(after)request=request.gt('id',after);
   const result=await request;
   if(result.error||!result.data||controller.signal.aborted)throw new Error(failure);
   const page=result.data as WeeklyReview[];
   if(rows.length+page.length>maxRows)throw new Error(failure);
   if(page.some(row=>!row.id||!Number.isFinite(Date.parse(row.created_at))||!row.place?.trim()))throw new Error(failure);
   rows.push(...page);
   if(page.length<pageSize)break;
   const last=page[page.length-1].id;
   if(last===after)throw new Error(failure);
   after=last;
  }
  return summarizeWeek(rows,now);
 }catch{throw new Error(failure);}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
