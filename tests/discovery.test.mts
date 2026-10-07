import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {searchReviews,type DiscoveryFilters} from '../lib/discovery.ts';

const filters:DiscoveryFilters={query:'',category:'Todas',format:'Todos'};
function fixture(mode='ok'){
 const calls:{url:URL;body?:{paths:string[]}}[]=[];
 const client=createClient('http://fixture.invalid','test-only-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
  const url=new URL(String(input)),body=init?.body?JSON.parse(String(init.body)):undefined;calls.push({url,body});
  if(url.pathname.endsWith('/posts')){
   if(mode==='abort')return new Promise<Response>((_resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));if(init?.signal?.aborted)abort();else init?.signal?.addEventListener('abort',abort,{once:true});});
   if(mode==='failure')return new Response(JSON.stringify({message:'Denied'}),{status:400,headers:{'Content-Type':'application/json'}});
   const count=mode==='empty'?0:21,offset=Number(url.searchParams.get('offset')||0);
   return Response.json(Array.from({length:count},(_,i)=>({id:'row-'+(i+offset),user_id:'owner',author_name:'Artista',place:'Un café',description:'Detalle',category:'Comer',kind:'image',media_path:'owner/'+(i+offset)+'.png',edit_version:0})));
  }
  if(url.pathname.endsWith('/review-media'))return Response.json(body.paths.map((path:string,i:number)=>mode==='missing'&&i===0?{path,error:'Missing'}:{path,signedURL:'/signed/'+path}));
  return new Response('{}',{status:404});
 }}});
 return {client,calls};
}
test('search sends server filters and can reach beyond the latest 60; signs only one bounded page',async()=>{
 const f=fixture();try{
  const page=await searchReviews(f.client,{query:'  Café  del Patio  ',category:'Comer',format:'Fotos'},80);
  const url=f.calls[0].url;
  assert.equal(url.searchParams.get('place'),'ilike.%Café del Patio%');assert.equal(url.searchParams.get('category'),'eq.Comer');assert.equal(url.searchParams.get('kind'),'eq.image');
  assert.equal(url.searchParams.get('order'),'created_at.desc,id.desc');assert.equal(url.searchParams.get('offset'),'80');assert.equal(url.searchParams.get('limit'),'21');
  assert.equal(page.reviews.length,20);assert.equal(page.nextOffset,100);assert.equal(page.reviews[0].id,'row-80');
  assert.equal(f.calls[1].body?.paths.length,20);assert.ok(page.reviews.every(r=>r.cloud&&r.media?.uri));
 }finally{await f.client.auth.dispose();}
});
test('literal punctuation cannot broaden a place search or inject filters',async()=>{
 const f=fixture();try{
  await searchReviews(f.client,{...filters,query:'100%_Real\\,(otra)',format:'Videos'});
  assert.equal(f.calls[0].url.searchParams.get('place'),'ilike.%100\\%\\_Real\\\\,(otra)%');
  assert.equal(f.calls[0].url.searchParams.get('or'),null);assert.equal(f.calls[0].url.searchParams.get('kind'),'eq.video');
 }finally{await f.client.auth.dispose();}
});
test('invalid categories, formats, offsets and search input stop before any network call',async()=>{
 const f=fixture();try{
  for(const query of ['*','a'.repeat(81),'A\nB'])await assert.rejects(searchReviews(f.client,{...filters,query}));
  for(const offset of [-1,1.2,NaN,Infinity])await assert.rejects(searchReviews(f.client,filters,offset));
  await assert.rejects(searchReviews(f.client,{...filters,category:'Other'} as unknown as DiscoveryFilters));
  await assert.rejects(searchReviews(f.client,{...filters,format:'Other'} as unknown as DiscoveryFilters));assert.equal(f.calls.length,0);
 }finally{await f.client.auth.dispose();}
});
test('empty matches do not sign files or invent reviews',async()=>{
 const f=fixture('empty');try{assert.deepEqual(await searchReviews(f.client,filters),{reviews:[],nextOffset:null});assert.equal(f.calls.length,1);}finally{await f.client.auth.dispose();}
});
test('database or missing-file failures offer search retry and never partial success',async()=>{
 for(const mode of ['failure','missing']){const f=fixture(mode);try{await assert.rejects(searchReviews(f.client,filters),/Reintentar búsqueda/);}finally{await f.client.auth.dispose();}}
});
test('cancelling an outstanding search stops the SDK request',async()=>{
 const f=fixture('abort'),controller=new AbortController();try{
  const pending=searchReviews(f.client,filters,0,controller.signal);queueMicrotask(()=>controller.abort());
  await assert.rejects(pending,/Reintentar búsqueda/);assert.equal(f.calls.length,1);
 }finally{await f.client.auth.dispose();}
});
