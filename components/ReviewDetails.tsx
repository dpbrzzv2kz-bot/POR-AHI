import React,{useState} from 'react';
import {View,Text,ScrollView,Pressable,StyleSheet,Platform} from 'react-native';
import type {Review} from '../lib/posts';
import {palette as p} from '../lib/theme';
import Icon from './Icon';

type Props={review:Review;close:()=>void;manage?:()=>void;report?:()=>void;block?:()=>void};
// Detalle simple: título, detalles y dirección del lugar. Guardar, compartir y reaccionar viven en la tarjeta.
// Las acciones de seguridad (eliminar la propia, reportar, bloquear) se conservan detrás de "Más opciones". Las reseñas no se editan.
export default function ReviewDetails({review,close,manage,report,block}:Props){
 const [more,setMore]=useState(false);
 return <View style={s.backdrop}><Pressable accessibilityRole="button" accessibilityLabel="Cerrar detalles" onPress={close} style={{flex:1}}/>
  <View style={s.sheet}><View style={s.handle}/>
   <View style={s.heading}><Pressable accessibilityRole="button" accessibilityLabel="Cerrar detalles" onPress={close} style={s.close}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" size={23}/></View></Pressable></View>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={s.title}>{review.place}</Text>
    <View style={s.box}><Text style={s.label}>DETALLES</Text><Text style={s.body}>{review.text||'Sin detalles.'}</Text></View>
    {!!review.address&&<View style={s.box}><Text style={s.label}>DIRECCIÓN</Text><Text style={s.body}>{review.address}</Text></View>}
    {!!(manage||report||block)&&<>
     <Pressable accessibilityRole="button" accessibilityState={{expanded:more}} onPress={()=>setMore(value=>!value)} style={s.textButton}><Text style={s.controlText}>{more?'Menos opciones':'Más opciones'}</Text></Pressable>
     {more&&<View style={s.safety}>
      {manage&&<Pressable accessibilityRole="button" onPress={manage} style={s.textButton}><Text style={s.controlText}>Eliminar mi reseña</Text></Pressable>}
      {report&&<Pressable accessibilityRole="button" onPress={report} style={s.textButton}><Text style={s.controlText}>Reportar publicación</Text></Pressable>}
      {block&&<Pressable accessibilityRole="button" onPress={block} style={s.textButton}><Text style={s.controlText}>Bloquear autor</Text></Pressable>}
     </View>}
    </>}
   </ScrollView>
  </View>
 </View>;
}
const s=StyleSheet.create({backdrop:{flex:1,backgroundColor:'#17171C88'},sheet:{maxHeight:'86%',backgroundColor:p.surface,borderTopLeftRadius:28,borderTopRightRadius:28,paddingBottom:Platform.OS==='ios'?24:8,width:'100%',maxWidth:590,alignSelf:'center'},handle:{width:42,height:4,backgroundColor:p.line,borderRadius:4,alignSelf:'center',marginTop:12},heading:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',paddingHorizontal:14,paddingTop:2},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},content:{padding:22,paddingTop:2},title:{fontSize:30,lineHeight:35,fontWeight:'900',letterSpacing:-.9,color:p.ink,marginBottom:20},box:{padding:17,borderRadius:18,backgroundColor:p.soft,marginBottom:14},label:{fontSize:9,fontWeight:'800',letterSpacing:1.4,color:p.muted,marginBottom:9},body:{fontSize:15,lineHeight:25,color:p.ink},safety:{flexDirection:'row',flexWrap:'wrap',gap:10},textButton:{minHeight:44,justifyContent:'center',paddingHorizontal:4},controlText:{fontSize:11,fontWeight:'600',color:p.muted}});
