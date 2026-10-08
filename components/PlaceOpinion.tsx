import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import type {Review} from '../lib/posts';
import type {PostStats} from '../lib/interactions';
import {supabase} from '../lib/supabase';
import {loadPlaceOpinion,type PlaceOpinionTotals} from '../lib/placeOpinions';
import {palette as p} from '../lib/theme';
import OpinionMeter from './OpinionMeter';

export default function PlaceOpinion({review,counts}:{review:Review;counts?:PostStats}){
 const [result,setResult]=useState<PlaceOpinionTotals|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const address=review.cloud&&!review.isShort?review.address:undefined;
 const reactionsKey=`${counts?.likes??''}:${counts?.tomatoes??''}`;
 useEffect(()=>{
  if(!address||!supabase)return;
  let active=true;const controller=new AbortController();
  Promise.resolve().then(()=>{if(active){setResult(null);setError('');}});
  const timer=setTimeout(()=>controller.abort(),15000);
  loadPlaceOpinion(supabase,address,controller.signal).then(data=>{if(active)setResult(data);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudo cargar la opinión.');}).finally(()=>clearTimeout(timer));
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[address,reactionsKey,attempt]);
 if(!address)return <OpinionMeter likes={counts?.likes} tomatoes={counts?.tomatoes}/>;
 return <View style={s.box}>
  {result?<><OpinionMeter likes={result.likes} tomatoes={result.tomatoes} scope="place"/><Text style={s.note}>{result.reviewCount} {result.reviewCount===1?'reseña':'reseñas'} de esta dirección · reacciones de la comunidad</Text></>:error?<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={s.retry}><Text style={s.retryText}>Reintentar</Text></Pressable></>:<Text style={s.note}>Cargando la opinión del lugar…</Text>}
 </View>;
}
const s=StyleSheet.create({box:{marginBottom:18},note:{fontSize:11,lineHeight:17,color:p.muted,marginTop:7},error:{fontSize:12,lineHeight:19,color:p.error},retry:{minHeight:44,justifyContent:'center'},retryText:{fontSize:12,fontWeight:'700',color:p.violet}});
