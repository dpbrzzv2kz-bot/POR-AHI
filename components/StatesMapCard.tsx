import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Image,Pressable,Modal,ScrollView,StyleSheet,Platform} from 'react-native';
import {loadVisitedPoints} from '../lib/posts';
import type {VisitedPoint} from '../lib/regionsMapHtml';
import {palette as p} from '../lib/theme';
import Icon from './Icon';
import StatesMap from './StatesMap';
import type {StatesMapResult} from './statesMapTypes';
import {passportProgress} from '../lib/passport';
import {shareMapImage} from '../lib/shareMap';
import Passport from './Passport';

export type MapOwner={name:string;handle?:string;avatarUri?:string|null};
// Nombres en español de los países más comunes; el resto se muestra como viene en el mapa (inglés).
const countryEs:Record<string,string>={'Mexico':'México','United States of America':'Estados Unidos','Spain':'España','France':'Francia','Canada':'Canadá','Japan':'Japón','Italy':'Italia','Germany':'Alemania','United Kingdom':'Reino Unido','Brazil':'Brasil','Peru':'Perú','Netherlands':'Países Bajos','Belgium':'Bélgica','Switzerland':'Suiza','Greece':'Grecia','Turkey':'Turquía','Russia':'Rusia','South Korea':'Corea del Sur','New Zealand':'Nueva Zelanda','Dominican Republic':'República Dominicana','Panama':'Panamá','Egypt':'Egipto','Morocco':'Marruecos','South Africa':'Sudáfrica','Thailand':'Tailandia','Philippines':'Filipinas','Ireland':'Irlanda','Sweden':'Suecia','Norway':'Noruega','Denmark':'Dinamarca','Finland':'Finlandia','Poland':'Polonia','Czechia':'Chequia','Hungary':'Hungría','Croatia':'Croacia','Cuba':'Cuba','Argentina':'Argentina','Colombia':'Colombia','Chile':'Chile','Ecuador':'Ecuador','Uruguay':'Uruguay','Costa Rica':'Costa Rica','Guatemala':'Guatemala','Portugal':'Portugal','Austria':'Austria','Australia':'Australia','China':'China','India':'India','Indonesia':'Indonesia','Israel':'Israel'};
const stateEs:Record<string,string>={'Distrito Federal':'Ciudad de México'};
const country=(name:string)=>countryEs[name]||name;
const state=(name:string)=>stateEs[name]||name;
const number=(value:number)=>value.toLocaleString('es-MX');

// Tarjeta negra del perfil: mapa del mundo con los estados donde esa persona ha reseñado un lugar, pintados de lima,
// y cuántos son del total del mapa ("3 / 4,242"). Al tocarla se abre a pantalla completa, con la foto y el nombre de la
// persona, para moverlo, acercarlo y ver el avance por país. Cuenta estados con reseñas con ubicación; no prueba que haya estado ahí.
export default function StatesMapCard({userId,own,person,refreshKey=0,onProgress}:{userId:string;own:boolean;person:MapOwner;refreshKey?:number;onProgress?:(result:StatesMapResult)=>void}){
 const [points,setPoints]=useState<VisitedPoint[]>([]),[result,setResult]=useState<StatesMapResult|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const [passportOpen,setPassportOpen]=useState(false),[exportRequest,setExportRequest]=useState(0),[sharing,setSharing]=useState(false),[shareNote,setShareNote]=useState('');
 const pending=useRef(0),timeout=useRef<ReturnType<typeof setTimeout>|null>(null),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;if(timeout.current)clearTimeout(timeout.current);};},[]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  Promise.resolve().then(()=>{if(active){if(timeout.current){clearTimeout(timeout.current);timeout.current=null;}pending.current=0;setSharing(false);setExportRequest(0);setLoaded(false);setError('');setResult(null);setPoints([]);setPassportOpen(false);setShareNote('');}});
  loadVisitedPoints(userId,controller.signal).then(rows=>{if(active){setPoints(rows);setLoaded(true);}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'No se pudo cargar el mapa.');setLoaded(true);}});
  return()=>{active=false;controller.abort();};
 },[userId,refreshKey]);
 const count=result?.count??0,total=result?.total??0;
 const rank=passportProgress(count);
 function receiveResult(value:StatesMapResult){setResult(value);onProgress?.(value);}
 function finishShare(message:string){if(timeout.current){clearTimeout(timeout.current);timeout.current=null;}pending.current=0;if(active.current){setSharing(false);setShareNote(message);}}
 function beginShare(){
  if(sharing||!loaded||!result||error)return;
  const request=Date.now();pending.current=request;setShareNote('');setSharing(true);setExportRequest(request);
  timeout.current=setTimeout(()=>{if(pending.current===request)finishShare('El mapa tardó en crear la imagen. Intenta otra vez.');},12000);
 }
 async function receiveImage(png:string,request:number){
  if(pending.current!==request)return;
  if(timeout.current){clearTimeout(timeout.current);timeout.current=null;}
  try{const action=await shareMapImage(png);if(pending.current===request)finishShare(action==='downloaded'?'Imagen descargada. Ya puedes compartirla.':'');}
  catch(e){if(pending.current===request)finishShare(e instanceof Error?e.message:'No se pudo compartir el mapa.');}
 }
 const progress=loaded&&result?<><Text style={s.count}>{number(count)}</Text><Text style={s.total}> / {number(total)}</Text></>:<Text style={s.count}>…</Text>;
 const initial=(person.name[0]||'?').toUpperCase();
 return <View style={s.card}>
  <View style={s.head}><Text style={s.kicker}>ESTADOS RESEÑADOS</Text><Text accessibilityLabel={number(count)+' de '+number(total)+' estados y regiones'}>{progress}</Text></View>
  <View style={s.map}>
   <StatesMap points={points} onResult={receiveResult} shareOwner={{name:person.name,handle:person.handle,rank:rank.current.name}} exportRequest={exportRequest} onExport={(png,request)=>{void receiveImage(png,request);}} onExportError={(message,request)=>{if(pending.current===request)finishShare(message);}}/>
   <Pressable accessibilityRole="button" accessibilityLabel={'Ver en grande el mapa de estados de '+person.name} onPress={()=>setOpen(true)} style={StyleSheet.absoluteFill}/>
  </View>
  {!!error&&<Text accessibilityRole="alert" style={s.note}>{error}</Text>}
  {loaded&&!error&&count===0&&<Text style={s.note}>{own?'Cuando publiques una reseña con ubicación, su estado se pinta aquí.':'Todavía no ha reseñado lugares con ubicación.'}</Text>}
  {loaded&&!error&&count>0&&<Text style={s.hint}>Toca el mapa para verlo en grande</Text>}
  <View style={extras.actions}><View style={{flex:1}}><Text style={extras.rankLabel}>RANGO {rank.level} / 10</Text><Text style={extras.rank}>{loaded&&result?rank.current.name:'Cargando…'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={'Abrir pasaporte de '+person.name} disabled={!loaded||!result||!!error} onPress={()=>setPassportOpen(true)} style={extras.passport}><Text style={extras.passportText}>Pasaporte ↗</Text></Pressable></View>
  <Pressable accessibilityRole="button" disabled={sharing||!loaded||!result||!!error} accessibilityLabel="Compartir una imagen de este mapa" onPress={beginShare} style={[extras.share,(sharing||!loaded||!result||!!error)&&{opacity:0.5}]}><Text style={extras.shareText}>{sharing?'Creando imagen…':'Compartir mapa ↗'}</Text></Pressable>
  {!!shareNote&&<Text accessibilityRole="alert" style={s.note}>{shareNote}</Text>}
  <Passport visible={passportOpen} onClose={()=>setPassportOpen(false)} name={person.name} stamps={result?.regions??[]}/>
  <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}>
   <View style={s.screen}>
    <View style={s.top}>
     <View style={s.avatar}>{person.avatarUri?<Image accessibilityLabel={'Foto de '+person.name} source={{uri:person.avatarUri}} style={{width:46,height:46,borderRadius:16}}/>:<Text style={s.initial}>{initial}</Text>}</View>
     <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.name}>{person.name}</Text>{!!person.handle&&<Text numberOfLines={1} style={s.handle}>@{person.handle}</Text>}</View>
     <Pressable accessibilityRole="button" accessibilityLabel="Cerrar mapa" onPress={()=>setOpen(false)} style={s.close}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" color="#FFFFFF" size={26}/></View></Pressable>
    </View>
    <View style={s.titleRow}><Text style={s.kicker}>ESTADOS RESEÑADOS</Text><Text>{progress}</Text></View>
    <View style={{flex:1,backgroundColor:'#0B0B0F'}}>{open&&<StatesMap points={points} expanded/>}</View>
    {!!result?.countries.length&&<ScrollView style={s.list} contentContainerStyle={{paddingHorizontal:16,paddingVertical:12,gap:12}}>
     {result.countries.map(item=><View key={item.a}>
      <View style={s.row}><Text style={s.country}>{country(item.a)}</Text><Text style={s.rowCount}>{item.v} / {item.t}</Text></View>
      <View style={s.track}><View style={[s.fill,{width:(Math.max(3,Math.min(100,item.v/Math.max(1,item.t)*100))+'%') as `${number}%`}]}/></View>
      <Text style={s.names}>{item.names.map(state).join(' · ')}</Text>
     </View>)}
    </ScrollView>}
   </View>
  </Modal>
 </View>;
}
const extras=StyleSheet.create({actions:{flexDirection:'row',gap:12,alignItems:'center',marginTop:16},rankLabel:{color:p.darkMuted,fontSize:8,fontWeight:'800',letterSpacing:1.4},rank:{color:p.lime,fontSize:16,fontWeight:'900',marginTop:5},passport:{minHeight:44,paddingHorizontal:13,borderWidth:1,borderColor:'#D4FF3850',borderRadius:15,alignItems:'center',justifyContent:'center'},passportText:{color:p.lime,fontWeight:'800',fontSize:11},share:{minHeight:44,marginTop:12,borderRadius:15,backgroundColor:'#FFFFFF0D',alignItems:'center',justifyContent:'center'},shareText:{color:p.onDark,fontSize:12,fontWeight:'700'}});
const s=StyleSheet.create({card:{marginHorizontal:16,marginBottom:4,padding:16,borderRadius:25,backgroundColor:p.ink},head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},kicker:{color:p.darkMuted,fontSize:10,fontWeight:'700',letterSpacing:2},count:{color:p.lime,fontSize:22,fontWeight:'900'},total:{color:p.darkMuted,fontSize:14,fontWeight:'700'},map:{width:'100%',aspectRatio:360/142,borderRadius:14,overflow:'hidden',backgroundColor:'#0B0B0F'},note:{color:p.darkMuted,fontSize:12,lineHeight:18,marginTop:12},hint:{color:p.darkMuted,fontSize:11,marginTop:10,textAlign:'center'},screen:{flex:1,backgroundColor:p.ink},top:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:Platform.OS==='ios'?58:16,paddingHorizontal:16,paddingBottom:12},avatar:{width:46,height:46,borderRadius:16,backgroundColor:p.lime,alignItems:'center',justifyContent:'center',overflow:'hidden'},initial:{fontSize:20,fontWeight:'900',color:p.ink},name:{color:'#fff',fontSize:18,fontWeight:'900'},handle:{color:p.lime,fontSize:13,fontWeight:'600',marginTop:2},close:{width:46,height:46,alignItems:'center',justifyContent:'center'},titleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:10},list:{maxHeight:230,borderTopWidth:1,borderColor:'#FFFFFF20'},row:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between'},country:{color:'#fff',fontSize:15,fontWeight:'800'},rowCount:{color:p.lime,fontSize:14,fontWeight:'900'},track:{height:5,borderRadius:3,backgroundColor:'#2A2A33',marginTop:7,overflow:'hidden'},fill:{height:5,borderRadius:3,backgroundColor:p.lime},names:{color:p.darkMuted,fontSize:12,lineHeight:18,marginTop:7}});
