import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {deleteOwnAccount,deletionPending,validateDeletionFiles} from '../lib/accountDeletion.ts';

const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const expires=Math.floor(Date.now()/1000)+3600;
const user=(uid=id)=>({id:uid,aud:'authenticated',role:'authenticated',email:'test@example.invalid',created_at:new Date().toISOString()});
const token=(uid=id)=>`${Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:expires})).toString('base64url')}.${Buffer.from('test-only-signature').toString('base64url')}`;
async function fixture(mode='ok',count=103){
 let files=Array.from({length:count},(_,i)=>`${id}/file-${i}.png`),pending=false,removed=false,failed=false;
 const calls:{path:string;action?:string;authorization?:string}[]=[];
 const server=createServer(async(req,res)=>{
  let body='';for await(const part of req)body+=part;
  const data=body?JSON.parse(body):{},path=new URL(req.url!,'http://fixture').pathname;
  const reply=(value:unknown,status=200)=>res.writeHead(status,{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}).end(JSON.stringify(value));
  calls.push({path,action:data.p_action,authorization:req.headers.authorization});
  if(path==='/auth/v1/user'){reply(user(req.headers.authorization===`Bearer ${token(other)}`?other:id));return;}
  if(path==='/auth/v1/logout'){reply({});return;}
  if(path==='/rest/v1/rpc/account_deletion'){
   if(mode==='recent'&&data.p_action==='begin'){reply({code:'42501',message:'RECENT_SIGN_IN_REQUIRED'},403);return;}
   if(data.p_action==='status'){reply({pending});return;}
   if(data.p_action==='begin'){pending=true;reply({pending});return;}
   if(data.p_action==='files'){reply({files:mode==='foreign'?[`${other}/private.png`]:files.slice(0,100)});return;}
   if(data.p_action==='finish'){removed=true;reply({deleted:true});return;}
  }
  if(path==='/storage/v1/object/review-media'&&req.method==='DELETE'){
   if(mode==='failure'&&!failed){failed=true;reply({message:'Temporary failure'},503);return;}
   if(mode!=='stuck')files=files.filter(file=>!data.prefixes.includes(file));
   reply(data.prefixes.map((name:string)=>({name})));return;
  }
  reply({},404);
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const client=createClient(url,'test-only-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const initialized=await client.auth.setSession({access_token:token(),refresh_token:'test-only-refresh'});
 if(initialized.error){await client.auth.dispose();await new Promise<void>(resolve=>server.close(()=>resolve()));}
 assert.equal(initialized.error,null);
 return {client,connection:{url,key:'test-only-key'},calls,remaining:()=>files.length,deleted:()=>removed,
  dispose:async()=>{await client.auth.dispose();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}

test('rejects missing confirmation before touching the server',async()=>{
 const f=await fixture();try{const n=f.calls.length;await assert.rejects(deleteOwnAccount(f.client,id,'ELIMINA',f.connection),/Escribe ELIMINAR/);assert.equal(f.calls.length,n);}finally{await f.dispose();}
});
test('verifies the current user, not a remembered profile',async()=>{
 const f=await fixture();try{await assert.rejects(deleteOwnAccount(f.client,other,'ELIMINAR',f.connection),/Cierra sesión/);assert.equal(f.calls.filter(c=>c.action).length,0);}finally{await f.dispose();}
});
test('removes 103 files in bounded batches then deletes Auth and signs out',async()=>{
 const f=await fixture();try{
  assert.equal(await deletionPending(f.client),false);const stages:string[]=[];
  await deleteOwnAccount(f.client,id,'ELIMINAR',f.connection,stage=>stages.push(stage));
  assert.equal(f.remaining(),0);assert.equal(f.deleted(),true);assert.deepEqual(stages,['starting','files','account']);
  assert.deepEqual(f.calls.filter(c=>c.action&&c.action!=='status').map(c=>c.action),['begin','files','files','files','finish']);
  assert.equal((await f.client.auth.getSession()).data.session,null);
 }finally{await f.dispose();}
});
test('Storage failure keeps the account and supports resuming the pending deletion',async()=>{
 const f=await fixture('failure');try{
  await assert.rejects(deleteOwnAccount(f.client,id,'ELIMINAR',f.connection),/No se pudo completar/);
  assert.equal(f.deleted(),false);assert.equal(await deletionPending(f.client),true);
  assert.equal(f.calls.filter(c=>c.action==='finish').length,0);
  await deleteOwnAccount(f.client,id,'ELIMINAR',f.connection);assert.equal(f.deleted(),true);
 }finally{await f.dispose();}
});
test('refuses a path from a different account before invoking Storage',async()=>{
 const f=await fixture('foreign');try{
  await assert.rejects(deleteOwnAccount(f.client,id,'ELIMINAR',f.connection),/propiedad/);
  assert.equal(f.calls.filter(c=>c.path.startsWith('/storage/')).length,0);assert.equal(f.deleted(),false);
 }finally{await f.dispose();}
});
test('stops if Storage reports success without removing the files',async()=>{
 const f=await fixture('stuck');try{
  await assert.rejects(deleteOwnAccount(f.client,id,'ELIMINAR',f.connection),/retirar los archivos/);
  assert.equal(f.calls.filter(c=>c.path.startsWith('/storage/')).length,1);assert.equal(f.deleted(),false);
 }finally{await f.dispose();}
});
test('requires server-side recent sign-in even if local session exists',async()=>{
 const f=await fixture('recent');try{
  await assert.rejects(deleteOwnAccount(f.client,id,'ELIMINAR',f.connection),/10 minutos/);
  assert.equal(f.calls.filter(c=>c.path.startsWith('/storage/')).length,0);assert.equal(f.deleted(),false);
 }finally{await f.dispose();}
});
test('pins all destructive credentials when another account signs in mid-operation',async()=>{
 const f=await fixture();let swapped:Promise<unknown>|undefined;
 try{
  await deleteOwnAccount(f.client,id,'ELIMINAR',f.connection,stage=>{if(stage==='files')swapped=f.client.auth.setSession({access_token:token(other),refresh_token:'test-only-other-refresh'});});
  await swapped;
  const destructive=f.calls.filter(c=>c.action||c.path.startsWith('/storage/'));
  assert.ok(destructive.length>0);assert.ok(destructive.every(c=>c.authorization===`Bearer ${token()}`));
  assert.equal((await f.client.auth.getSession()).data.session?.user.id,other);
  assert.equal(f.calls.filter(c=>c.path==='/auth/v1/logout').length,0);
 }finally{await f.dispose();}
});
test('validates the manifest and rejects traversal, empty folders and oversized batches',()=>{
 for(const paths of [[`${id}/../file`],[`${id}//file`],[`${id}/`],[''],Array(101).fill(`${id}/file`)])assert.throws(()=>validateDeletionFiles(paths,id));
 assert.deepEqual(validateDeletionFiles([`${id}/a`,`${id}/a`],id),[`${id}/a`]);
});
