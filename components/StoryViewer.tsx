import React from 'react';
import {View,Text,Pressable,StyleSheet,Platform} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import type {Story} from '../lib/posts';
import {palette as p} from '../lib/theme';
import Icon from './Icon';

export default function StoryViewer({story,own,media,close,remove,report}:{story:Story;own:boolean;media:React.ReactNode;close:()=>void;remove:()=>void;report:()=>void}){
 const expires=new Date(story.expires).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return <View style={s.screen}><StatusBar style="light"/>
  <View style={s.header}><View style={s.headerInner}><View style={s.avatar}><Text style={s.initial}>{story.name[0]?.toUpperCase()||'↗'}</Text></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.name}>{story.name}</Text><Text style={s.label}>STORY · 24 HORAS</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar story" onPress={close} style={s.close}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" color={p.onDark} size={24}/></View></Pressable></View></View>
  <View style={s.media}>{media||<View style={s.placeholder}><Icon name="photos" color={p.darkMuted} size={42}/><Text style={s.note}>STORY DE EJEMPLO · SIN ARCHIVO</Text></View>}</View>
  <View style={s.footer}><View style={s.footerInner}><Text style={s.expiration}>Disponible hasta {expires}</Text><Pressable accessibilityRole="button" onPress={own?remove:report} style={s.action}><Text style={s.actionText}>{own?'Eliminar mi story':'Reportar story'}</Text></Pressable></View></View>
 </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:p.ink},header:{paddingTop:Platform.OS==='ios'?58:14,paddingBottom:14,paddingHorizontal:16},headerInner:{width:'100%',maxWidth:558,alignSelf:'center',flexDirection:'row',alignItems:'center',gap:10},avatar:{width:42,height:42,borderRadius:15,backgroundColor:p.lime,alignItems:'center',justifyContent:'center'},initial:{fontSize:19,fontWeight:'900',color:p.ink},name:{color:p.onDark,fontSize:15,fontWeight:'800'},label:{color:p.darkMuted,fontSize:9,letterSpacing:1.5,marginTop:5},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},media:{flex:1,width:'100%',maxWidth:590,alignSelf:'center',backgroundColor:'#0E0E12'},placeholder:{flex:1,justifyContent:'center',alignItems:'center',gap:18,padding:20},note:{fontSize:10,lineHeight:18,letterSpacing:1,color:p.darkMuted,textAlign:'center'},footer:{paddingHorizontal:20,paddingTop:15,paddingBottom:Platform.OS==='ios'?30:16},footerInner:{width:'100%',maxWidth:550,alignSelf:'center'},expiration:{fontSize:11,lineHeight:18,color:p.darkMuted,textAlign:'center'},action:{minHeight:44,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:'#FFFFFF25',borderRadius:14,marginTop:12},actionText:{fontSize:12,fontWeight:'600',color:p.onDark}});
