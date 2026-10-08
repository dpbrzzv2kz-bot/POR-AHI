import React from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import PeopleSearch from './PeopleSearch';

import type useDiscovery from '../lib/useDiscovery';
import type {Review} from '../lib/posts';
import type {PublicProfile} from '../lib/social';
import {palette as p} from '../lib/theme';
import Icon from './Icon';

export default function DiscoverySearch({mode,setMode,search,openPerson,renderReview}:{mode:'Reseñas'|'Personas';setMode:(mode:'Reseñas'|'Personas')=>void;search:ReturnType<typeof useDiscovery>;openPerson:(person:PublicProfile)=>void;renderReview:(review:Review)=>React.ReactNode}){
 return <View><View style={s.box}><View style={s.modeRow}>{(['Reseñas','Personas'] as const).map(item=><Pressable key={item} accessibilityRole="button" accessibilityLabel={'Buscar '+item.toLowerCase()} accessibilityState={{selected:mode===item}} onPress={()=>setMode(item)} style={[s.mode,mode===item&&s.selected]}><Icon name={item==='Reseñas'?'search':'profile'} size={19} color={mode===item?p.onDark:p.muted}/><Text style={[s.label,mode===item&&s.selectedText]}>{item}</Text></Pressable>)}</View></View>
 {mode==='Personas'?<PeopleSearch open={openPerson}/>:<>
 <View style={s.box}><View style={s.searchField}><Icon name="search" color={p.muted} size={21}/><TextInput accessibilityLabel="Buscar reseñas por lugar" value={search.query} onChangeText={search.setQuery} placeholder="Busca un lugar" placeholderTextColor={p.muted} maxLength={80} autoCapitalize="none" returnKeyType="search" style={s.input}/></View>
 
 {(search.loading||(!search.error&&!search.reviews.length))&&<Text accessibilityLiveRegion="polite" style={s.note}>{search.loading?'Buscando reseñas…':'No encontramos reseñas. Prueba con otro lugar.'}</Text>}
 {!!search.error&&<><Text accessibilityRole="alert" style={s.error}>{search.error}</Text><Pressable accessibilityRole="button" onPress={search.retry} style={s.button}><Text style={s.label}>Reintentar búsqueda</Text></Pressable></>}
 </View>{search.reviews.map(renderReview)}
 {search.nextOffset!==null&&!search.error&&<View style={s.box}><Pressable accessibilityRole="button" disabled={search.loading} onPress={search.more} style={s.button}><Text style={s.label}>{search.loading?'Cargando…':'Ver más reseñas'}</Text></Pressable></View>}
 </>}
 </View>;
}
const s=StyleSheet.create({box:{paddingHorizontal:20,paddingVertical:12},kicker:{fontSize:11,letterSpacing:2,fontWeight:'700',color:p.violet,marginTop:14},title:{fontSize:34,lineHeight:39,fontWeight:'900',letterSpacing:-1.3,color:p.ink,marginVertical:12},modeRow:{flexDirection:'row',gap:6,padding:5,backgroundColor:p.soft,borderRadius:18,marginTop:10},mode:{flex:1,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',paddingVertical:13,borderRadius:13,minHeight:46},choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:8},chip:{paddingHorizontal:14,paddingVertical:12,borderRadius:14,backgroundColor:p.surface,borderWidth:1,borderColor:p.line,minHeight:44},selected:{backgroundColor:p.ink,borderColor:p.ink},label:{fontSize:13,color:p.muted,fontWeight:'600'},selectedText:{color:p.onDark},searchField:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,backgroundColor:p.surface,borderRadius:17,borderWidth:1,borderColor:p.line,minHeight:56},input:{flex:1,minWidth:0,paddingVertical:17,color:p.ink,fontSize:16},note:{fontSize:12,lineHeight:18,color:p.muted,marginVertical:10},filterTitle:{color:p.ink,fontSize:14,fontWeight:'700',marginTop:8},format:{paddingHorizontal:14,paddingVertical:12,borderRadius:14,minHeight:44},formatSelected:{backgroundColor:p.violetSoft},formatText:{color:p.violet},button:{padding:14,minHeight:46,borderRadius:14,backgroundColor:p.lime,alignItems:'center'},error:{color:p.error,fontSize:14,marginBottom:12}});
