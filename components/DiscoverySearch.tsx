import React from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import PeopleSearch from './PeopleSearch';
import {reviewCategories,reviewFormats} from '../lib/discovery';
import type useDiscovery from '../lib/useDiscovery';
import type {Review} from '../lib/posts';
import type {PublicProfile} from '../lib/social';

export default function DiscoverySearch({mode,setMode,search,openPerson,renderReview}:{mode:'Reseñas'|'Personas';setMode:(mode:'Reseñas'|'Personas')=>void;search:ReturnType<typeof useDiscovery>;openPerson:(person:PublicProfile)=>void;renderReview:(review:Review)=>React.ReactNode}){
 return <View><View style={s.box}><Text style={s.title}>Descubre tu próximo plan.</Text><View style={s.choices}>{(['Reseñas','Personas'] as const).map(item=><Pressable key={item} accessibilityRole="button" accessibilityLabel={'Buscar '+item.toLowerCase()} accessibilityState={{selected:mode===item}} onPress={()=>setMode(item)} style={[s.chip,mode===item&&s.selected]}><Text style={[s.label,mode===item&&s.selectedText]}>{item}</Text></Pressable>)}</View></View>
 {mode==='Personas'?<PeopleSearch open={openPerson}/>:<>
 <View style={s.box}><TextInput accessibilityLabel="Buscar reseñas por lugar" value={search.query} onChangeText={search.setQuery} placeholder="Nombre del lugar" placeholderTextColor="#7a8479" maxLength={80} autoCapitalize="none" returnKeyType="search" style={s.input}/><Text style={s.note}>Busca lugares mencionados en reseñas de la comunidad.</Text>
 <Text style={s.filterTitle}>¿Qué te gustaría hacer?</Text><View style={s.choices}>{reviewCategories.map(item=><Pressable key={item} accessibilityRole="button" accessibilityLabel={'Categoría '+item} accessibilityState={{selected:search.category===item}} onPress={()=>search.setCategory(item)} style={[s.chip,search.category===item&&s.selected]}><Text style={[s.label,search.category===item&&s.selectedText]}>{item}</Text></Pressable>)}</View>
 <View style={s.choices}>{reviewFormats.map(item=><Pressable key={item} accessibilityRole="button" accessibilityLabel={'Formato '+item} accessibilityState={{selected:search.format===item}} onPress={()=>search.setFormat(item)} style={[s.chip,search.format===item&&s.selected]}><Text style={[s.label,search.format===item&&s.selectedText]}>{item}</Text></Pressable>)}</View>
 {!!(search.query||search.category!=='Todas'||search.format!=='Todos')&&<Pressable accessibilityRole="button" onPress={()=>{search.setQuery('');search.setCategory('Todas');search.setFormat('Todos');}} style={s.button}><Text style={s.label}>Limpiar filtros</Text></Pressable>}
 <Text accessibilityLiveRegion="polite" style={s.note}>{search.loading?'Buscando reseñas…':search.error?'':!search.reviews.length?'No encontramos reseñas. Prueba otro lugar o cambia los filtros.':search.reviews.length+(search.reviews.length===1?' reseña mostrada':' reseñas mostradas')+(search.nextOffset!==null?' · hay más resultados':'')}</Text>
 {!!search.error&&<><Text accessibilityRole="alert" style={s.error}>{search.error}</Text><Pressable accessibilityRole="button" onPress={search.retry} style={s.button}><Text style={s.label}>Reintentar búsqueda</Text></Pressable></>}
 </View>{search.reviews.map(renderReview)}
 {search.nextOffset!==null&&!search.error&&<View style={s.box}><Pressable accessibilityRole="button" disabled={search.loading} onPress={search.more} style={s.button}><Text style={s.label}>{search.loading?'Cargando…':'Ver más reseñas'}</Text></Pressable></View>}
 </>}
 </View>;
}
const s=StyleSheet.create({box:{paddingHorizontal:22,paddingVertical:12},title:{fontSize:28,fontWeight:'700',color:'#243d31',marginVertical:12},choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:8},chip:{paddingHorizontal:14,paddingVertical:11,borderRadius:24,backgroundColor:'#e9eee4'},selected:{backgroundColor:'#8c5133'},label:{fontSize:13,color:'#243d31',fontWeight:'600'},selectedText:{color:'#fff'},input:{padding:15,borderRadius:12,backgroundColor:'#e9eee4',color:'#243d31'},note:{fontSize:13,color:'#536350',marginVertical:10},filterTitle:{color:'#243d31',fontSize:14,fontWeight:'600'},button:{padding:14,borderRadius:12,backgroundColor:'#e9eee4',alignItems:'center'},error:{color:'#8a4031',fontSize:14,marginBottom:12}});
