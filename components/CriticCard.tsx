import React,{useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {criticLevels,criticProfile} from '../lib/criticScore';
import {palette as p} from '../lib/theme';

// Confianza como crítico en el perfil: nivel con nombre y progreso, sin mostrar un número crudo.
export default function CriticCard({likes,tomatoes,own=false,failed=false,onRetry}:{likes?:number|null;tomatoes?:number|null;own?:boolean;failed?:boolean;onRetry?:()=>void}){
 const [open,setOpen]=useState(false);
 const loaded=typeof likes==='number'&&typeof tomatoes==='number';
 const profile=criticProfile(likes,tomatoes);
 return <View accessible accessibilityLabel={loaded?`Confianza como crítico: ${profile.level.name}. ${profile.hint}`:'Confianza como crítico: cargando'} style={s.card}>
  <View style={s.top}>
   <View style={{flex:1,minWidth:0}}>
    <Text style={s.kicker}>CONFIANZA COMO CRÍTICO</Text>
    <Text style={s.name}>{loaded?profile.level.name:failed?'No se pudo cargar':'Cargando…'}</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="¿Cómo se mide?" accessibilityState={{expanded:open}} onPress={()=>setOpen(value=>!value)} style={s.info}><Text style={s.infoText}>{open?'×':'?'}</Text></Pressable>
  </View>
  {failed&&!loaded&&<View><Text accessibilityRole="alert" style={s.hint}>No se pudieron cargar las reacciones de este perfil.</Text>{!!onRetry&&<Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}><Text style={s.retryText}>Reintentar</Text></Pressable>}</View>}
  {loaded&&<>
   <View style={s.steps}>{criticLevels.map((level,index)=><View key={level.key} style={[s.step,index<profile.rank&&{backgroundColor:profile.measured?p.lime:'#C9C9D3'}]}/>)}</View>
   <Text style={s.blurb}>{profile.level.blurb}</Text>
   <View style={s.track}><View style={[s.fill,{width:`${Math.round(profile.progress*100)}%` as `${number}%`}]}/></View>
   <Text style={s.hint}>{profile.hint}</Text>
  </>}
  {open&&<View style={s.explain}>
   <Text style={s.explainText}>Mide qué tan seguido la gente coincide {own?'contigo':'con esta persona'} (corazones) frente a quienes no (tomates).</Text>
   <Text style={s.explainText}>No depende de cuánto se publica ni de si la opinión es positiva o negativa: una crítica honesta puede ser confiable aunque no guste.</Text>
   <Text style={s.explainText}>Con menos de 20 reacciones no se calcula, y un buen resultado con pocas reacciones no cuenta tanto como uno respaldado por muchas.</Text>
  </View>}
 </View>;
}
const s=StyleSheet.create({
 card:{backgroundColor:p.surface,borderRadius:20,borderWidth:1,borderColor:p.line,padding:16,marginBottom:14},
 top:{flexDirection:'row',alignItems:'flex-start',gap:10},
 kicker:{fontSize:10,fontWeight:'800',letterSpacing:1.6,color:p.muted},
 name:{fontSize:22,fontWeight:'900',letterSpacing:-.5,color:p.ink,marginTop:4},
 info:{width:32,height:32,borderRadius:16,backgroundColor:p.soft,alignItems:'center',justifyContent:'center'},infoText:{fontSize:16,fontWeight:'900',color:p.ink,lineHeight:19},
 steps:{flexDirection:'row',gap:5,marginTop:12},step:{flex:1,height:6,borderRadius:3,backgroundColor:p.soft},
 blurb:{fontSize:13,lineHeight:19,color:p.ink,marginTop:10},
 track:{height:5,borderRadius:3,backgroundColor:p.soft,overflow:'hidden',marginTop:12},fill:{height:5,borderRadius:3,backgroundColor:p.violet},
 hint:{fontSize:12,lineHeight:18,color:p.muted,marginTop:8},
 retry:{alignSelf:'flex-start',minHeight:40,paddingHorizontal:16,borderRadius:20,backgroundColor:p.lime,justifyContent:'center',marginTop:8},retryText:{fontSize:13,fontWeight:'800',color:p.ink},explain:{marginTop:12,paddingTop:12,borderTopWidth:1,borderColor:p.line,gap:8},explainText:{fontSize:12,lineHeight:18,color:p.muted},
});
