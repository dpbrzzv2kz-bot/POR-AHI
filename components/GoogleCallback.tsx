import {useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,ScrollView,StyleSheet,Platform} from 'react-native';
import {router} from 'expo-router';
import {googleCallback,supabase} from '../lib/supabase';
import {finishGoogleSignIn,GoogleConnectionError} from '../lib/googleSignIn';

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
 return <ScrollView contentContainerStyle={s.screen}><View style={s.card}><Text style={s.brand}>por ahí ↗</Text><Text accessibilityRole="header" style={s.title}>{state==='checking'?'Entrando a tu cuenta…':'Acceso con Google'}</Text>
 <Text accessibilityRole={notice?'alert':undefined} accessibilityLiveRegion="polite" style={s.note}>{notice||'Estamos comprobando tu sesión para abrir tu perfil.'}</Text>
 {state==='retry'&&<Pressable accessibilityRole="button" style={s.button} onPress={()=>{if(needsReload.current&&Platform.OS==='web'){window.location.reload();return;}setNotice('');setState('checking');setAttempt(n=>n+1);}}><Text style={s.buttonText}>Reintentar</Text></Pressable>}
 <Pressable accessibilityRole="button" style={s.button} onPress={()=>router.replace('/?account=1')}><Text style={s.buttonText}>Volver a mi cuenta</Text></Pressable>
 </View></ScrollView>;
}
const s=StyleSheet.create({screen:{flexGrow:1,padding:24,backgroundColor:'#fbf9f3',alignItems:'center',justifyContent:'center'},card:{width:'100%',maxWidth:460,padding:24,borderRadius:22,backgroundColor:'#eef1e8'},brand:{fontSize:25,fontWeight:'800',color:'#243d31',marginBottom:24},title:{fontSize:23,fontWeight:'700',color:'#243d31'},note:{fontSize:14,lineHeight:22,color:'#536350',marginVertical:16},button:{backgroundColor:'#965337',borderRadius:12,padding:15,marginTop:12,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'600'}});
