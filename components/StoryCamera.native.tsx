import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet,Platform} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {CameraView,useCameraPermissions,useMicrophonePermissions} from 'expo-camera';
import {palette as p} from '../lib/theme';
import Icon from './Icon';
import type {StoryCameraProps} from './storyCameraTypes';

const MAX_SECONDS=30;
// Cámara propia para stories: foto o video (hasta 30 s) y acceso directo a la galería.
export default function StoryCamera({onCapture,onGallery,onClose}:StoryCameraProps){
 const camera=useRef<CameraView>(null);
 const [permission,requestPermission]=useCameraPermissions();
 const [micPermission,requestMic]=useMicrophonePermissions();
 const [facing,setFacing]=useState<'front'|'back'>('back');
 const [mode,setMode]=useState<'picture'|'video'>('picture');
 const [recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const startedAt=useRef(0);
 useEffect(()=>{if(!recording)return;const id=setInterval(()=>setSeconds(Math.floor((Date.now()-startedAt.current)/1000)),250);return()=>clearInterval(id);},[recording]);
 const close=()=>{if(recording)camera.current?.stopRecording();onClose();};
 const chooseMode=async(next:'picture'|'video')=>{
  if(recording||busy)return;setError('');
  if(next==='video'&&!micPermission?.granted){const answer=await requestMic();if(!answer.granted){setError('Para grabar video permite el micrófono en los Ajustes del teléfono.');return;}}
  setMode(next);
 };
 const shutter=async()=>{
  if(busy)return;setError('');
  if(mode==='picture'){
   setBusy(true);
   try{const picture=await camera.current?.takePictureAsync({quality:.85});if(picture)onCapture({uri:picture.uri,type:'image',mimeType:picture.format==='png'?'image/png':'image/jpeg'});}
   catch{setError('No se pudo tomar la foto. Intenta de nuevo.');}
   finally{setBusy(false);}
   return;
  }
  if(recording){camera.current?.stopRecording();return;}
  startedAt.current=Date.now();setSeconds(0);setRecording(true);
  try{
   const result=await camera.current?.recordAsync({maxDuration:MAX_SECONDS,codec:'avc1'});
   const elapsed=(Date.now()-startedAt.current)/1000;
   if(result?.uri)onCapture({uri:result.uri,type:'video',mimeType:result.uri.toLowerCase().endsWith('.mp4')?'video/mp4':'video/quicktime',duration:Math.max(1,Math.min(MAX_SECONDS,elapsed))});
  }catch{setError('No se pudo grabar el video. Intenta de nuevo.');}
  finally{setRecording(false);setSeconds(0);}
 };
 if(!permission)return <View style={s.screen}/>;
 if(!permission.granted)return <View style={[s.screen,s.center]}><StatusBar style="light"/>
  <Text style={s.askTitle}>Para tu story necesitamos la cámara.</Text>
  <Text style={s.askNote}>Solo la usamos cuando tomas una foto o grabas un video.</Text>
  {permission.canAskAgain?<Pressable accessibilityRole="button" onPress={()=>{void requestPermission();}} style={s.askButton}><Text style={s.askButtonText}>Permitir cámara</Text></Pressable>:<Text style={s.askNote}>Actívala en Ajustes del teléfono para poder usarla.</Text>}
  <Pressable accessibilityRole="button" onPress={onGallery} style={s.askSecondary}><Text style={s.askSecondaryText}>Elegir de la galería</Text></Pressable>
  <Pressable accessibilityRole="button" onPress={onClose} style={s.askSecondary}><Text style={s.askSecondaryText}>Cerrar</Text></Pressable>
 </View>;
 return <View style={s.screen}><StatusBar style="light"/>
  <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mode={mode} videoBitrate={4000000}/>
  <View style={s.top}>
   <Pressable accessibilityRole="button" accessibilityLabel="Cerrar cámara" onPress={close} style={s.round}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" color="#FFFFFF" size={24}/></View></Pressable>
   {recording?<View style={s.timer}><View style={s.dot}/><Text style={s.timerText}>0:{String(Math.min(seconds,MAX_SECONDS)).padStart(2,'0')} / 0:{MAX_SECONDS}</Text></View>:<View/>}
   <View style={{width:46}}/>
  </View>
  <View style={s.bottom}>
   {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
   <View style={s.modes}>{(['picture','video'] as const).map(m=><Pressable key={m} accessibilityRole="button" accessibilityState={{selected:mode===m}} disabled={recording} onPress={()=>{void chooseMode(m);}} style={[s.mode,mode===m&&s.modeOn]}><Text style={[s.modeText,mode===m&&{color:p.ink}]}>{m==='picture'?'Foto':'Video'}</Text></Pressable>)}</View>
   <View style={s.controls}>
    <Pressable accessibilityRole="button" accessibilityLabel="Elegir de la galería" disabled={recording} onPress={onGallery} style={[s.gallery,recording&&{opacity:.3}]}><Icon name="gallery" color="#FFFFFF" size={28}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={mode==='picture'?'Tomar foto':recording?'Detener grabación':'Empezar a grabar'} onPress={()=>{void shutter();}} style={s.ring}>
     <View style={mode==='picture'?s.shutterPhoto:recording?s.shutterStop:s.shutterVideo}/>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Cambiar de cámara" disabled={recording} onPress={()=>setFacing(f=>f==='back'?'front':'back')} style={[s.gallery,recording&&{opacity:.3}]}><Icon name="refresh" color="#FFFFFF" size={28}/></Pressable>
   </View>
  </View>
 </View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#000'},center:{alignItems:'center',justifyContent:'center',padding:28,gap:14},top:{position:'absolute',left:0,right:0,top:Platform.OS==='ios'?58:18,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},round:{width:46,height:46,borderRadius:23,backgroundColor:'rgba(0,0,0,.45)',alignItems:'center',justifyContent:'center'},timer:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,height:36,borderRadius:18,backgroundColor:'rgba(0,0,0,.55)'},dot:{width:10,height:10,borderRadius:5,backgroundColor:'#FF3B30'},timerText:{color:'#fff',fontSize:13,fontWeight:'700'},bottom:{position:'absolute',left:0,right:0,bottom:Platform.OS==='ios'?36:20,alignItems:'center',gap:18},error:{color:'#fff',fontSize:13,lineHeight:19,backgroundColor:'rgba(180,35,50,.9)',paddingHorizontal:14,paddingVertical:10,borderRadius:12,marginHorizontal:24,textAlign:'center'},modes:{flexDirection:'row',gap:6,padding:4,borderRadius:22,backgroundColor:'rgba(0,0,0,.45)'},mode:{minWidth:84,minHeight:38,borderRadius:18,alignItems:'center',justifyContent:'center'},modeOn:{backgroundColor:p.lime},modeText:{color:'#fff',fontSize:13,fontWeight:'800'},controls:{width:'100%',paddingHorizontal:30,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},gallery:{width:54,height:54,borderRadius:16,borderWidth:2,borderColor:'#fff',backgroundColor:'rgba(0,0,0,.35)',alignItems:'center',justifyContent:'center'},ring:{width:84,height:84,borderRadius:42,borderWidth:5,borderColor:'#fff',alignItems:'center',justifyContent:'center'},shutterPhoto:{width:62,height:62,borderRadius:31,backgroundColor:'#fff'},shutterVideo:{width:62,height:62,borderRadius:31,backgroundColor:'#FF3B30'},shutterStop:{width:30,height:30,borderRadius:8,backgroundColor:'#FF3B30'},askTitle:{color:'#fff',fontSize:22,fontWeight:'900',textAlign:'center',letterSpacing:-.5},askNote:{color:p.darkMuted,fontSize:14,lineHeight:21,textAlign:'center'},askButton:{minHeight:52,paddingHorizontal:24,borderRadius:16,backgroundColor:p.lime,alignItems:'center',justifyContent:'center',marginTop:6},askButtonText:{fontSize:14,fontWeight:'800',color:p.ink},askSecondary:{minHeight:46,paddingHorizontal:20,alignItems:'center',justifyContent:'center'},askSecondaryText:{color:'#fff',fontSize:14,fontWeight:'700'}});
