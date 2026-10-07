import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {deleteOwnContent,editOwnReview,pendingContent,validateDetails,validateContentFile} from '../lib/ownContent.ts';

const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',post='33333333-3333-4333-8333-333333333333';
const target={kind:'post' as const,id:post},details={place:' New place ',category:'Comer',text:'A real review'};
const user=(uid=id)=>({id:uid,aud:'authenticated',role:'authenticated',created_at:new Date().toISOString()});
const expires=Math.floor(Date.now()/1000)+3600;
const token=(uid=id)=>`${Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:expires})).toString('base64url')}.${Buffer.from('test-only-signature').toString('base64url')}`;
async function fixture(mode='ok'){
 let pending=false,removed=false,deleted=false,failed=false,version=0;
 const calls:{path:string;body:Record<string,unknown>;authorization?:string}[]=[];
 const server=createServer(async(req,res)=>{
  let raw='';for await(const part of req)raw+=part;
  const body=raw?JSON.parse(raw):{},path=new URL(req.url!,'http://fixture').pathname;
  calls.push({path,body,authorization:req.headers.authorization});
  const reply=(value:unknown,status=200)=>res.writeHead(status,{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}).end(JSON.stringify(value));
  if(path==='/auth/v1/user'){reply(user(req.headers.authorization===`Bearer ${token(other)}`?other:id));return;}
  if(path==='/rest/v1/rpc/edit_own_review'){
   if(body.p_version!==version){reply({message:'EDIT_CONFLICT'},400);return;}
   version++;reply({id:post,version});return;
  }
  if(path==='/rest/v1/rpc/content_management'){
   if(body.p_action==='pending'){reply({items:pending&&!deleted?[target]:[]});return;}
   if(body.p_action==='begin'){pending=true;reply(deleted?{deleted:true}:{pending:true,file:`${mode==='foreign'?other:id}/post.png`});return;}
   if(body.p_action==='finish'){
    if(!removed){reply({message:'FILES_REMAIN'},400);return;}
    deleted=true;reply({deleted:true});return;
   }
  }
  if(path==='/storage/v1/object/review-media'&&req.method==='DELETE'){
   if(mode==='failure'&&!failed){failed=true;reply({message:'Temporary failure'},503);return;}
   removed=mode!=='stuck';reply(body.prefixes.map((name:string)=>({name})));return;
  }
  reply({},404);
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const client=createClient(url,'test-only-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const initialized=await client.auth.setSession({access_token:token(),refresh_token:'test-only-refresh'});
 if(initialized.error){await client.auth.dispose();await new Promise<void>(resolve=>server.close(()=>resolve()));}
 assert.equal(initialized.error,null);
 return {client,connection:{url,key:'test-only-key'},calls,deleted:()=>deleted,
  dispose:async()=>{await client.auth.dispose();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
test('editing submits only owner metadata and the expected revision',async()=>{
 const f=await fixture();try{
  assert.equal(await editOwnReview(f.client,id,post,0,details,f.connection),1);
  assert.deepEqual(f.calls.find(c=>c.path.endsWith('/edit_own_review'))?.body,{p_id:post,p_version:0,p_place:'New place',p_category:'Comer',p_description:'A real review'});
  await assert.rejects(editOwnReview(f.client,id,post,0,details,f.connection),/otra ventana/);
 }finally{await f.dispose();}
});
test('deletion requires exact confirmation before any request',async()=>{
 const f=await fixture();try{const count=f.calls.length;await assert.rejects(deleteOwnContent(f.client,id,target,'NO',f.connection),/ELIMINAR/);assert.equal(f.calls.length,count);}finally{await f.dispose();}
});
test('a remembered different account cannot edit or remove',async()=>{
 const f=await fixture();try{
  await assert.rejects(editOwnReview(f.client,other,post,0,details,f.connection),/sesión/);
  await assert.rejects(deleteOwnContent(f.client,other,target,'ELIMINAR',f.connection),/sesión/);
  assert.equal(f.calls.filter(c=>c.path.startsWith('/rest/')).length,0);
 }finally{await f.dispose();}
});
test('withdraws, removes exactly one own binary, and then finalizes',async()=>{
 const f=await fixture();try{
  let withdrawn=false;await deleteOwnContent(f.client,id,target,'ELIMINAR',f.connection,()=>{withdrawn=true;});
  assert.equal(withdrawn,true);assert.equal(f.deleted(),true);
  assert.deepEqual(f.calls.filter(c=>c.path!=='/auth/v1/user').map(c=>[c.path,c.body.p_action||c.body.prefixes]),[
   ['/rest/v1/rpc/content_management','begin'],['/storage/v1/object/review-media',[`${id}/post.png`]],['/rest/v1/rpc/content_management','finish'],
  ]);
  await deleteOwnContent(f.client,id,target,'ELIMINAR',f.connection);
  assert.equal(f.calls.filter(c=>c.path.startsWith('/storage/')).length,1);
 }finally{await f.dispose();}
});
test('temporary Storage failure is resumable without losing the pending marker',async()=>{
 const f=await fixture('failure');try{
  await assert.rejects(deleteOwnContent(f.client,id,target,'ELIMINAR',f.connection),/conexión/);
  assert.equal(f.deleted(),false);assert.deepEqual(await pendingContent(f.client),[target]);
  assert.equal(f.calls.filter(c=>c.body.p_action==='finish').length,0);
  await deleteOwnContent(f.client,id,target,'ELIMINAR',f.connection);
  assert.equal(f.deleted(),true);assert.deepEqual(await pendingContent(f.client),[]);
 }finally{await f.dispose();}
});
test('server must verify absence even if Storage reports success',async()=>{
 const f=await fixture('stuck');try{
  await assert.rejects(deleteOwnContent(f.client,id,target,'ELIMINAR',f.connection),/retirar el archivo/);assert.equal(f.deleted(),false);
 }finally{await f.dispose();}
});
test('foreign file manifests are rejected before Storage',async()=>{
 const f=await fixture('foreign');try{
  await assert.rejects(deleteOwnContent(f.client,id,target,'ELIMINAR',f.connection),/propiedad/);
  assert.equal(f.calls.filter(c=>c.path.startsWith('/storage/')).length,0);
 }finally{await f.dispose();}
});
test('switching accounts during removal never switches destructive credentials',async()=>{
 const f=await fixture();let swapped:Promise<unknown>|undefined;
 try{
  await deleteOwnContent(f.client,id,target,'ELIMINAR',f.connection,()=>{swapped=f.client.auth.setSession({access_token:token(other),refresh_token:'test-only-refresh'});});
  await swapped;
  assert.ok(f.calls.filter(c=>c.path!=='/auth/v1/user').every(c=>c.authorization===`Bearer ${token()}`));
  assert.equal((await f.client.auth.getSession()).data.session?.user.id,other);
 }finally{await f.dispose();}
});
test('validates unicode lengths, categories, and unsafe file paths',()=>{
 assert.equal(validateDetails({...details,place:' 😀😀 '}).place,'😀😀');
 for(const value of [{...details,place:'a'},{...details,category:'Other'},{...details,text:'😀'.repeat(1501)}])assert.throws(()=>validateDetails(value));
 for(const path of [`${other}/a.png`,`${id}/../a.png`,`${id}/`,`${id}//a.png`,`${id}/a\\b.png`,`${id}/a\n.png`])assert.throws(()=>validateContentFile(path,id));
 assert.equal(validateContentFile(`${id}/post.png`,id),`${id}/post.png`);
});
