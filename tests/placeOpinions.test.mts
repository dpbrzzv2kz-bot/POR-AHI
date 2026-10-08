import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {addressMatch,loadPlaceOpinion} from '../lib/placeOpinions.ts';

function fixture(total:number,failStats=false){
 const calls:{table:string;ops:unknown[][]}[]=[];
 const client={from:(table:string)=>{
  const ops:unknown[][]=[];calls.push({table,ops});
  const query:any={then:(resolve:Function,reject:Function)=>{
   let data:unknown[];
   if(table==='posts'){
    const after=ops.find(op=>op[0]==='gt')?.[2] as string|undefined;
    const start=after?Number(after)+1:0;
    data=Array.from({length:Math.max(0,Math.min(250,total-start))},(_,i)=>({id:String(start+i).padStart(5,'0')}));
   }else{
    const ids=ops.find(op=>op[0]==='in')?.[2] as string[];
    data=ids.map(id=>({post_id:id,likes_count:'2',tomatoes_count:1}));
   }
   return Promise.resolve({data,error:table==='post_stats'&&failStats?{message:'offline'}:null}).then(resolve,reject);
  }};
  for(const name of ['select','eq','ilike','lte','order','limit','gt','in','abortSignal'])query[name]=(...args:unknown[])=>{ops.push([name,...args]);return query;};
  return query;
 }} as unknown as SupabaseClient;
 return {client,calls};
}

test('place matching is a literal address, not a wildcard or a freely chosen review title',()=>{
 assert.equal(addressMatch('  Calle 100%_Real\\Uno  '),'Calle 100\\%\\_Real\\\\Uno');
 assert.throws(()=>addressMatch(''));
 assert.throws(()=>addressMatch('a\nb'));
});
test('opinions include all pages of reviews and count reactions across every matching post',async()=>{
 const f=fixture(501);
 const result=await loadPlaceOpinion(f.client,'Café de prueba, Monterrey');
 assert.deepEqual(result,{likes:1002,tomatoes:501,reviewCount:501});
 assert.equal(f.calls.filter(c=>c.table==='posts').length,3);
 assert.ok(f.calls.filter(c=>c.table==='posts').every(c=>c.ops.some(op=>op[0]==='eq'&&op[1]==='is_short'&&op[2]===false)));
 assert.ok(f.calls.filter(c=>c.table==='posts').every(c=>c.ops.some(op=>op[0]==='ilike'&&op[1]==='address'&&op[2]==='Café de prueba, Monterrey')));
 assert.equal(f.calls.filter(c=>c.table==='post_stats').length,11);
});
test('empty locations have no invented reactions, and failures never yield partial totals',async()=>{
 assert.deepEqual(await loadPlaceOpinion(fixture(0).client,'Dirección'),{likes:0,tomatoes:0,reviewCount:0});
 await assert.rejects(loadPlaceOpinion(fixture(10,true).client,'Dirección'));
 const controller=new AbortController();controller.abort();
 const f=fixture(10);await assert.rejects(loadPlaceOpinion(f.client,'Dirección',controller.signal));
 assert.equal(f.calls.length,0);
});
