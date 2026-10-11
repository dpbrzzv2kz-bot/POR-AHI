import type {SupabaseClient} from '@supabase/supabase-js';

import {APP_ORIGIN} from './appOrigin.ts';
export const RECOVERY_REDIRECT=APP_ORIGIN+'/reset-password';
export const RECOVERY_SENT='Si hay una cuenta con ese correo, recibirás un enlace para elegir una nueva contraseña. Revisa también spam y usa el enlace más reciente.';
type Auth=SupabaseClient['auth'];
type TabStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Grant={id:string;until:number};
const GRANT_KEY='porahi-recovery-pending';
export const RECOVERY_WINDOW=30*60*1000;

export function inspectRecoveryCallback(href:string):'recovery'|'invalid'|'none'{
 try{
  const url=new URL(href),params=new URLSearchParams(url.hash.slice(1));
  for(const [key,value] of url.searchParams)if(!params.has(key))params.set(key,value);
  if(params.has('error')||params.has('error_code')||params.has('error_description'))return 'invalid';
  if(params.get('type')==='recovery')return params.get('access_token')&&params.get('refresh_token')&&params.get('expires_in')&&params.get('token_type')?'recovery':'invalid';
  return ['access_token','refresh_token','code','token_hash','type'].some(key=>params.has(key))?'invalid':'none';
 }catch{return 'invalid';}
}
export class RecoveryAccessError extends Error{
 constructor(){super('Este enlace no es válido o ya venció. Solicita uno nuevo.');}
}
export class RecoveryConnectionError extends Error{
 needsReload:boolean;
 constructor(needsReload=false){super('No se pudo comprobar el enlace. Revisa tu conexión y pulsa Reintentar.');this.needsReload=needsReload;}
}
// The tab marker contains only an account ID and a short expiry, never credentials.
// Supabase still validates the session on its server before every password update.
export function createRecoveryAccess(auth:Auth|null,callback:ReturnType<typeof inspectRecoveryCallback>,storage?:TabStorage,now=()=>Date.now()){
 let grant:Grant|null=null,consumed=false,callbackAccepted=false;
 const persist=()=>{try{if(grant)storage?.setItem(GRANT_KEY,JSON.stringify(grant));else storage?.removeItem(GRANT_KEY);}catch{/* Safari may disable sessionStorage. In-memory recovery still works. */}};
 const clear=()=>{grant=null;consumed=true;persist();};
 try{const saved=JSON.parse(storage?.getItem(GRANT_KEY)||'null');if(callback==='none'&&typeof saved?.id==='string'&&typeof saved?.until==='number'&&saved.until>now()&&saved.until<=now()+RECOVERY_WINDOW)grant=saved;}catch{/* Ignore an invalid tab marker. */}
 if(callback!=='none'){grant=null;persist();}
 const accept=(id:string)=>{grant={id,until:now()+RECOVERY_WINDOW};callbackAccepted=true;consumed=false;persist();};
 auth?.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&callback==='recovery'&&!consumed&&session)accept(session.user.id);
  else if(event==='SIGNED_OUT'||(grant&&session&&session.user.id!==grant.id))clear();
 });
 const validate=async()=>{
  if(!auth||consumed||callback==='invalid')throw new RecoveryAccessError();
  const initialized=await auth.initialize();
  if(initialized.error){
   if(!initialized.error.status||initialized.error.status>=500)throw new RecoveryConnectionError(true);
   clear();throw new RecoveryAccessError();
  }
  const {data,error}=await auth.getSession();
  if(error||!data.session){clear();throw new RecoveryAccessError();}
  // SDK initialization has already verified the implicit callback with Auth.
  // Do not rely on a React listener that may mount after PASSWORD_RECOVERY.
  if(callback==='recovery'&&!callbackAccepted)accept(data.session.user.id);
  if(!grant||grant.id!==data.session.user.id||grant.until<=now()){clear();throw new RecoveryAccessError();}
  const expectedId=grant.id;
  const verified=await auth.getUser();
  if(verified.error){
   if(verified.error.status&&verified.error.status<500){clear();throw new RecoveryAccessError();}
   throw new RecoveryConnectionError();
  }
  if(!grant||grant.id!==expectedId||grant.until<=now()||verified.data.user?.id!==expectedId){clear();throw new RecoveryAccessError();}
  return expectedId;
 };
 return {validate,clear};
}

export function passwordProblem(password:string,confirmation:string){
 if(password.trim().length<8)return 'Usa una contraseña de al menos 8 caracteres.';
 if(password.length>128)return 'Usa una contraseña de hasta 128 caracteres.';
 if(password!==confirmation)return 'Las contraseñas no coinciden.';
 return '';
}
export async function requestRecovery(auth:Auth,email:string){
 const clean=email.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)||clean.length>254)throw new Error('Escribe un correo válido.');
 const {error}=await auth.resetPasswordForEmail(clean,{redirectTo:RECOVERY_REDIRECT});
 if(error){
  if(error.code==='over_request_rate_limit'||error.code==='over_email_send_rate_limit'||error.status===429)throw new Error('Espera unos minutos antes de solicitar otro correo.');
  // Never reveal whether the supplied email belongs to an account.
  throw new Error('No se pudo enviar la solicitud. Revisa tu conexión o intenta más tarde.');
 }
 return RECOVERY_SENT;
}
export async function changeRecoveredPassword(auth:Auth,access:ReturnType<typeof createRecoveryAccess>,password:string,confirmation:string){
 const problem=passwordProblem(password,confirmation);if(problem)throw new Error(problem);
 await access.validate();
 const {data,error}=await auth.updateUser({password});
 if(error){
  if(error.code==='same_password')throw new Error('Elige una contraseña diferente a la anterior.');
  if(error.code==='weak_password')throw new Error('Usa una contraseña más fuerte, con letras, números y símbolos.');
  if(error.status&&error.status<500){
   if(['session_not_found','session_expired','bad_jwt','user_not_found','reauthentication_needed'].includes(error.code||'')){access.clear();throw new RecoveryAccessError();}
   throw new Error('No se pudo cambiar la contraseña. Solicita otro enlace e intenta de nuevo.');
  }
  access.clear();throw new Error('No se pudo confirmar el cambio. Intenta iniciar sesión con tu nueva contraseña; si no funciona, solicita otro enlace.');
 }
 if(!data.user){access.clear();throw new Error('No se pudo confirmar el cambio. Intenta iniciar sesión con tu nueva contraseña.');}
 access.clear();
 // Local logout gives an explicit login check with the new password.
 try{const logout=await auth.signOut({scope:'local'});return logout.error?'Contraseña actualizada. No se pudo cerrar esta sesión; vuelve a tu Perfil.':'Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.';}
 catch{return 'Contraseña actualizada. No se pudo cerrar esta sesión; vuelve a tu Perfil.';}
}
