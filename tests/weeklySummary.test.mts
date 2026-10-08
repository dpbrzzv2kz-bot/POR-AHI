import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {loadWeeklySummary,summarizeWeek,type WeeklyReview} from '../lib/weeklySummary.ts';

const now=new Date('2026-10-10T12:00:00.000Z');
const row=(id:string,place:string,created_at='2026-10-08T12:00:00.000Z',lat:number|null=25.67,lng:number|null=-100.3):WeeklyReview=>({id,place,created_at,lat,lng});
test('week boundaries use publication times, exclude future posts and shorts, and separate reviews from new places',()=>{
 const rows=[row('old','Café','2026-10-03T11:59:59.999Z'),row('boundary','Museo','2026-10-03T12:00:00.000Z'),row('repeat',' Café '),row('repeat2','Museo'),row('today','Parque',now.toISOString()),row('future','Mañana','2026-10-10T12:00:00.001Z'),{...row('short','Video'),is_short:true}];
 assert.deepEqual(summarizeWeek(rows,now),{reviewCount:4,placeCount:3,newPlaceCount:2,from:'2026-10-03T12:00:00.000Z',until:now.toISOString()});
});
test('same named places with nearby pins deduplicate; namesakes across town count separately',()=>{
 const rows=[row('old','Café Río','2026-10-01T12:00:00Z'),row('near',' café rio ',undefined,25.6701,-100.3001),row('new','Café Río',undefined,25.72,-100.4),row('again','Café Río',undefined,25.7201,-100.4001)];
 const summary=summarizeWeek(rows,now);assert.equal(summary.reviewCount,3);assert.equal(summary.placeCount,2);assert.equal(summary.newPlaceCount,1);
});
test('legacy reviews without pins do not falsely make a same-name place new; recorded addresses separate namesakes',()=>{
 const rows=[row('old','Tacos','2026-10-01T12:00:00Z',null,null),row('new','Tacos'),{...row('a','Museo',undefined,null,null),address:'Centro 1'},{...row('b','Museo',undefined,null,null),address:'Centro 2'}];
 const summary=summarizeWeek(rows,now);assert.equal(summary.reviewCount,3);assert.equal(summary.newPlaceCount,2);
 assert.equal(summarizeWeek([],now).reviewCount,0);
});
test('free-form review titles do not turn the same recorded address into a new place',()=>{
 const rows=[{...row('old','Mi café favorito','2026-10-01T12:00:00Z'),address:'Avenida Río 12, Monterrey'},
  {...row('today','El desayuno estuvo buenísimo'),address:'  avenida rio 12, Monterrey  '},
  {...row('again','Volví por los chilaquiles'),address:'Avenida Río 12, Monterrey'}];
 const summary=summarizeWeek(rows,now);assert.equal(summary.reviewCount,2);assert.equal(summary.placeCount,1);assert.equal(summary.newPlaceCount,0);
 const distinctAddresses=summarizeWeek([{...row('one','Tacos'),address:'Calle 1'}, {...row('two','Tacos'),address:'Calle 2'}],now);
 assert.equal(distinctAddresses.placeCount,2);assert.equal(distinctAddresses.newPlaceCount,2);
});
function fixture(mode:'ok'|'failure'|'abort'|'malformed'='ok'){
 const calls:URL[]=[];
 const client=createClient('http://weekly.fixture.invalid','test-only-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input));calls.push(url);
  if(mode==='abort')return new Promise<Response>((_resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));if(init?.signal?.aborted)abort();else init?.signal?.addEventListener('abort',abort,{once:true});});
  if(mode==='failure'&&calls.length===2)return new Response(JSON.stringify({message:'Denied'}),{status:400,headers:{'Content-Type':'application/json'}});
  if(mode==='malformed')return Response.json([{...row('bad','Parque'),created_at:'not a timestamp'}]);
  if(calls.length===1)return Response.json(Array.from({length:250},(_,i)=>row(String(i).padStart(4,'0'),'Lugar '+i,'2026-10-01T12:00:00Z')));
  return Response.json([row('0250','Nuevo'),row('0251','Lugar 0')]);
 }}});
 return {client,calls};
}
test('all pages use the current owner, exclude shorts, keep a fixed snapshot and never download files',async()=>{
 const f=fixture();try{
  const summary=await loadWeeklySummary(f.client,'owner',{now});
  assert.equal(summary.reviewCount,2);assert.equal(summary.newPlaceCount,1);assert.equal(f.calls.length,2);
  for(const url of f.calls){assert.ok(url.pathname.endsWith('/posts'));assert.equal(url.searchParams.get('user_id'),'eq.owner');assert.equal(url.searchParams.get('is_short'),'eq.false');assert.equal(url.searchParams.get('created_at'),'lte.'+now.toISOString());assert.equal(url.searchParams.get('order'),'id.asc');assert.equal(url.searchParams.get('limit'),'250');}
  assert.equal(f.calls[1].searchParams.get('id'),'gt.0249');
 }finally{await f.client.auth.dispose();}
});
test('a later page failure or malformed timestamp never returns a partial summary',async()=>{
 for(const mode of ['failure','malformed'] as const){const f=fixture(mode);try{await assert.rejects(loadWeeklySummary(f.client,'owner',{now}),/Intenta de nuevo/);}finally{await f.client.auth.dispose();}}
});
test('request cancellation and timeout abort pending work',async()=>{
 for(const kind of ['cancel','timeout']){const f=fixture('abort'),controller=new AbortController();try{
  const pending=loadWeeklySummary(f.client,'owner',{now,signal:controller.signal,timeoutMs:kind==='timeout'?15:5000});
  if(kind==='cancel')queueMicrotask(()=>controller.abort());
  await assert.rejects(pending,/Intenta de nuevo/);assert.equal(f.calls.length,1);
 }finally{await f.client.auth.dispose();}}
});
test('missing owner, invalid date and already aborted request do not issue a query',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();try{
  await assert.rejects(loadWeeklySummary(f.client,' ',{now}));await assert.rejects(loadWeeklySummary(f.client,'owner',{now:new Date('invalid')}));await assert.rejects(loadWeeklySummary(f.client,'owner',{now,signal:controller.signal}));assert.equal(f.calls.length,0);
 }finally{await f.client.auth.dispose();}
});
