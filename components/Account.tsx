import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet,Platform} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';
import {Link,router} from 'expo-router';
import {googleSignInEnabled,startGoogleSignIn} from '../lib/googleSignIn';
import {signInWithGoogleNative} from '../lib/nativeGoogleSignIn';
import {createAuthFetch} from '../lib/authFetch';
import {legalReady} from '../lib/legalContent';
import {palette as p} from '../lib/theme';
import ui from '../lib/uiStyles';

const googleStyles=StyleSheet.create({button:{backgroundColor:p.surface,borderRadius:14,minHeight:48,padding:15,marginTop:12,alignItems:'center',borderWidth:1,borderColor:p.line},text:{color:p.ink,fontWeight:'700'}});

export type Profile={display_name:string;username:string|null;bio:string};
export type ProfileStatus='loading'|'incomplete'|'complete';
export default function Account({onProfileChange,onProfileStatus,onboarding=false,settings=false}:{onProfileChange:(profile:Profile|null)=>void;onProfileStatus?:(status:ProfileStatus)=>void;onboarding?:boolean;settings?:boolean}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false);
 const [name,setName]=useState(''),[username,setUsername]=useState(''),[bio,setBio]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[profileReady,setProfileReady]=useState(false);
 const [profileLoading,setProfileLoading]=useState(false),[loadAttempt,setLoadAttempt]=useState(0);
 const [googleEnabled,setGoogleEnabled]=useState(false),[googleRetry,setGoogleRetry]=useState(false),[providerAttempt,setProviderAttempt]=useState(0);
 const googleLock=useRef(false);
 const [editingUser,setEditingUser]=useState<string|null>(null);
 const editing=!!session&&(settings||editingUser===session.user.id);
 useEffect(()=>{
  const url=process.env.EXPO_PUBLIC_SUPABASE_URL,key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key||session)return;
  let active=true;const controller=new AbortController();
  googleSignInEnabled(url,key,createAuthFetch(),controller.signal).then(enabled=>{if(active){setGoogleEnabled(enabled);setGoogleRetry(false);}}).catch(()=>{if(active){setGoogleEnabled(false);setGoogleRetry(true);}});
  return()=>{active=false;controller.abort();};
 },[session,providerAttempt]);
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let active=true;
  supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setLoading(false);if(error)setNotice('No se pudo recuperar tu sesión. Intenta entrar de nuevo.');}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setLoading(false);setPassword('');if(!next)setEditingUser(null);}});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setProfileReady(false);setProfileLoading(!!session);setNotice('');onProfileChange(null);onProfileStatus?.('loading');
  if(session&&supabase){
   const timer=setTimeout(()=>controller.abort(),15000);
   (async()=>{try{
    const {data,error}=await supabase!.from('profiles').select('display_name,username,bio').eq('id',session.user.id).abortSignal(controller.signal).maybeSingle();
    if(!active)return;
    if(error)throw error;
    setName(data?.display_name||'');setUsername(data?.username||'');setBio(data?.bio||'');setProfileReady(true);onProfileChange(data);onProfileStatus?.(data?.display_name&&data?.username?'complete':'incomplete');
   }catch{if(active)setNotice('No se pudo cargar tu perfil. Pulsa Reintentar carga.');}
   finally{clearTimeout(timer);if(active)setProfileLoading(false);}})();
   return()=>{active=false;clearTimeout(timer);controller.abort();};
  }
  setName('');setUsername('');setBio('');
  return()=>{active=false;controller.abort();};
 },[session,loadAttempt,onProfileChange,onProfileStatus]);
 const action=async()=>{
  if(!supabase)return;
  setNotice('');
  if(!email.trim().includes('@')||password.length<8){setNotice('Escribe tu correo y una contraseña de al menos 8 caracteres.');return;}
  setBusy(true);
  try{
   const result=signup?await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:'https://incredible-crumble-34cbca.netlify.app/'}}):await supabase.auth.signInWithPassword({email:email.trim(),password});
   if(result.error){setNotice(result.error.code==='email_not_confirmed'?'Confirma tu correo antes de entrar.':'No se pudo completar. Revisa los datos; si has intentado varias veces, espera antes de volver a intentar.');}
   else if(signup&&!result.data.session){setNotice('Revisa tu correo para confirmar la cuenta. Después vuelve aquí e inicia sesión.');setPassword('');}
  }catch{setNotice('No hay conexión. Intenta de nuevo.');}finally{setBusy(false);}
 };
 const google=async()=>{
  if(!supabase||googleLock.current||!googleEnabled)return;
  googleLock.current=true;setBusy(true);setNotice('');setPassword('');
  try{
   if(Platform.OS==='web'){const destination=await startGoogleSignIn(supabase.auth,process.env.EXPO_PUBLIC_SUPABASE_URL!);window.location.assign(destination);}
   else await signInWithGoogleNative(supabase.auth,process.env.EXPO_PUBLIC_SUPABASE_URL!);
  }
  catch(error){setNotice(error instanceof Error?error.message:'No se pudo abrir Google.');}
  finally{googleLock.current=false;setBusy(false);}
 };
 const save=async()=>{
  if(!session||!supabase)return;
  if(!profileReady){setNotice('Primero pulsa Reintentar carga para recuperar tu perfil.');return;}
  const normalizedUsername=username.trim().replace(/^@/,'').toLowerCase();
  if(!name.trim()){setNotice('Escribe tu nombre para guardar el perfil.');return;}
  if(!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)){setNotice('El usuario debe tener entre 3 y 24 letras, números o guion bajo, sin espacios. Ejemplo: daniel_perez.');return;}
  setBusy(true);setNotice('');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{const {data,error}=await supabase.from('profiles').upsert({id:session.user.id,display_name:name.trim(),username:normalizedUsername,bio:bio.trim()},{onConflict:'id'}).select('display_name,username,bio').abortSignal(controller.signal).single();
   if(error){setNotice(error.code==='23505'?'Ese usuario ya está ocupado. Elige otro.':error.code==='42501'?'Tu sesión no tiene acceso. Cierra sesión y vuelve a entrar.':'No se pudo guardar. Reintenta; si continúa, cierra sesión y vuelve a entrar.');}
   else if(data){setName(data.display_name);setUsername(data.username);setBio(data.bio);onProfileChange(data);onProfileStatus?.('complete');setNotice('Perfil guardado en tu cuenta.');}
  }catch{setNotice('La conexión tardó demasiado o no está disponible. Vuelve a intentar guardar.');}finally{clearTimeout(timer);setBusy(false);}
 };
 const button=(text:string,onPress:()=>void,disabled=false,primary=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={onPress} style={[primary?ui.button:ui.secondary,(disabled||busy)&&{opacity:.5}]}><Text style={ui.buttonText}>{text}</Text></Pressable>;
 if(!supabase)return <Text style={styles.note}>La conexión de cuentas aún no está configurada.</Text>;
 if(loading)return <Text style={styles.note}>Cargando tu cuenta…</Text>;
 if(session&&onboarding)return <View style={styles.box}><Text style={styles.accountLabel}>PASO 1</Text><Text style={styles.title}>Elige cómo te van a ver.</Text><Text style={styles.note}>Solo necesitamos un nombre y un usuario para empezar.</Text>
 <Text style={styles.label}>Nombre</Text><TextInput editable={profileReady&&!busy} accessibilityLabel="Tu nombre" value={name} onChangeText={setName} maxLength={80} placeholder="Cómo te llamas" placeholderTextColor={p.muted} style={styles.input}/>
 <Text style={styles.label}>@usuario</Text><TextInput editable={profileReady&&!busy} accessibilityLabel="Tu usuario" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={25} placeholder="daniel_perez" placeholderTextColor={p.muted} style={styles.input}/>
 <Text style={styles.note}>De 3 a 24 letras, números o guion bajo, sin espacios.</Text>
 {!!notice&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}>{notice}</Text>}
 {button(profileLoading?'Cargando…':busy?'Guardando…':'Continuar',save,profileLoading,true)}
 {!profileReady&&!profileLoading&&button('Reintentar carga',()=>setLoadAttempt(n=>n+1))}
 {button('Cerrar sesión',async()=>{setBusy(true);try{const {error}=await supabase!.auth.signOut();if(error)setNotice('No se pudo cerrar la sesión. Intenta de nuevo.');}catch{setNotice('No hay conexión.');}finally{setBusy(false);}})}
 </View>;
 if(session&&!editing)return <View style={styles.collapsed}><View style={{flex:1,minWidth:0}}><Text style={styles.accountLabel}>TU CUENTA</Text><Text style={styles.compactNote}>Nombre y @usuario</Text></View><Pressable accessibilityRole="button" disabled={busy} onPress={()=>setEditingUser(session.user.id)} style={styles.editButton}><Text style={styles.editText}>Editar perfil</Text></Pressable></View>;
 return <View style={styles.box}><Text style={styles.accountLabel}>{session?'TU CUENTA':'ÚNETE AL PLAN'}</Text><Text style={styles.title}>{session?'Editar perfil':signup?'Crea tu cuenta':'Entra a tu cuenta'}</Text>
 {session?<><Text style={styles.note}>Tu perfil se guarda en la nube. Las reseñas y stories se guardan en la nube; los mensajes de texto son privados entre ambas cuentas.</Text>
 <Text style={styles.label}>Nombre</Text><TextInput editable={profileReady&&!busy} accessibilityLabel="Nombre del perfil" value={name} onChangeText={setName} maxLength={80} style={styles.input}/>
 <Text style={styles.label}>@usuario</Text><TextInput editable={profileReady&&!busy} accessibilityLabel="Usuario del perfil" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={25} style={styles.input}/>
 <Text style={styles.note}>Puedes escribir el usuario con @ y mayúsculas; lo guardaremos en minúsculas.</Text>
 {!!notice&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}>{notice}</Text>}
 {button(profileLoading?'Cargando perfil…':busy?'Guardando…':'Guardar perfil',save,profileLoading,true)}
 {!profileReady&&!profileLoading&&button('Reintentar carga',()=>setLoadAttempt(n=>n+1))}
 {button('Cerrar sesión',async()=>{setBusy(true);try{const {error}=await supabase!.auth.signOut();if(error)setNotice('No se pudo cerrar la sesión. Intenta de nuevo.');}catch{setNotice('No hay conexión.');}finally{setBusy(false);}})}
 {!settings&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>setEditingUser(null)} style={styles.secondary}><Text style={styles.secondaryText}>Cerrar edición del perfil</Text></Pressable>}
 {legalReady&&<Link href="/delete-account" style={styles.legal}>Eliminar cuenta</Link>}
 </>:<><Text style={styles.note}>Necesitas una cuenta para entrar. Regístrate gratis en un minuto.</Text>
 {googleEnabled&&<><Pressable accessibilityRole="button" disabled={busy} onPress={google} style={[googleStyles.button,busy&&{opacity:.5}]}><Text style={googleStyles.text}>Continuar con Google</Text></Pressable><Text style={styles.note}>Usa la misma cuenta de Google cada vez. Si ya tienes una cuenta aquí, utiliza el mismo correo para conservar tu perfil.</Text><Text style={styles.label}>O entra con tu correo</Text></>}
 {googleRetry&&button('Reintentar opciones de acceso',()=>setProviderAttempt(n=>n+1))}
 <Text style={styles.label}>Correo</Text><TextInput accessibilityLabel="Correo de la cuenta" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={styles.input}/>
 <Text style={styles.label}>Contraseña</Text><TextInput accessibilityLabel="Contraseña de la cuenta" value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} secureTextEntry style={styles.input}/>
 {button(busy?'Conectando…':signup?'Crear cuenta':'Iniciar sesión',action,false,true)}
 {!signup&&button('Olvidé mi contraseña',()=>{setPassword('');router.push('/forgot-password');})}
 {button(signup?'Ya tengo cuenta':'Quiero registrarme',()=>{setSignup(!signup);setNotice('');setPassword('');})}</>}
 {!session&&!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
 {legalReady&&<><Text style={styles.note}>Consulta cómo se usa tu información y las reglas de esta beta.</Text><Link href="/privacy" style={styles.legal}>Aviso de privacidad</Link><Link href="/terms" style={styles.legal}>Condiciones de la beta</Link></>}
 </View>;
}
const styles=StyleSheet.create({legal:{fontSize:14,color:p.violet,textDecorationLine:'underline',marginTop:14},feedback:{fontSize:14,lineHeight:22,color:p.ink,fontWeight:'600',padding:12,backgroundColor:p.violetSoft,borderRadius:12,marginTop:12},box:{padding:18,borderRadius:20,backgroundColor:p.surface,borderWidth:1,borderColor:p.line,marginBottom:18},accountLabel:{fontSize:10,fontWeight:'700',letterSpacing:1.5,color:p.violet,marginBottom:8},title:{fontSize:25,fontWeight:'800',letterSpacing:-.5,color:p.ink},note:{fontSize:13,lineHeight:21,color:p.muted,marginVertical:10},label:{fontSize:12,fontWeight:'600',color:p.ink,marginTop:14,marginBottom:8},input:{backgroundColor:p.soft,minHeight:48,padding:14,borderRadius:13,color:p.ink,fontSize:16},button:{backgroundColor:p.ink,borderRadius:14,minHeight:48,padding:15,marginTop:12,alignItems:'center'},buttonText:{color:p.onDark,fontWeight:'700'},collapsed:{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:18,borderWidth:1,borderColor:p.line,backgroundColor:p.surface,marginBottom:14},compactNote:{fontSize:12,lineHeight:18,color:p.muted},editButton:{minHeight:44,padding:12,borderRadius:12,backgroundColor:p.lime,justifyContent:'center'},editText:{fontSize:12,fontWeight:'700',color:p.ink},secondary:{minHeight:44,justifyContent:'center',alignItems:'center',marginTop:10},secondaryText:{fontSize:13,color:p.muted,fontWeight:'600'}});




