import React,{useCallback,useMemo,useState} from 'react';
import {View,Text,Pressable,StyleSheet,Platform} from 'react-native';
import {mapHtml,type PickedPlace} from '../lib/mapHtml';
import {palette as p} from '../lib/theme';
import Icon from './Icon';

// Marco común del selector de mapa (encabezado, lugar elegido y botón). La superficie del mapa la pone cada plataforma.
export type MapSurface=(props:{html:string;onRaw:(raw:string)=>void})=>React.ReactNode;
export type MapPickerProps={initial?:PickedPlace|null;onCancel:()=>void;onConfirm:(place:PickedPlace)=>void;confirmLabel?:string;cancelLabel?:string};
export default function MapPickerShell({initial,onCancel,onConfirm,surface,confirmLabel='Usar esta ubicación',cancelLabel='Cancelar'}:MapPickerProps&{surface:MapSurface}){
 const [picked,setPicked]=useState<PickedPlace|null>(initial||null);
 const html=useMemo(()=>mapHtml(initial),[]); // eslint-disable-line react-hooks/exhaustive-deps
 const onRaw=useCallback((raw:string)=>{
  try{
   const m=JSON.parse(raw);
   if(Number.isFinite(m.lat)&&Number.isFinite(m.lng)&&Math.abs(m.lat)<=90&&Math.abs(m.lng)<=180)setPicked({lat:m.lat,lng:m.lng,label:typeof m.label==='string'?m.label.slice(0,80):''});
  }catch{/* Mensaje que no es del mapa. */}
 },[]);
 return <View style={s.screen}>
  <View style={s.header}><Text style={s.title}>Elige el lugar</Text><Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onCancel} style={s.cancel}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" size={20}/></View><Text style={s.cancelText}>{cancelLabel}</Text></Pressable></View>
  <View style={{flex:1}}>{surface({html,onRaw})}</View>
  <View style={s.footer}>
   <Text numberOfLines={2} style={s.note}>{picked?(picked.label||'Lugar elegido en el mapa. Puedes arrastrar el pin.'):'Busca un lugar por nombre o toca el mapa para poner el pin.'}</Text>
   <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} disabled={!picked} onPress={()=>{if(picked)onConfirm(picked);}} style={[s.confirm,!picked&&{opacity:.4}]}><Text style={s.confirmText}>{confirmLabel}</Text></Pressable>
  </View>
 </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:p.canvas},header:{paddingTop:Platform.OS==='ios'?58:12,paddingHorizontal:18,paddingBottom:10,backgroundColor:p.surface,borderBottomWidth:1,borderColor:p.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:20,fontWeight:'900',letterSpacing:-.5,color:p.ink},cancel:{minHeight:44,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:5},cancelText:{fontSize:12,fontWeight:'600',color:p.muted},footer:{backgroundColor:p.surface,paddingHorizontal:20,paddingTop:12,paddingBottom:Platform.OS==='ios'?30:14,borderTopWidth:1,borderColor:p.line},note:{fontSize:12,lineHeight:18,color:p.muted,marginBottom:10},confirm:{minHeight:52,borderRadius:16,backgroundColor:p.lime,alignItems:'center',justifyContent:'center'},confirmText:{fontSize:14,fontWeight:'800',color:p.ink}});
