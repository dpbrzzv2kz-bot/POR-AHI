import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {supabase} from '../lib/supabase';
import {loadWeeklySummary,type WeeklySummary} from '../lib/weeklySummary';
import {palette as c} from '../lib/theme';

type Props={userId:string|null;refreshKey?:number|string};
const countText=(n:number,singular:string,plural:string)=>`${n} ${n===1?singular:plural}`;
export default function WeeklyRecap({userId,refreshKey}:Props){
 const [state,setState]=useState<{key:string;summary:WeeklySummary|null;error:string}>({key:'',summary:null,error:''});
 const [retry,setRetry]=useState(0),[openedFor,setOpenedFor]=useState<string|null>(null);
 const requestKey=JSON.stringify([userId,refreshKey,retry]);
 useEffect(()=>{
  if(!userId)return;
  const controller=new AbortController();
  let active=true;
  const request=supabase?loadWeeklySummary(supabase,userId,{signal:controller.signal}):Promise.reject(new Error('La conexión todavía no está configurada.'));
  request.then(summary=>{if(active)setState({key:requestKey,summary,error:''});}).catch(error=>{if(active)setState({key:requestKey,summary:null,error:error instanceof Error?error.message:'No se pudo cargar tu semana.'});});
  return ()=>{active=false;controller.abort();};
 },[userId,requestKey]);
 if(!userId)return null;
 const own=state.key===requestKey,summary=own?state.summary:null,loading=!own,error=own?state.error:'';
 const line=summary?summary.reviewCount?`Reseñaste ${countText(summary.newPlaceCount,'lugar nuevo','lugares nuevos')}`:'Tu próxima reseña empieza por ahí':loading?'Preparando tus últimos 7 días…':'Tu resumen necesita otro intento';
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel={error?'Reintentar resumen semanal':`Ver tu semana. ${line}`} disabled={loading} onPress={()=>error?setRetry(n=>n+1):setOpenedFor(requestKey)} style={s.card}>
   <View style={s.mark}><Text style={s.markText}>7</Text></View><View style={s.copy}><Text style={s.kicker}>TU SEMANA POR AHÍ</Text><Text style={s.line}>{line}</Text>{!!error&&<Text accessibilityRole="alert" style={s.retry}>Toca para reintentar</Text>}</View>{loading?<ActivityIndicator color={c.violet}/>:<Text style={s.arrow}>{error?'↻':'↗'}</Text>}
  </Pressable>
  <Modal visible={openedFor===requestKey&&!!summary&&own} animationType="slide" onRequestClose={()=>setOpenedFor(null)}>
   <SafeAreaView style={s.story}>
    <View style={s.top}><Text style={s.brand}>por ahí ↗</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar resumen semanal" onPress={()=>setOpenedFor(null)} style={s.close}><Text style={s.cross}>✕</Text></Pressable></View>
    <ScrollView contentContainerStyle={s.body}>
     <Text style={s.period}>ÚLTIMOS 7 DÍAS</Text><Text style={s.title}>{summary?.reviewCount?'Una semana con historia.':'El siguiente lugar te espera.'}</Text>
     <View style={s.numberBox}><Text style={s.number}>{summary?.newPlaceCount||0}</Text><Text style={s.numberCaption}>{summary?.newPlaceCount===1?'lugar nuevo reseñado':'lugares nuevos reseñados'}</Text></View>
     <Text style={s.detail}>{summary?.reviewCount?`Publicaste ${countText(summary.reviewCount,'reseña','reseñas')} sobre ${countText(summary.placeCount,'lugar','lugares')}. ${summary.newPlaceCount?'Tu colección de recomendaciones sigue creciendo.':'Volviste a recomendar lugares de tu historial. Eso también cuenta.'}`:'Cuando publiques una reseña, aparecerá aquí. Este resumen se arma con tus publicaciones, sin contar shorts.'}</Text>
     <Text style={s.note}>Los lugares nuevos se comparan con tu historial de reseñas. Los shorts no cuentan.</Text>
    </ScrollView>
    <Pressable accessibilityRole="button" onPress={()=>setOpenedFor(null)} style={s.done}><Text style={s.doneText}>A seguir por ahí ↗</Text></Pressable>
   </SafeAreaView>
  </Modal>
 </>;
}
const s=StyleSheet.create({
 card:{backgroundColor:c.surface,borderColor:c.line,borderWidth:1,borderRadius:20,padding:14,marginHorizontal:16,marginTop:4,marginBottom:16,flexDirection:'row',alignItems:'center',gap:12},mark:{width:44,height:44,borderRadius:14,backgroundColor:c.lime,alignItems:'center',justifyContent:'center',transform:[{rotate:'-7deg'}]},markText:{fontSize:24,fontWeight:'900',color:c.ink},copy:{flex:1},kicker:{fontSize:9,fontWeight:'800',letterSpacing:1.3,color:c.violet},line:{marginTop:4,fontSize:13,fontWeight:'700',color:c.ink,lineHeight:19},retry:{color:c.error,fontSize:11,marginTop:4},arrow:{fontSize:24,color:c.violet},
 story:{flex:1,backgroundColor:c.ink},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:24,paddingTop:12},brand:{fontSize:22,color:c.lime,fontWeight:'900'},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},cross:{color:c.onDark,fontSize:23},body:{flexGrow:1,justifyContent:'center',padding:28},period:{color:c.lime,fontSize:11,fontWeight:'800',letterSpacing:2},title:{fontSize:37,lineHeight:43,fontWeight:'900',color:c.onDark,marginTop:16,maxWidth:340},numberBox:{marginVertical:30,borderWidth:1,borderColor:'#44444F',borderRadius:28,padding:22,backgroundColor:'#232329',transform:[{rotate:'-3deg'}]},number:{fontSize:88,lineHeight:96,fontWeight:'900',color:c.lime},numberCaption:{fontSize:17,fontWeight:'700',color:c.onDark},detail:{fontSize:16,lineHeight:25,color:c.onDark},note:{color:c.darkMuted,fontSize:11,lineHeight:17,marginTop:24},done:{margin:24,marginTop:8,minHeight:52,borderRadius:18,backgroundColor:c.lime,alignItems:'center',justifyContent:'center'},doneText:{color:c.ink,fontSize:15,fontWeight:'800'},
});
