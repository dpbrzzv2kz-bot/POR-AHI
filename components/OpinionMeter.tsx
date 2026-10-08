import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {summarizeOpinion} from '../lib/opinions';
import {palette as p} from '../lib/theme';

type Props={likes?:number;tomatoes?:number;compact?:boolean;dark?:boolean;scope?:'review'|'place'};

export default function OpinionMeter({likes,tomatoes,compact=false,dark=false,scope='review'}:Props){
 const opinion=summarizeOpinion(likes,tomatoes),loaded=typeof likes==='number'&&Number.isFinite(likes)&&typeof tomatoes==='number'&&Number.isFinite(tomatoes);
 const title=scope==='place'?'Opinión del lugar':'Opinión de esta reseña';
 const foreground=dark?p.onDark:p.ink,muted=dark?p.darkMuted:p.muted;
 const label=loaded?`${title}. ${opinion.likes} corazones y ${opinion.tomatoes} tomates.`:`${title}. Cargando opiniones.`;
 return <View accessible accessibilityLabel={label} style={[s.container,compact&&s.compact,dark&&s.dark]}>
  <View style={s.heading}><Text style={[s.scope,{color:muted}]}>{title}</Text>{!loaded&&<Text style={[s.level,{color:foreground}]}>Cargando…</Text>}</View>
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.track,{backgroundColor:dark?'#FFFFFF24':p.soft}]}>
   {loaded&&opinion.positiveRatio!==null&&<><View style={[s.positive,{flex:opinion.positiveRatio}]}/><View style={[s.negative,{flex:1-opinion.positiveRatio,backgroundColor:dark?'#FF7187':p.error}]}/></>}
  </View>
  {!compact&&<View style={s.counts}><Text style={[s.count,{color:foreground}]}>♥ {loaded?opinion.likes:'—'}</Text><Text style={[s.count,{color:muted}]}>{loaded?`${opinion.total} ${opinion.total===1?'reacción':'reacciones'}`:'—'}</Text><Text style={[s.count,{color:foreground}]}>🍅 {loaded?opinion.tomatoes:'—'}</Text></View>}
 </View>;
}

const s=StyleSheet.create({container:{paddingHorizontal:14,paddingVertical:11,gap:8},compact:{paddingHorizontal:0,paddingVertical:5,gap:6},dark:{backgroundColor:'rgba(23,23,28,.86)',borderRadius:12,paddingHorizontal:11,paddingVertical:9},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'},scope:{fontSize:10,fontWeight:'600'},level:{fontSize:11,fontWeight:'800'},track:{height:5,borderRadius:4,overflow:'hidden',flexDirection:'row'},positive:{backgroundColor:p.lime,minWidth:0},negative:{minWidth:0},counts:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},count:{fontSize:10,fontWeight:'700'}});
