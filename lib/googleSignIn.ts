import type {SupabaseClient} from '@supabase/supabase-js';

export const GOOGLE_REDIRECT='https://incredible-crumble-34cbca.netlify.app/auth/google';
export const GOOGLE_SCOPES='openid email profile';
type Auth=SupabaseClient['auth'];
export type GoogleCallback='session'|'error'|'none';

// Capture this before the SDK verifies the callback and removes its fragment.
export function inspectGoogleCallback(href:string):GoogleCallback{
 try{
  const url=new URL(href),params=new URLSearchParams(url.hash.slice(1));
  for(const [key,value] of url.searchParams)if(!params.has(key))params.set(key,value);
  if(['error','error_code','error_description','code','token_hash'].some(key=>params.has(key))||params.get('type')==='recovery')return 'error';
  if(['access_token','refresh_token','expires_in','token_type'].some(key=>params.has(key))){
   return ['access_token','refresh_token','expires_in','token_type'].every(key=>!!params.get(key))?'session':'error';
  }
  return params.has('type')?'error':'none';
 }catch{return 'error';}
}

// Public Auth settings contain provider availability, never client secrets.
export async function googleSignInEnabled(url:string,key:string,fetcher:typeof fetch,signal?:AbortSignal){
 const response=await fetcher(`${url.replace(/\/$/,'')}/auth/v1/settings`,{headers:{apikey:key},signal});
 if(!response.ok)throw new Error('No se pudieron consultar las opciones de acceso.');
 const settings=await response.json();
 return settings.external?.google===true;
}

export async function startGoogleSignIn(auth:Auth,url:string){
 const {data,error}=await auth.signInWithOAuth({provider:'google',options:{
  redirectTo:GOOGLE_REDIRECT,scopes:GOOGLE_SCOPES,queryParams:{prompt:'select_account'},skipBrowserRedirect:true,
 }});
 if(error||!data.url)throw new Error('No se pudo abrir Google. Intenta de nuevo.');
 const destination=new URL(data.url),base=new URL(url);
 if(destination.origin!==base.origin||destination.pathname!==`${base.pathname.replace(/\/$/,'')}/auth/v1/authorize`||destination.searchParams.get('provider')!=='google'||destination.searchParams.get('redirect_to')!==GOOGLE_REDIRECT){
  throw new Error('No se pudo comprobar el destino de acceso.');
 }
 return destination.href;
}

export class GoogleSignInError extends Error{
 constructor(){super('No se completó el acceso con Google. Vuelve a tu cuenta e inténtalo otra vez.');}
}
export class GoogleConnectionError extends Error{
 needsReload:boolean;
 constructor(needsReload=false){super('No se pudo comprobar tu sesión. Revisa tu conexión y pulsa Reintentar.');this.needsReload=needsReload;}
}
export async function finishGoogleSignIn(auth:Auth|null,callback:GoogleCallback){
 if(!auth||callback==='error')throw new GoogleSignInError();
 const initialized=await auth.initialize();
 if(initialized.error){
  if(!initialized.error.status||initialized.error.status>=500)throw new GoogleConnectionError(true);
  throw new GoogleSignInError();
 }
 const {data,error}=await auth.getSession();
 if(error||!data.session)throw new GoogleSignInError();
 const verified=await auth.getUser();
 if(verified.error){
  if(!verified.error.status||verified.error.status>=500)throw new GoogleConnectionError();
  throw new GoogleSignInError();
 }
 const user=verified.data.user;
 if(user?.id!==data.session.user.id||!user?.identities?.some(identity=>identity.provider==='google'))throw new GoogleSignInError();
 return user.id;
}
