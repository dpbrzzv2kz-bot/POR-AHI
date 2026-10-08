import React,{useState} from 'react';
import {View,Text,Pressable,TextInput,KeyboardAvoidingView,StyleSheet,Platform} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {palette as p,categoryColor,categoryColors} from '../lib/theme';
import type {PickedPlace} from '../lib/mapHtml';
import type {UploadProgress} from '../lib/resumable';
import Icon from './Icon';
import {placeRatings} from '../lib/opinions';
import UploadStatus from './UploadStatus';
import MapPicker from './MapPicker';

type Props={busy:boolean;place:string;category:string;text:string;error:string;retry:boolean;progress:UploadProgress|null;preview:React.ReactNode;close:()=>void;publish:(location?:PickedPlace)=>void;pause:()=>void;setPlace:(value:string)=>void;setCategory:(value:string)=>void;setText:(value:string)=>void;location?:PickedPlace|null;setLocation?:(value:PickedPlace|null)=>void;short?:boolean;rating:number;setRating:(value:number)=>void};

// Reseña en pasos sobre la foto a pantalla completa: 1 título, 2 recomendación, 3 mapa (obligatorio, publica), 4 subida.
export default function ReviewFlow({busy,place,category,text,error,retry,progress,preview,close,publish,pause,setPlace,setCategory,setText,location,setLocation,short,rating,setRating}:Props){
 const [step,setStep]=useState<1|2|3|4>(1);
 const [titleError,setTitleError]=useState(''),[ratingError,setRatingError]=useState('');
 if(step===3)return <MapPicker initial={location} confirmLabel="Publicar" cancelLabel="Atrás" onCancel={()=>setStep(2)} onConfirm={chosen=>{setLocation?.(chosen);setStep(4);publish(chosen);}}/>;
 const nextFromTitle=()=>{if(place.trim().length<2){setTitleError('Escribe un título de al menos 2 letras.');return;}setTitleError('');setStep(2);};
 const nextFromRating=()=>{if(!rating){setRatingError('Elige cómo calificas el lugar.');return;}setRatingError('');setStep(3);};
 const publishShort=()=>{if(place.trim().length<2){setTitleError('Escribe un título de al menos 2 letras.');return;}setTitleError('');setStep(4);publish();};
 const publishLabel=busy?(progress?'Publicando…':'Preparando archivo…'):retry?'Reintentar publicación':short?'Publicar short':'Publicar reseña';
 return <View style={s.screen}><StatusBar style="light"/>
  <View style={StyleSheet.absoluteFill}>{preview}</View>
  <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,.28)'}]}/>
  <View style={s.top}>
   <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" disabled={busy} onPress={close} style={[s.round,busy&&{opacity:.4}]}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" color="#FFFFFF" size={24}/></View></Pressable>
   {!short&&<View style={s.dots} accessibilityLabel={'Paso '+Math.min(step,3)+' de 3'}>{[1,2,3].map(n=><View key={n} style={[s.dot,(step===4?3:step)>=n&&s.dotOn]}/>)}</View>}
  </View>
  <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.bottom} pointerEvents="box-none">
   <View style={s.panel}>
    {step===1&&<>
     <Text style={s.question}>Ponle un título</Text>
     <TextInput autoFocus accessibilityLabel="Título" placeholder="Escribe un título" placeholderTextColor="rgba(255,255,255,.55)" value={place} onChangeText={value=>{setPlace(value);if(titleError)setTitleError('');}} maxLength={100} returnKeyType="next" onSubmitEditing={nextFromTitle} style={s.titleInput}/>
     {!!titleError&&<Text accessibilityRole="alert" style={s.error}>{titleError}</Text>}
     <View style={s.chips}>{Object.keys(categoryColors).map(item=>{const on=category===item;return <Pressable key={item} accessibilityRole="button" accessibilityLabel={'Categoría '+item} accessibilityState={{selected:on}} onPress={()=>setCategory(item)} style={[s.chip,{borderColor:categoryColor(item)},on&&{backgroundColor:categoryColor(item)}]}><Text style={[s.chipText,on&&{color:p.ink}]}>{item}</Text></Pressable>;})}</View>
     <Pressable accessibilityRole="button" accessibilityLabel="Siguiente" onPress={short?publishShort:nextFromTitle} style={s.primary}><Text style={s.primaryText}>{short?'Publicar short':'Siguiente'}</Text><Icon name="arrow" size={22}/></Pressable>
    </>}
    {step===2&&<>
     <Text style={s.question}>¿Cómo calificas el lugar?</Text>
     <View style={s.chips}>{placeRatings.map(item=>{const on=rating===item.value;return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={item.value+' de 5, '+item.label} accessibilityState={{selected:on}} onPress={()=>{setRating(item.value);setRatingError('');}} style={[s.chip,{borderColor:p.lime},on&&{backgroundColor:p.lime}]}><Text style={[s.chipText,on&&{color:p.ink}]}>{'★'.repeat(item.value)} {item.label}</Text></Pressable>;})}</View>
     {!!ratingError&&<Text accessibilityRole="alert" style={s.error}>{ratingError}</Text>}
     <View style={s.row}><Text style={s.sub}>Tu recomendación</Text><Text style={s.optional}>OPCIONAL</Text></View>
     <TextInput autoFocus multiline accessibilityLabel="Tu recomendación" placeholder="¿Qué recomiendas? ¿Para quién vale la pena?" placeholderTextColor="rgba(255,255,255,.55)" value={text} onChangeText={setText} maxLength={1500} style={s.textInput}/>
     <Text style={s.counter}>{text.length}/1500</Text>
     <View style={s.buttons}>
      <Pressable accessibilityRole="button" accessibilityLabel="Atrás" onPress={()=>setStep(1)} style={s.secondary}><Text style={s.secondaryText}>Atrás</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Siguiente" onPress={nextFromRating} style={[s.primary,{flex:1}]}><Text style={s.primaryText}>Elegir ubicación</Text><Icon name="arrow" size={22}/></Pressable>
     </View>
    </>}
    {step===4&&<>
     {!!error&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
     {progress&&<View style={s.card}><UploadStatus value={progress}/></View>}
     {busy&&progress&&progress.phase!=='confirming'&&<Pressable accessibilityRole="button" onPress={pause} style={s.secondary}><Text style={s.secondaryText}>Pausar carga</Text></Pressable>}
     <Pressable accessibilityRole="button" accessibilityLabel={publishLabel} disabled={busy} onPress={()=>publish()} style={[s.primary,busy&&{opacity:.5}]}><Text style={s.primaryText}>{publishLabel}</Text><Icon name="arrow" size={22}/></Pressable>
     {!busy&&<Pressable accessibilityRole="button" accessibilityLabel="Volver al mapa" onPress={()=>setStep(short?1:3)} style={s.secondary}><Text style={s.secondaryText}>{short?'Volver':'Cambiar ubicación'}</Text></Pressable>}
    </>}
   </View>
  </KeyboardAvoidingView>
 </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#000'},top:{position:'absolute',left:14,right:14,top:Platform.OS==='ios'?58:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},round:{width:46,height:46,borderRadius:23,backgroundColor:'rgba(0,0,0,.5)',alignItems:'center',justifyContent:'center'},dots:{flexDirection:'row',gap:6,paddingHorizontal:12,height:30,borderRadius:15,backgroundColor:'rgba(0,0,0,.5)',alignItems:'center'},dot:{width:22,height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,.35)'},dotOn:{backgroundColor:p.lime},bottom:{position:'absolute',left:0,right:0,bottom:0},panel:{backgroundColor:'rgba(23,23,28,.88)',borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:20,paddingTop:20,paddingBottom:Platform.OS==='ios'?32:20},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},question:{color:'#fff',fontSize:22,fontWeight:'900',letterSpacing:-.5},sub:{color:'#fff',fontSize:15,fontWeight:'800'},optional:{color:p.lime,fontSize:10,fontWeight:'800',letterSpacing:1},titleInput:{color:'#fff',fontSize:24,fontWeight:'800',paddingVertical:14,borderBottomWidth:2,borderColor:p.lime,marginTop:6},textInput:{color:'#fff',fontSize:17,lineHeight:25,minHeight:80,maxHeight:140,textAlignVertical:'top',paddingVertical:12,marginTop:4},counter:{color:p.darkMuted,fontSize:11,textAlign:'right',marginBottom:12},chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:14},chip:{minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1.5,alignItems:'center',justifyContent:'center'},chipText:{color:'#fff',fontSize:13,fontWeight:'700'},primary:{minHeight:52,paddingHorizontal:18,borderRadius:16,backgroundColor:p.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},primaryText:{fontSize:14,fontWeight:'800',color:p.ink},secondary:{minHeight:48,paddingHorizontal:18,borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,.3)',marginBottom:10},secondaryText:{color:'#fff',fontSize:13,fontWeight:'700'},buttons:{flexDirection:'row',gap:10,alignItems:'center'},error:{color:'#fff',backgroundColor:'rgba(180,35,50,.9)',fontSize:13,lineHeight:19,padding:12,borderRadius:12,marginVertical:10},card:{backgroundColor:p.surface,borderRadius:16,paddingHorizontal:12,marginBottom:10}});
