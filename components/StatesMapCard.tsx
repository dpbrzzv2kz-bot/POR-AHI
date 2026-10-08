import React,{useEffect,useState} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {loadVisitedPoints} from '../lib/posts';
import type {VisitedPoint} from '../lib/regionsMapHtml';
import {palette as p} from '../lib/theme';
import StatesMap from './StatesMap';

// Tarjeta negra del perfil: mapa del mundo con los estados donde esa persona ha reseñado un lugar, pintados de lima.
// Cuenta estados con reseñas con ubicación; no prueba que la persona haya estado ahí.
export default function StatesMapCard({userId,own,refreshKey=0}:{userId:string;own:boolean;refreshKey?:number}){
 const [points,setPoints]=useState<VisitedPoint[]>([]),[count,setCount]=useState<number|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  Promise.resolve().then(()=>{if(active){setLoaded(false);setError('');}});
  loadVisitedPoints(userId,controller.signal).then(rows=>{if(active){setPoints(rows);setLoaded(true);}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'No se pudo cargar el mapa.');setLoaded(true);}});
  return()=>{active=false;controller.abort();};
 },[userId,refreshKey]);
 return <View style={s.card}>
  <View style={s.head}><Text style={s.kicker}>ESTADOS RESEÑADOS</Text><Text accessibilityLabel={(count??0)+' estados reseñados'} style={s.count}>{loaded&&count!==null?String(count):'…'}</Text></View>
  <View style={s.map}><StatesMap points={points} onCount={setCount}/></View>
  {!!error&&<Text accessibilityRole="alert" style={s.note}>{error}</Text>}
  {loaded&&!error&&count===0&&<Text style={s.note}>{own?'Cuando publiques una reseña con ubicación, su estado se pinta aquí.':'Todavía no ha reseñado lugares con ubicación.'}</Text>}
 </View>;
}
const s=StyleSheet.create({card:{marginHorizontal:16,marginBottom:4,padding:16,borderRadius:25,backgroundColor:p.ink},head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},kicker:{color:p.darkMuted,fontSize:10,fontWeight:'700',letterSpacing:2},count:{color:p.lime,fontSize:22,fontWeight:'900'},map:{width:'100%',aspectRatio:360/142,borderRadius:14,overflow:'hidden',backgroundColor:'#0B0B0F'},note:{color:p.darkMuted,fontSize:12,lineHeight:18,marginTop:12}});
