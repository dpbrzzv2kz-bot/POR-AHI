import React,{useState} from 'react';
import {View,Text,ScrollView,StyleSheet} from 'react-native';
import type {Media} from '../lib/posts';
import {palette as p} from '../lib/theme';

// Varias fotos o videos en una publicación: se desliza a la derecha, con contador "2/5" arriba a la derecha.
// Llena el contenedor que lo contiene (que debe tener alto propio). Cada pieza se dibuja con renderItem.
export default function MediaPager({items,renderItem}:{items:Media[];renderItem:(item:Media,index:number,active:boolean)=>React.ReactNode}){
 const [width,setWidth]=useState(0),[index,setIndex]=useState(0);
 return <View style={StyleSheet.absoluteFill} onLayout={event=>setWidth(event.nativeEvent.layout.width)}>
  {width>0&&<ScrollView horizontal pagingEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill} onMomentumScrollEnd={event=>setIndex(Math.max(0,Math.min(items.length-1,Math.round(event.nativeEvent.contentOffset.x/width))))}>
   {items.map((item,i)=><View key={i+item.uri} style={{width,height:'100%'}}>{renderItem(item,i,i===index)}</View>)}
  </ScrollView>}
  {items.length>1&&<View pointerEvents="none" accessible accessibilityLabel={'Archivo '+(index+1)+' de '+items.length} style={s.badge}><Text style={s.badgeText}>{index+1}/{items.length}</Text></View>}
 </View>;
}
const s=StyleSheet.create({badge:{position:'absolute',top:12,right:12,paddingHorizontal:10,height:26,borderRadius:13,backgroundColor:'rgba(0,0,0,.55)',alignItems:'center',justifyContent:'center'},badgeText:{color:p.onDark,fontSize:12,fontWeight:'800'}});
