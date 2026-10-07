import {useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,ScrollView,StyleSheet,Platform} from 'react-native';
import {router} from 'expo-router';
import {googleCallback,supabase} from '../lib/supabase';
import {finishGoogleSignIn,GoogleConnectionError} from '../lib/googleSignIn';
import {palette as p} from '../lib/theme';
import ui from '../lib/uiStyles';
import {Brand} from './ScreenHeader';

export default function GoogleCallback(){
 const [attempt,setAttempt]=useState(0),[notice,setNotice]=useState(''),[state,setState]=useState<'checking'|'retry'|'error'>('checking');
 const needsReload=useRef(false);
 useEffect(()=>{
  let active=true;
  finishGoogleSignIn(supabase?.auth||null,googleCallback).then(()=>{if(active)router.replace('/?account=1');}).catch(error=>{
   if(!active)return;
   needsReload.current=error instanceof GoogleConnectionError&&error.needsReload;
   setState(error instanceof GoogleConnectionError?'retry':'error');
   setNotice(error instanceof Error?error.message:'No se completó el acceso con Google.');
   if(Platform.OS==='web'&&googleCallback==='error')window.history.replaceState(null,'','/auth/google');
  });
  return()=>{active=false;};
 },[attempt]);
 return <ScrollView contentContainerStyle={s.screen}><View style={s.card}><View style={{marginBottom:28}}><Brand/></View><Text accessibilityRole="header" style={s.title}>{state==='checking'?'Entrando a tu cuenta…':'Acceso con Google'}</Text>
 <Text accessibilityRole={notice?'alert':undefined} accessibilityLiveRegion="polite" style={s.note}>{notice||'Estamos comprobando tu sesión para abrir tu perfil.'}</Text>
 {state==='retry'&&<Pressable accessibilityRole="button" style={s.button} onPress={()=>{if(needsReload.current&&Platform.OS==='web'){window.location.reload();return;}setNotice('');setState('checking');setAttempt(n=>n+1);}}><Text style={s.buttonText}>Reintentar</Text></Pressable>}
 <Pressable accessibilityRole="button" style={ui.secondary} onPress={()=>router.replace('/?account=1')}><Text style={s.buttonText}>Volver a mi cuenta</Text></Pressable>
 </View></ScrollView>;
}
const s=StyleSheet.create({...ui,screen:{flexGrow:1,padding:24,backgroundColor:p.canvas,alignItems:'center',justifyContent:'center'},card:{width:'100%',maxWidth:460,padding:24,borderRadius:26,backgroundColor:p.surface,borderWidth:1,borderColor:p.line}});
