import React,{useEffect,useRef,useState} from 'react';
import {ScrollView,View,Text,TextInput,Pressable,StyleSheet,KeyboardAvoidingView,Platform} from 'react-native';
import {Link,router} from 'expo-router';
import {supabase} from '../lib/supabase';
import {deletionPending,deleteOwnAccount,DELETE_CONFIRMATION,type DeletionProgress} from '../lib/accountDeletion';
import {privacyContact} from '../lib/legalContent';
import useIdentity from '../lib/useIdentity';

export default function DeleteAccount(){
 const {id,ready}=useIdentity();
 const [loading,setLoading]=useState(true),[pending,setPending]=useState(false),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(0);
 const [confirmation,setConfirmation]=useState(''),[understood,setUnderstood]=useState(false),[busy,setBusy]=useState(false),[deleted,setDeleted]=useState(false),[stage,setStage]=useState<DeletionProgress>('starting');
 const lock=useRef(false),identity=useRef(id);
 useEffect(()=>{identity.current=id;},[id]);
 useEffect(()=>{
  let active=true;
  Promise.resolve().then(async()=>{
   if(!active)return;
   setConfirmation('');setUnderstood(false);setNotice('');setPending(false);setLoading(true);
   if(!ready)return;
   if(!id||!supabase){setLoading(false);return;}
   try{const value=await deletionPending(supabase);if(active)setPending(value);}
   catch(error){if(active)setNotice(error instanceof Error?error.message:'No se pudo consultar la cuenta.');}
   finally{if(active)setLoading(false);}
  });
  return()=>{active=false;};
 },[id,ready,attempt]);
 const remove=async()=>{
  if(lock.current||!supabase||!id||!understood||confirmation!==DELETE_CONFIRMATION)return;
  lock.current=true;setBusy(true);setNotice('');
  const startedId=id;
  try{
   await deleteOwnAccount(supabase,id,confirmation,{url:process.env.EXPO_PUBLIC_SUPABASE_URL!,key:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!},value=>{setStage(value);if(value==='files')setPending(true);});
   setDeleted(true);setConfirmation('');setUnderstood(false);
  }catch(error){if(identity.current===startedId)setNotice(error instanceof Error?error.message:'No se pudo completar. Reintenta la eliminación.');}
  finally{lock.current=false;setBusy(false);}
 };
 const button=(label:string,onPress:()=>void,disabled=false,danger=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,danger&&s.danger,disabled&&s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  {!busy&&<Link href="/?account=1" style={s.link}>← Volver a mi perfil</Link>}
  <Text accessibilityRole="header" style={s.title}>{deleted?'Cuenta eliminada':'Eliminar cuenta'}</Text>
  {deleted?<><Text style={s.body}>Se ha eliminado la cuenta de la base activa de Por Ahí y se han retirado sus archivos. El proceso no elimina tu cuenta de Google.</Text>{button('Volver a explorar',()=>router.replace('/'))}</>:<>
   <Text style={s.body}>Esto es permanente. Guarda una copia de lo que quieras conservar antes de continuar.</Text>
   <View style={s.warning}><Text style={s.heading}>Lo que se eliminará</Text><Text style={s.body}>Tu perfil, fotos, videos, reseñas, stories y su actividad asociada: likes, guardados, comentarios, seguimiento, avisos, bloqueos y reportes.</Text><Text style={s.body}>También desaparecerán tus conversaciones completas para ambas personas, incluidos los mensajes de la otra cuenta. Las copias que otras personas hayan descargado y los registros o respaldos de proveedores pueden permanecer fuera de la base activa.</Text></View>
   <Text style={s.body}>Por seguridad necesitas haber iniciado sesión en los últimos 10 minutos. La última persona administradora debe asignar otra antes de eliminar su cuenta.</Text>
   {loading?<Text style={s.body}>Comprobando tu cuenta…</Text>:!id?<>{button('Entrar a mi cuenta',()=>router.replace('/?account=1'))}<Text style={s.body}>También puedes solicitar ayuda a {privacyContact}.</Text></>:<>
    {pending&&<Text style={s.body}>Tu eliminación está pendiente. La cuenta no puede publicar mientras termina. Al reintentar se continuará con los archivos restantes; los ya retirados no se pueden recuperar.</Text>}
    {!notice||pending?<>
     <Pressable accessibilityRole="checkbox" accessibilityState={{checked:understood,disabled:busy}} disabled={busy} onPress={()=>setUnderstood(v=>!v)} style={s.check}><Text style={s.body}>{understood?'☑':'☐'} Entiendo que el borrado es irreversible y que las conversaciones desaparecerán para ambas personas.</Text></Pressable>
     <Text style={s.body}>Escribe ELIMINAR para confirmar:</Text><TextInput accessibilityLabel="Confirmación de eliminación" value={confirmation} onChangeText={setConfirmation} editable={!busy} autoCapitalize="characters" autoCorrect={false} maxLength={8} style={s.input}/>
     <Pressable accessibilityRole="button" disabled={busy||!understood||confirmation!==DELETE_CONFIRMATION} onPress={remove} style={[s.button,s.danger,(busy||!understood||confirmation!==DELETE_CONFIRMATION)&&s.disabled]}><Text style={s.buttonText}>{busy?stage==='files'?'Retirando archivos…':stage==='account'?'Eliminando cuenta…':'Comprobando acceso…':pending?'Reintentar eliminación':'Eliminar mi cuenta permanentemente'}</Text></Pressable>
    </>:button('Reintentar comprobación',()=>setAttempt(n=>n+1),busy)}
   </>}
   {!!notice&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{notice}</Text>}
   {!busy&&<><Text style={s.body}>Soporte y solicitudes de privacidad: {privacyContact}. No envíes contraseñas o códigos.</Text><Link href="/privacy" style={s.link}>Aviso de privacidad</Link><Link href="/terms" style={s.link}>Condiciones de la beta</Link></>}
  </>}
 </ScrollView></KeyboardAvoidingView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#fbf9f4'},content:{padding:24,paddingTop:45,paddingBottom:65,maxWidth:620,width:'100%',alignSelf:'center'},title:{fontSize:28,fontWeight:'700',color:'#243d31',marginTop:24},heading:{fontSize:17,fontWeight:'700',color:'#243d31'},body:{fontSize:15,lineHeight:24,color:'#334b3b',marginTop:16},warning:{padding:18,backgroundColor:'#fff0e9',borderRadius:14,marginTop:20},link:{fontSize:15,color:'#965337',textDecorationLine:'underline',marginTop:18},check:{marginTop:8},input:{borderWidth:1,borderColor:'#acb7a7',borderRadius:12,padding:14,fontSize:17,backgroundColor:'#fff',marginTop:12,color:'#243d31'},button:{backgroundColor:'#965337',padding:16,borderRadius:12,alignItems:'center',marginTop:18},danger:{backgroundColor:'#a53535'},disabled:{opacity:.4},buttonText:{color:'#fff',fontWeight:'600',fontSize:15},error:{backgroundColor:'#fff',color:'#a53535',padding:14,borderRadius:12,marginTop:18,lineHeight:23}});
