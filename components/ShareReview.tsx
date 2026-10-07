import React from 'react';
import {Platform,Pressable,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import {deliverReviewLink,reviewLink,type ShareableReview,type SharingTransport} from '../lib/reviewSharing';
export default function ShareReview({review,close}:{review:ShareableReview;close:()=>void}){
 const [busy,setBusy]=React.useState(false),[notice,setNotice]=React.useState('');
 const lock=React.useRef(false),alive=React.useRef(true);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const send=async(action:'share'|'copy')=>{
  if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  const transport:SharingTransport=Platform.OS==='web'?{
   share:typeof navigator!=='undefined'&&typeof navigator.share==='function'?data=>navigator.share(data):undefined,
   copy:typeof navigator!=='undefined'&&navigator.clipboard?url=>navigator.clipboard.writeText(url):undefined,
  }:{share:async data=>{const result=await Share.share(Platform.OS==='ios'?{message:data.text,url:data.url}:{title:data.title,message:data.text+'\n'+data.url});if(result.action===Share.dismissedAction)return 'dismissed';}};
  try{
   const result=await deliverReviewLink(review,action,transport);
   if(alive.current)setNotice(result==='copied'?'Enlace copiado. Pégalo donde quieras.':result==='manual'?'Selecciona el enlace de abajo y cópialo.':result==='cancelled'?'Compartir cancelado.':'Puedes volver a la reseña.');
  }catch(e){if(alive.current)setNotice(e instanceof Error?e.message:'No se pudo preparar el enlace.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 return <View style={s.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={s.button}><Text style={s.buttonText}>Volver a la reseña</Text></Pressable>
  <Text style={s.title}>Comparte este plan.</Text><Text style={s.place}>{review.place}</Text><Text style={s.body}>{review.author}</Text>
  <Text style={s.body}>Quien reciba el enlace podrá ver la foto o video y abrir los detalles sin tener cuenta.</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>send('share')} style={[s.button,busy&&s.disabled]}><Text style={s.buttonText}>{busy?'Preparando enlace…':'Compartir enlace'}</Text></Pressable>
  {Platform.OS==='web'&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>send('copy')} style={[s.secondary,busy&&s.disabled]}><Text style={s.secondaryText}>Copiar enlace</Text></Pressable>}
  {!!notice&&<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>}
  <Text style={s.label}>Enlace de la reseña</Text>
  {Platform.OS==='web'?<TextInput accessibilityLabel="Enlace de la reseña" value={reviewLink(review)} editable={false} selectTextOnFocus style={s.input}/>:<Text selectable style={s.input}>{reviewLink(review)}</Text>}
 </ScrollView></View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#faf9f5'},content:{padding:22,paddingTop:Platform.OS==='ios'?60:30,width:'100%',maxWidth:590,alignSelf:'center'},title:{fontSize:30,lineHeight:36,fontWeight:'700',color:'#243d31',marginTop:26,marginBottom:18},place:{fontSize:22,fontWeight:'600',color:'#243d31'},body:{fontSize:15,lineHeight:24,color:'#536350',marginVertical:14},button:{padding:16,borderRadius:12,backgroundColor:'#965337',marginVertical:6,alignItems:'center',minHeight:48},buttonText:{fontSize:14,color:'#fff',fontWeight:'700'},secondary:{padding:16,borderRadius:12,backgroundColor:'#e6ecdf',marginVertical:6,alignItems:'center',minHeight:48},secondaryText:{fontSize:14,color:'#334b3b',fontWeight:'700'},label:{fontSize:12,color:'#52614e',marginTop:26,marginBottom:10},input:{padding:15,borderRadius:12,backgroundColor:'#e9eee4',color:'#243d31',fontSize:12},notice:{fontSize:14,lineHeight:22,color:'#334b3b',marginTop:18},disabled:{opacity:.5}});
