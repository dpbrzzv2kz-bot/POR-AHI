import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliverReviewLink,reviewLink,sharedReviewId} from '../lib/reviewSharing.ts';
const id='10000000-0000-4000-8000-000000000001';
const review={id,cloud:true,place:'Café de prueba',author:'Beta Ana',media:{uri:'https://storage.invalid/file?token=private'}};
test('links contain only a canonical published review ID; duplicates and demo IDs are rejected',()=>{
 assert.equal(reviewLink({...review,id:id.toUpperCase()}),`https://por-ahi-ap.pages.dev/?review=${id}`);
 for(const value of ['',undefined,[id,id],{toString:()=>id},id+'#access_token=secret'])assert.equal(sharedReviewId(value),null);
 assert.throws(()=>reviewLink({...review,cloud:false}));assert.throws(()=>reviewLink({...review,id:'1'}));
});
test('sharing never transmits a signed media URL or unrelated review properties',async()=>{
 let payload:unknown;
 assert.equal(await deliverReviewLink(review,'share',{share:async data=>{payload=data;}}),'shared');
 assert.deepEqual(payload,{title:'Café de prueba · Por Ahí',text:'Beta Ana recomienda Café de prueba.',url:reviewLink(review)});
 assert.ok(!JSON.stringify(payload).includes('private'));
});
test('web cancellation and native dismissal do not overwrite the clipboard',async()=>{
 for(const share of [async()=>{throw Object.assign(new Error('cancelled'),{name:'AbortError'});},async()=>'dismissed' as const]){
  let copies=0;assert.equal(await deliverReviewLink(review,'share',{share,copy:async()=>{copies++;}}),'cancelled');assert.equal(copies,0);
 }
});
test('unsupported or denied sharing falls back to a successfully copied link',async()=>{
 let copied='';
 assert.equal(await deliverReviewLink(review,'share',{share:async()=>{throw new Error('NotAllowedError');},copy:async value=>{copied=value;}}),'copied');
 assert.equal(copied,reviewLink(review));
 assert.equal(await deliverReviewLink(review,'share',{copy:async()=>{}}),'copied');
});
test('copy intent never invokes sharing; clipboard failure never claims success',async()=>{
 let shares=0;
 assert.equal(await deliverReviewLink(review,'copy',{share:async()=>{shares++;},copy:async()=>{throw new Error('denied');}}),'manual');
 assert.equal(shares,0);assert.equal(await deliverReviewLink(review,'share',{}),'manual');
});
