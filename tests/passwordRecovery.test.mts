import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {createAuthFetch} from '../lib/authFetch.ts';
import {createRecoveryAccess,inspectRecoveryCallback,requestRecovery,changeRecoveredPassword,RECOVERY_REDIRECT,RECOVERY_WINDOW,RecoveryAccessError} from '../lib/passwordRecovery.ts';

const uid='10000000-0000-4000-8000-000000000001';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${encode({alg:'HS256'})}.${encode({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.synthetic`;
const session={access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
const tabStorage=()=>{const map=new Map<string,string>();return {getItem:(key:string)=>map.get(key)||null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);},map};};
let fixtures=0;
async function fixture(href=RECOVERY_REDIRECT,mode='ok',authStorage=tabStorage()){
 const calls:{method:string;path:string;body:Record<string,unknown>;redirect:string|null}[]=[];
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://local'),parts:Buffer[]=[];
  for await(const part of req)parts.push(part);
  const body=JSON.parse(Buffer.concat(parts).toString()||'{}');calls.push({method:req.method!,path:url.pathname,body,redirect:url.searchParams.get('redirect_to')});
  const reply=(value:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}).end(JSON.stringify(value));};
  if(url.pathname.endsWith('/recover')){if(mode==='rate')reply({code:'over_email_send_rate_limit',msg:'Rate limit'},429);else if(mode==='smtp')reply({code:'email_address_not_authorized',msg:'Not authorized'},403);else reply({});return;}
  if(url.pathname.endsWith('/token')){reply(session);return;}
  if(url.pathname.endsWith('/user')){
   if(req.headers.authorization!==`Bearer ${token}`||mode==='revoked'){reply({code:'bad_jwt',msg:'Invalid token'},401);return;}
   if(req.method==='PUT'){
    if(mode==='same')reply({code:'same_password',msg:'Same password'},422);
    else if(mode==='weak')reply({code:'weak_password',msg:'Weak password'},422);
    else if(mode==='lost')req.socket.destroy();else reply(user);
   }else reply(user);
   return;
  }
  if(url.pathname.endsWith('/logout')){res.writeHead(204).end();return;}
  reply({},404);
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=(server.address() as {port:number}).port;
 const location=new URL(href);
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location,localStorage:authStorage,history:{state:null,replaceState:(_a:unknown,_b:unknown,newUrl:string)=>{location.href=newUrl;}}}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{visibilityState:'hidden'}});
 const callback=inspectRecoveryCallback(href);
 const client=createClient(`http://127.0.0.1:${port}`,'synthetic-publishable',{global:{fetch:createAuthFetch(fetch,300)},auth:{storage:authStorage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:true,storageKey:`fixture-${++fixtures}`}});
 const pending=tabStorage();let clock=Date.now();
 const access=createRecoveryAccess(client.auth,callback,pending,()=>clock);
 return {client,access,calls,pending,advance:()=>{clock+=RECOVERY_WINDOW+1;},dispose:async()=>{await client.auth.dispose();await new Promise<void>(resolve=>server.close(()=>resolve()));if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');}};
}
const validHref=()=>`${RECOVERY_REDIRECT}#access_token=${token}&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=recovery`;

test('recovery with the installed Supabase SDK and a synthetic Auth server',async(t)=>{
 await t.test('request uses the exact trusted redirect and gives a neutral response for any address',async()=>{
  const f=await fixture();try{
   const known=await requestRecovery(f.client.auth,' fixture@example.invalid '),unknown=await requestRecovery(f.client.auth,'absent@example.invalid');assert.equal(known,unknown);
   assert.ok(f.calls.filter(c=>c.path.endsWith('/recover')).every(c=>c.redirect===RECOVERY_REDIRECT));assert.equal(f.calls[0].body.email,'fixture@example.invalid');
   await assert.rejects(()=>requestRecovery(f.client.auth,'invalid'),/correo válido/);assert.equal(f.calls.length,2);
  }finally{await f.dispose();}
 });
 await t.test('rate limits and SMTP rejection never expose account existence',async()=>{
  for(const mode of ['rate','smtp']){const f=await fixture(RECOVERY_REDIRECT,mode);try{await assert.rejects(()=>requestRecovery(f.client.auth,'fixture@example.invalid'),mode==='rate'?/Espera/:/No se pudo enviar/);}finally{await f.dispose();}}
 });
 await t.test('valid callback works even before the recovery event reaches a mounted screen; saves once and logs out',async()=>{
  const f=await fixture(validHref());try{
   assert.equal(await f.access.validate(),uid);assert.equal((globalThis as unknown as {window:{location:URL}}).window.location.hash,'');
   const marker=JSON.stringify([...f.pending.map]);assert.ok(!marker.includes(token)&&!marker.includes('synthetic-refresh'));
   const reloadAccess=createRecoveryAccess(f.client.auth,'none',f.pending);assert.equal(await reloadAccess.validate(),uid);
   await assert.rejects(()=>changeRecoveredPassword(f.client.auth,f.access,'short','short'),/8 caracteres/);
   await assert.rejects(()=>changeRecoveredPassword(f.client.auth,f.access,'Synthetic2026!','other'),/no coinciden/);
   assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);
   assert.match(await changeRecoveredPassword(f.client.auth,f.access,'Synthetic2026!','Synthetic2026!'),/actualizada/);
   const update=f.calls.find(c=>c.method==='PUT')!.body;assert.equal(update.password,'Synthetic2026!');assert.ok(!('email' in update)&&!('data' in update));
   assert.equal((await f.client.auth.getSession()).data.session,null);assert.equal(f.pending.map.size,0);
   await assert.rejects(()=>changeRecoveredPassword(f.client.auth,f.access,'Synthetic2027!','Synthetic2027!'),RecoveryAccessError);
   assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);
  }finally{await f.dispose();}
 });
 await t.test('regular login cannot enable recovery, and an expired marker cannot update',async()=>{
  const regular=await fixture();try{await regular.client.auth.signInWithPassword({email:user.email,password:'Synthetic2026!'});await assert.rejects(()=>regular.access.validate(),RecoveryAccessError);assert.equal(regular.calls.filter(c=>c.method==='PUT').length,0);}finally{await regular.dispose();}
  const f=await fixture(validHref());try{await f.access.validate();f.advance();await assert.rejects(()=>changeRecoveredPassword(f.client.auth,f.access,'Synthetic2026!','Synthetic2026!'),RecoveryAccessError);assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);}finally{await f.dispose();}
 });
 await t.test('expired or incomplete callback cannot fall back to a normal session',async()=>{
  for(const href of [`${RECOVERY_REDIRECT}#error=access_denied&error_code=otp_expired`,`${RECOVERY_REDIRECT}#type=recovery`,`${RECOVERY_REDIRECT}#access_token=bad&refresh_token=bad&expires_in=3600&token_type=bearer&type=recovery`]){
   const f=await fixture(href);try{await assert.rejects(()=>f.access.validate(),RecoveryAccessError);assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);}finally{await f.dispose();}
  }
 });
 await t.test('server rejects weak/same passwords, and lost update response never claims success',async()=>{
  for(const [mode,message] of [['weak',/más fuerte/],['same',/diferente/],['lost',/No se pudo confirmar/]] as const){const f=await fixture(validHref(),mode);try{await assert.rejects(()=>changeRecoveredPassword(f.client.auth,f.access,'Synthetic2026!','Synthetic2026!'),message);assert.equal(f.calls.filter(c=>c.method==='PUT').length,1);if(mode==='lost')await assert.rejects(()=>f.access.validate(),RecoveryAccessError);}finally{await f.dispose();}}
 });
 await t.test('a revoked callback is rejected by Auth before any password update',async()=>{
  const f=await fixture(validHref(),'revoked');try{await assert.rejects(()=>changeRecoveredPassword(f.client.auth,f.access,'Synthetic2026!','Synthetic2026!'),RecoveryAccessError);assert.equal(f.calls.filter(c=>c.method==='PUT').length,0);}finally{await f.dispose();}
 });
});

test('auth requests time out and keep caller cancellation; other APIs use their own limits',async()=>{
 const fetcher:typeof fetch=async(_input,init)=>new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});
 await assert.rejects(()=>createAuthFetch(fetcher,10)('https://fixture.invalid/auth/v1/user'),/aborted/);
 const controller=new AbortController(),request=createAuthFetch(fetcher,100)('https://fixture.invalid/auth/v1/recover',{signal:controller.signal});controller.abort();await assert.rejects(()=>request,/aborted/);
 const passthrough:typeof fetch=async(_input,init)=>{assert.equal(init?.signal,controller.signal);return new Response('{}');};
 await createAuthFetch(passthrough,10)('https://fixture.invalid/rest/v1/posts',{signal:controller.signal});
});
