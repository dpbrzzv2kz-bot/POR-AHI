import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {searchPeople,type PublicProfile} from '../lib/social';
export default function PeopleSearch({open}:{open:(person:PublicProfile)=>void}){
 const [query,setQuery]=useState(''),[people,setPeople]=useState<PublicProfile[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;const controller=new AbortController();setLoading(true);setError('');setPeople([]);
  const timer=setTimeout(async()=>{try{const rows=await searchPeople(query,controller.signal);if(active)setPeople(rows);}catch(e){if(active)setError(e instanceof Error?e.message:'No se pudo buscar.');}finally{if(active)setLoading(false);}},300);
  const deadline=setTimeout(()=>controller.abort(),15000);
  return()=>{active=false;clearTimeout(timer);clearTimeout(deadline);controller.abort();};
 },[query,attempt]);
 return <View style={s.box}><Text style={s.title}>Descubre personas.</Text><TextInput accessibilityLabel="Buscar personas" value={query} onChangeText={setQuery} placeholder="Nombre o @usuario" placeholderTextColor="#7a8479" maxLength={80} autoCapitalize="none" style={s.input}/><Text style={s.note}>Perfiles de la comunidad. Busca por nombre o @usuario.</Text>
 {loading?<Text style={s.note}>Buscando…</Text>:error?<><Text accessibilityRole="alert" style={s.note}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={s.row}><Text>Reintentar búsqueda</Text></Pressable></>:!people.length?<Text style={s.note}>No encontramos personas con esa búsqueda.</Text>:people.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityLabel={'Abrir perfil de '+p.name} onPress={()=>open(p)} style={s.row}><Text style={s.name}>{p.name}</Text><Text style={s.note}>@{p.handle}</Text></Pressable>)}
 </View>;
}
const s=StyleSheet.create({box:{padding:22},title:{fontSize:30,fontWeight:'700',color:'#243d31',marginVertical:16},input:{padding:15,borderRadius:12,backgroundColor:'#e9eee4',color:'#243d31'},note:{fontSize:13,color:'#536350',marginVertical:10},row:{paddingVertical:18,borderBottomWidth:1,borderColor:'#e2e7d8'},name:{fontSize:16,fontWeight:'600',color:'#2c4434'}});
