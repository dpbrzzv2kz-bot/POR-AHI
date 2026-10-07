import React from 'react';
import {View,Text,Pressable,StyleSheet,Platform} from 'react-native';
import {palette as p} from '../lib/theme';
import Icon from './Icon';

export function Brand(){return <View style={s.brand}><Text style={s.wordmark}>por ahí</Text><View style={s.mark}><Icon name="arrow" size={18}/></View></View>;}
export default function ScreenHeader({close,label='Cerrar',disabled=false}:{close:()=>void;label?:string;disabled?:boolean}){
 return <View style={s.header}><View style={s.inner}><Brand/><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={close} style={[s.close,disabled&&{opacity:.5}]}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" size={21}/></View><Text numberOfLines={2} style={s.closeText}>{label}</Text></Pressable></View></View>;
}
const s=StyleSheet.create({header:{backgroundColor:p.surface,borderBottomWidth:1,borderColor:p.line,paddingTop:Platform.OS==='ios'?58:12,paddingHorizontal:18,paddingBottom:10},inner:{width:'100%',maxWidth:590,alignSelf:'center',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},brand:{flexDirection:'row',alignItems:'center',gap:7},wordmark:{color:p.ink,fontSize:24,fontWeight:'900',letterSpacing:-1.2},mark:{width:26,height:26,borderRadius:8,backgroundColor:p.lime,transform:[{rotate:'-7deg'}],alignItems:'center',justifyContent:'center'},close:{minHeight:44,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:4,maxWidth:'48%'},closeText:{fontSize:11,lineHeight:16,fontWeight:'600',color:p.muted,flexShrink:1}});
