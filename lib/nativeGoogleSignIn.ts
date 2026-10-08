import type {SupabaseClient} from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {GOOGLE_SCOPES} from './googleSignIn';

type Auth=SupabaseClient['auth'];

// Acceso con Google en iPhone/Android: abre la ventana segura del sistema y
// vuelve a la app con la sesión en la dirección de regreso (flujo implícito).
// Devuelve false si la persona cierra la ventana sin terminar.
export async function signInWithGoogleNative(auth:Auth,url:string){
 const redirectTo=Linking.createURL('auth/callback');
 const {data,error}=await auth.signInWithOAuth({provider:'google',options:{
  redirectTo,scopes:GOOGLE_SCOPES,queryParams:{prompt:'select_account'},skipBrowserRedirect:true,
 }});
 if(error||!data.url)throw new Error('No se pudo abrir Google. Intenta de nuevo.');
 const destination=new URL(data.url),base=new URL(url);
 if(destination.origin!==base.origin||destination.pathname!==`${base.pathname.replace(/\/$/,'')}/auth/v1/authorize`||destination.searchParams.get('provider')!=='google'){
  throw new Error('No se pudo comprobar el destino de acceso.');
 }
 const result=await WebBrowser.openAuthSessionAsync(data.url,redirectTo);
 if(result.type!=='success')return false;
 const hash=result.url.split('#')[1]||'',params=new URLSearchParams(hash);
 const access=params.get('access_token'),refresh=params.get('refresh_token');
 if(!access||!refresh)throw new Error('No se completó el acceso con Google. Inténtalo otra vez.');
 const {error:sessionError}=await auth.setSession({access_token:access,refresh_token:refresh});
 if(sessionError)throw new Error('No se completó el acceso con Google. Inténtalo otra vez.');
 return true;
}
