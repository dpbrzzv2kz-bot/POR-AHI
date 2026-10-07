import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {searchPeople,type PublicProfile} from '../lib/social';
import {palette as p} from '../lib/theme';
import Icon from './Icon';
export default function PeopleSearch({open}:{open:(person:PublicProfile)=>void}){
 const [query,setQuery]=useState(''),[people,setPeople]=useState<PublicProfile[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setPeople([]);
  const timer=setTimeout(async()=>{try{const rows=await searchPeople(query,controller.signal);if(active)setPeople(rows);}catch(e){if(active)setError(e instanceof Error?e.message:'No se pudo buscar.');}finally{if(active)setLoading(false);}},300);
  const deadline=setTimeout(()=>controller.abort(),15000);
  return()=>{active=false;clearTimeout(timer);clearTimeout(deadline);controller.abort();};
 },[query,attempt]);
 return <View style={s.box}><View style={s.searchField}><Icon name="search" size={21} color={p.muted}/><TextInput accessibilityLabel="Buscar personas" value={query} onChangeText={setQuery} placeholder="Nombre o @usuario" placeholderTextColor={p.muted} maxLength={80} autoCapitalize="none" style={s.input}/></View><Text style={s.note}>Encuentra a quienes recomiendan tus próximos planes.</Text>
 {loading?<Text style={s.note}>Buscando…</Text>:error?<><Text accessibilityRole="alert" style={s.note}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={s.row}><Text style={s.name}>Reintentar búsqueda</Text></Pressable></>:!people.length?<Text style={s.note}>No encontramos personas con esa búsqueda.</Text>:people.map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={'Abrir perfil de '+person.name} onPress={()=>open(person)} style={s.row}><View style={s.avatar}><Text style={s.initial}>{person.name[0]?.toUpperCase()}</Text></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.name}>{person.name}</Text><Text numberOfLines={1} style={s.handle}>@{person.handle}</Text></View><Icon name="arrow" size={19} color={p.muted}/></Pressable>)}
 </View>;
}
const s=StyleSheet.create({box:{paddingHorizontal:20,paddingVertical:12},searchField:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,borderRadius:17,backgroundColor:p.surface,borderWidth:1,borderColor:p.line,minHeight:56},input:{flex:1,minWidth:0,paddingVertical:17,color:p.ink,fontSize:16},note:{fontSize:12,lineHeight:19,color:p.muted,marginVertical:12},row:{paddingVertical:16,borderBottomWidth:1,borderColor:p.line,flexDirection:'row',gap:12,alignItems:'center'},avatar:{width:46,height:46,borderRadius:16,backgroundColor:p.violetSoft,alignItems:'center',justifyContent:'center'},initial:{fontSize:19,fontWeight:'800',color:p.violet},name:{fontSize:15,fontWeight:'700',color:p.ink},handle:{fontSize:12,color:p.muted,marginTop:4}});
