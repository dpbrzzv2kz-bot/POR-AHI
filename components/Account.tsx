import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';

export type Profile={display_name:string;username:string|null;bio:string};
export default function Account({onProfileChange}:{onProfileChange:(profile:Profile|null)=>void}){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false);
 const [name,setName]=useState(''),[username,setUsername]=useState(''),[bio,setBio]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[profileReady,setProfileReady]=useState(false);
 const [profileLoading,setProfileLoading]=useState(false),[loadAttempt,setLoadAttempt]=useState(0);
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let active=true;
  supabase.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setLoading(false);if(error)setNotice('No se pudo recuperar tu sesión. Intenta entrar de nuevo.');}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setLoading(false);setPassword('');}});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setProfileReady(false);setProfileLoading(!!session);setNotice('');onProfileChange(null);
  if(session&&supabase){
   const timer=setTimeout(()=>controller.abort(),15000);
   (async()=>{try{
    const {data,error}=await supabase!.from('profiles').select('display_name,username,bio').eq('id',session.user.id).abortSignal(controller.signal).maybeSingle();
    if(!active)return;
    if(error)throw error;
    setName(data?.display_name||'');setUsername(data?.username||'');setBio(data?.bio||'');setProfileReady(true);onProfileChange(data);
   }catch{if(active)setNotice('No se pudo cargar tu perfil. Pulsa Reintentar carga.');}
   finally{clearTimeout(timer);if(active)setProfileLoading(false);}})();
   return()=>{active=false;clearTimeout(timer);controller.abort();};
  }
  setName('');setUsername('');setBio('');
  return()=>{active=false;controller.abort();};
 },[session?.user.id,loadAttempt,onProfileChange]);
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
   else if(data){setName(data.display_name);setUsername(data.username);setBio(data.bio);onProfileChange(data);setNotice('Perfil guardado en tu cuenta.');}
  }catch{setNotice('La conexión tardó demasiado o no está disponible. Vuelve a intentar guardar.');}finally{clearTimeout(timer);setBusy(false);}
 };
 const button=(text:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={onPress} style={[styles.button,(disabled||busy)&&{opacity:.5}]}><Text style={styles.buttonText}>{text}</Text></Pressable>;
 if(!supabase)return <Text style={styles.note}>La conexión de cuentas aún no está configurada.</Text>;
 if(loading)return <Text style={styles.note}>Cargando tu cuenta…</Text>;
 return <View style={styles.box}><Text style={styles.title}>{session?'Tu cuenta real':signup?'Crea tu cuenta':'Entra a tu cuenta'}</Text>
 {session?<><Text style={styles.note}>Tu perfil se guarda en la nube. Las reseñas y stories se guardan en la nube; los mensajes siguen siendo de prueba.</Text>
 <Text style={styles.label}>Nombre</Text><TextInput editable={profileReady&&!busy} accessibilityLabel="Nombre del perfil" value={name} onChangeText={setName} maxLength={80} style={styles.input}/>
 <Text style={styles.label}>@usuario</Text><TextInput editable={profileReady&&!busy} accessibilityLabel="Usuario del perfil" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={25} style={styles.input}/>
 <Text style={styles.label}>Sobre ti</Text><TextInput editable={profileReady&&!busy} accessibilityLabel="Biografía del perfil" value={bio} onChangeText={setBio} multiline maxLength={300} style={styles.input}/>
 <Text style={styles.note}>Puedes escribir el usuario con @ y mayúsculas; lo guardaremos en minúsculas.</Text>
 {!!notice&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.feedback}>{notice}</Text>}
 {button(profileLoading?'Cargando perfil…':busy?'Guardando…':'Guardar perfil',save,profileLoading)}
 {!profileReady&&!profileLoading&&button('Reintentar carga',()=>setLoadAttempt(n=>n+1))}
 {button('Cerrar sesión',async()=>{setBusy(true);try{const {error}=await supabase!.auth.signOut();if(error)setNotice('No se pudo cerrar la sesión. Intenta de nuevo.');}catch{setNotice('No hay conexión.');}finally{setBusy(false);}})}
 </>:<><Text style={styles.note}>Puedes explorar sin cuenta. Regístrate para guardar tu perfil.</Text>
 <Text style={styles.label}>Correo</Text><TextInput accessibilityLabel="Correo de la cuenta" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={styles.input}/>
 <Text style={styles.label}>Contraseña</Text><TextInput accessibilityLabel="Contraseña de la cuenta" value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} secureTextEntry style={styles.input}/>
 {button(busy?'Conectando…':signup?'Crear cuenta':'Iniciar sesión',action)}
 {button(signup?'Ya tengo cuenta':'Quiero registrarme',()=>{setSignup(!signup);setNotice('');setPassword('');})}</>}
 {!session&&!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
 </View>;
}
const styles=StyleSheet.create({feedback:{fontSize:14,lineHeight:22,color:'#243d31',fontWeight:'600',padding:12,backgroundColor:'#fff',borderRadius:10,marginTop:12},box:{padding:18,borderRadius:18,backgroundColor:'#eef1e8',marginBottom:18},title:{fontSize:23,fontWeight:'700',color:'#243d31'},note:{fontSize:13,lineHeight:21,color:'#536350',marginVertical:10},label:{fontSize:13,color:'#334b3b',marginTop:14,marginBottom:8},input:{backgroundColor:'#fff',padding:14,borderRadius:12,color:'#243d31',fontSize:15},button:{backgroundColor:'#965337',borderRadius:12,padding:15,marginTop:12,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'600'}});




