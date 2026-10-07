import React from 'react';
import {Platform,Pressable,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import {deliverReviewLink,reviewLink,type ShareableReview,type SharingTransport} from '../lib/reviewSharing';
import {palette as p} from '../lib/theme';
import ui from '../lib/uiStyles';
import ScreenHeader from './ScreenHeader';
import Icon from './Icon';
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
 return <View style={s.screen}><ScreenHeader close={close} label="Volver a la reseña" disabled={busy}/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <View style={s.symbol}><Icon name="arrow" size={38}/></View><Text style={s.kicker}>LOS PLANES SE COMPARTEN</Text><Text style={s.title}>{'Pásalo a\ntu gente.'}</Text><View style={s.card}><Text style={s.place}>{review.place}</Text><Text style={s.note}>{review.author}</Text></View>
  <Text style={s.body}>Quien reciba el enlace podrá ver la foto o video y abrir los detalles sin tener cuenta.</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>send('share')} style={[s.button,busy&&s.disabled]}><Text style={s.buttonText}>{busy?'Preparando enlace…':'Compartir enlace'}</Text></Pressable>
  {Platform.OS==='web'&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>send('copy')} style={[s.secondary,busy&&s.disabled]}><Text style={s.secondaryText}>Copiar enlace</Text></Pressable>}
  {!!notice&&<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>}
  <Text style={s.label}>Enlace de la reseña</Text>
  {Platform.OS==='web'?<TextInput accessibilityLabel="Enlace de la reseña" value={reviewLink(review)} editable={false} selectTextOnFocus style={s.input}/>:<Text selectable style={s.input}>{reviewLink(review)}</Text>}
 </ScrollView></View>;
}
const s=StyleSheet.create({...ui,symbol:{width:70,height:70,backgroundColor:p.lime,borderRadius:23,alignItems:'center',justifyContent:'center',marginTop:5,marginBottom:26,transform:[{rotate:'-6deg'}]},place:{fontSize:21,lineHeight:27,fontWeight:'800',letterSpacing:-.5,color:p.ink},input:{...ui.input,fontSize:12},disabled:{opacity:.5}});
