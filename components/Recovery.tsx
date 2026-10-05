import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,Pressable,ScrollView,StyleSheet,KeyboardAvoidingView,Platform} from 'react-native';
import {router} from 'expo-router';
import {supabase,recoveryAccess} from '../lib/supabase';
import {requestRecovery,changeRecoveredPassword,RecoveryAccessError,RecoveryConnectionError} from '../lib/passwordRecovery';

function RecoveryButton({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}){
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,disabled&&s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
function Frame({children}:{children:React.ReactNode}){
 return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}><View style={s.card}><Text style={s.brand}>por ahí ↗</Text>{children}</View></ScrollView></KeyboardAvoidingView>;
}
export function ForgotPassword(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[cooldown,setCooldown]=useState(0);
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
 const send=async()=>{
  if(!supabase||lock.current||cooldown)return;
  lock.current=true;setBusy(true);setNotice('');
  try{const message=await requestRecovery(supabase.auth,email);if(alive.current){setNotice(message);setCooldown(60);}}
  catch(error){if(alive.current){setNotice(error instanceof Error?error.message:'No se pudo enviar la solicitud.');if(!/correo válido/.test((error as Error).message))setCooldown(60);}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 return <Frame><Text accessibilityRole="header" style={s.title}>Recupera tu cuenta</Text><Text style={s.note}>Escribe el correo con el que te registraste. Te enviaremos un enlace para elegir una nueva contraseña.</Text>
 <Text style={s.label}>Correo</Text><TextInput accessibilityLabel="Correo para recuperar la cuenta" value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={254} style={s.input}/>
 {!!notice&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
 {!supabase&&<Text style={s.notice}>La conexión de cuentas no está disponible.</Text>}
 <RecoveryButton label={busy?'Enviando…':cooldown?`Puedes solicitar otro en ${cooldown} s`:'Enviar enlace de recuperación'} onPress={send} disabled={!supabase||busy||cooldown>0}/>
 <Text style={s.note}>Abre el enlace en tu navegador. También funciona en Safari de tu iPhone.</Text>
 <RecoveryButton label="Volver a mi cuenta" onPress={()=>router.replace('/?account=1')} disabled={busy}/></Frame>;
}

export function ResetPassword(){
 const [state,setState]=useState<'checking'|'ready'|'invalid'|'retry'|'done'>('checking'),[attempt,setAttempt]=useState(0);
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false),alive=useRef(true),needsReload=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  let active=true;
  recoveryAccess.validate().then(()=>{if(active)setState('ready');}).catch(error=>{if(active){needsReload.current=error instanceof RecoveryConnectionError&&error.needsReload;setState(error instanceof RecoveryAccessError?'invalid':'retry');setNotice(error instanceof Error?error.message:'No se pudo comprobar el enlace.');}});
  return()=>{active=false;};
 },[attempt]);
 useEffect(()=>{
  if(!supabase)return;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'&&!lock.current){setPassword('');setConfirmation('');setState('invalid');setNotice('Solicita un nuevo enlace para recuperar tu cuenta.');}});
  return()=>subscription.unsubscribe();
 },[]);
 const save=async()=>{
  if(!supabase||lock.current||state!=='ready')return;
  lock.current=true;setBusy(true);setNotice('');
  try{const message=await changeRecoveredPassword(supabase.auth,recoveryAccess,password,confirmation);if(alive.current){setPassword('');setConfirmation('');setNotice(message);setState('done');}}
  catch(error){if(alive.current){setNotice(error instanceof Error?error.message:'No se pudo cambiar la contraseña.');if(error instanceof RecoveryAccessError){setPassword('');setConfirmation('');setState('invalid');}else if(error instanceof Error&&error.message.startsWith('No se pudo confirmar')){setPassword('');setConfirmation('');setState('invalid');}}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 const abandon=()=>{recoveryAccess.clear();setPassword('');setConfirmation('');router.replace('/?account=1');};
 return <Frame><Text accessibilityRole="header" style={s.title}>{state==='done'?'Tu cuenta está lista':'Elige una nueva contraseña'}</Text>
 {state==='checking'?<Text style={s.note}>Comprobando tu enlace…</Text>:state==='ready'?<>
 <Text style={s.note}>Usa al menos 8 caracteres. Una combinación de palabras, números y símbolos es una buena opción.</Text>
 <Text style={s.label}>Nueva contraseña</Text><TextInput accessibilityLabel="Nueva contraseña" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={128} style={s.input}/>
 <Text style={s.label}>Confirma la nueva contraseña</Text><TextInput accessibilityLabel="Confirmar nueva contraseña" value={confirmation} onChangeText={setConfirmation} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={128} style={s.input}/>
 </>:state!=='done'&&<Text style={s.note}>Por seguridad, necesitas un enlace vigente del correo. Elige «Solicitar nuevo enlace» si venció o ya lo usaste.</Text>}
 {!!notice&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
 {state==='ready'&&<RecoveryButton label={busy?'Actualizando…':'Guardar nueva contraseña'} onPress={save} disabled={busy}/>}
 {state==='retry'&&<RecoveryButton label="Reintentar" onPress={()=>{if(needsReload.current&&Platform.OS==='web'){window.location.reload();return;}setNotice('');setState('checking');setAttempt(n=>n+1);}}/>}
 {(state==='invalid'||state==='retry')&&<RecoveryButton label="Solicitar nuevo enlace" onPress={()=>router.replace('/forgot-password')}/>}
 <RecoveryButton label={state==='done'?'Volver e iniciar sesión':'Volver a por ahí'} onPress={abandon} disabled={busy}/>
 </Frame>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#fbf9f3'},container:{flexGrow:1,paddingHorizontal:20,paddingTop:60,paddingBottom:36,alignItems:'center',justifyContent:'center'},card:{width:'100%',maxWidth:460,backgroundColor:'#eef1e8',padding:24,borderRadius:22},brand:{fontSize:25,fontWeight:'800',color:'#243d31',marginBottom:24},title:{fontSize:24,fontWeight:'700',color:'#243d31'},note:{fontSize:14,lineHeight:22,color:'#536350',marginVertical:14},label:{fontSize:14,color:'#334b3b',marginTop:12,marginBottom:8},input:{padding:15,borderRadius:12,backgroundColor:'#fff',color:'#243d31',fontSize:16},notice:{fontSize:14,lineHeight:22,color:'#243d31',backgroundColor:'#fff',borderRadius:12,padding:14,marginTop:16},button:{backgroundColor:'#965337',padding:15,borderRadius:12,marginTop:14,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'600',fontSize:14},disabled:{opacity:.5}});
