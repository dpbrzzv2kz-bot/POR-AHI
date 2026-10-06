import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {createAuthFetch} from '../lib/authFetch.ts';
import {GOOGLE_REDIRECT,GOOGLE_SCOPES,inspectGoogleCallback,googleSignInEnabled,startGoogleSignIn,finishGoogleSignIn,GoogleSignInError,GoogleConnectionError} from '../lib/googleSignIn.ts';
import {createRecoveryAccess,inspectRecoveryCallback} from '../lib/passwordRecovery.ts';

const id='10000000-0000-4000-8000-000000000001';
const googleUser={id,aud:'authenticated',role:'authenticated',email:'google-fixture@example.invalid',app_metadata:{providers:['google']},user_metadata:{full_name:'Synthetic Person'},created_at:new Date().toISOString(),identities:[{identity_id:id,id,user_id:id,provider:'google',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]};
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${encode({alg:'HS256'})}.${encode({sub:id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.synthetic`;
const session={access_token:token,refresh_token:'synthetic-google-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:googleUser};
const callback=()=>`${GOOGLE_REDIRECT}#access_token=${token}&refresh_token=synthetic-google-refresh&expires_in=3600&token_type=bearer&provider_token=synthetic-provider-token`;
let sequence=0;
async function fixture(href=GOOGLE_REDIRECT,mode='ok'){
 const storage=new Map<string,string>(),calls:{method:string;path:string}[]=[];
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://fixture');calls.push({method:req.method!,path:url.pathname});
  const reply=(value:unknown,status=200)=>res.writeHead(status,{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'}).end(JSON.stringify(value));
  if(url.pathname.endsWith('/settings')){reply({external:{google:mode!=='disabled'}});return;}
  if(url.pathname.endsWith('/user')){
   if(mode==='offline'){reply({msg:'Temporary failure'},503);return;}
   if(mode==='revoked'||req.headers.authorization!==`Bearer ${token}`){reply({code:'bad_jwt',msg:'Invalid token'},401);return;}
   reply(mode==='email'?{...googleUser,identities:[{...googleUser.identities[0],provider:'email'}]}:googleUser);return;
  }
  if(url.pathname.endsWith('/token')){reply(session);return;}
  if(url.pathname.endsWith('/logout')){res.writeHead(204).end();return;}
  reply({},404);
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`,location=new URL(href);
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location,history:{state:null,replaceState:(_a:unknown,_b:unknown,newUrl:string)=>{location.href=newUrl;}}}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{visibilityState:'hidden'}});
 const client=createClient(url,'synthetic-publishable',{global:{fetch:createAuthFetch(fetch,300)},auth:{storage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{storage.set(key,value);},removeItem:key=>{storage.delete(key);}},storageKey:`google-fixture-${++sequence}`,persistSession:true,autoRefreshToken:false,detectSessionInUrl:true}});
 return {client,url,location,calls,dispose:async()=>{
  await client.auth.dispose();await new Promise<void>(resolve=>server.close(()=>resolve()));
  if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
  if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');
 }};
}

test('Google sign-in with the installed SDK and an isolated Auth server',async(t)=>{
 await t.test('reads public availability and creates only the trusted Google sign-in URL',async()=>{
  const f=await fixture();try{
   assert.equal(await googleSignInEnabled(f.url,'synthetic-publishable',createAuthFetch()),true);
   const url=new URL(await startGoogleSignIn(f.client.auth,f.url));
   assert.equal(url.origin,f.url);assert.equal(url.pathname,'/auth/v1/authorize');assert.equal(url.searchParams.get('provider'),'google');
   assert.equal(url.searchParams.get('redirect_to'),GOOGLE_REDIRECT);assert.equal(url.searchParams.get('scopes'),GOOGLE_SCOPES);assert.equal(url.searchParams.get('prompt'),'select_account');
   assert.equal(url.searchParams.has('access_type'),false);assert.equal(url.searchParams.has('client_secret'),false);
   await assert.rejects(()=>startGoogleSignIn(f.client.auth,'https://untrusted.invalid'),/destino/);
   assert.deepEqual(f.calls,[{method:'GET',path:'/auth/v1/settings'}]);
  }finally{await f.dispose();}
 });
 await t.test('disabled provider stays unavailable and network errors remain retryable',async()=>{
  const f=await fixture(GOOGLE_REDIRECT,'disabled');try{assert.equal(await googleSignInEnabled(f.url,'synthetic-publishable',createAuthFetch()),false);}finally{await f.dispose();}
  await assert.rejects(()=>googleSignInEnabled('https://fixture.invalid','synthetic',async()=>new Response('{}',{status:503})),/opciones/);
 });
 await t.test('valid callback verifies its owner on Auth, survives SDK fragment cleanup and can reload',async()=>{
  const href=callback(),f=await fixture(href);try{
   assert.equal(inspectGoogleCallback(href),'session');assert.equal(await finishGoogleSignIn(f.client.auth,inspectGoogleCallback(href)),id);
   assert.equal(f.location.hash,'');assert.equal(await finishGoogleSignIn(f.client.auth,'none'),id);
   assert.ok(f.calls.some(call=>call.path==='/auth/v1/user'));
   assert.ok(f.calls.every(call=>call.method==='GET'));
   const recovery=createRecoveryAccess(f.client.auth,inspectRecoveryCallback(href));
   await assert.rejects(()=>recovery.validate());
  }finally{await f.dispose();}
 });
 await t.test('cancellation and incomplete or recovery callbacks cannot reuse an existing Google session',async()=>{
  const f=await fixture(callback());try{
   await finishGoogleSignIn(f.client.auth,'session');
   for(const href of [`${GOOGLE_REDIRECT}#error=access_denied&error_description=private-text`,`${GOOGLE_REDIRECT}#access_token=partial`,`${callback()}&type=recovery`,`${GOOGLE_REDIRECT}?code=partial`]){
    assert.equal(inspectGoogleCallback(href),'error');
    await assert.rejects(()=>finishGoogleSignIn(f.client.auth,inspectGoogleCallback(href)),GoogleSignInError);
   }
  }finally{await f.dispose();}
 });
 await t.test('missing session, non-Google identity and revoked session never succeed',async()=>{
  const empty=await fixture();try{await assert.rejects(()=>finishGoogleSignIn(empty.client.auth,'none'),GoogleSignInError);}finally{await empty.dispose();}
  for(const mode of ['email','revoked']){const f=await fixture(callback(),mode);try{await assert.rejects(()=>finishGoogleSignIn(f.client.auth,'session'),GoogleSignInError);}finally{await f.dispose();}}
  await assert.rejects(()=>finishGoogleSignIn(null,'none'),GoogleSignInError);
 });
 await t.test('connection failure reports a retry rather than a successful login',async()=>{
  const f=await fixture(callback(),'offline');try{await assert.rejects(()=>finishGoogleSignIn(f.client.auth,'session'),GoogleConnectionError);}finally{await f.dispose();}
 });
});
