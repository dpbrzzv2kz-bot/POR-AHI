import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,Image,Pressable,Animated,Easing,StyleSheet,Platform} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import type {Story} from '../lib/posts';
import {palette as p} from '../lib/theme';
import Icon from './Icon';

const ago=(since:number)=>{
 const seconds=(Date.now()-since)/1000;
 if(!Number.isFinite(seconds)||seconds<60)return 'ahora';
 const minutes=Math.floor(seconds/60);if(minutes<60)return 'hace '+minutes+' min';
 const hours=Math.floor(minutes/60);return 'hace '+hours+' h';
};

// Visor de stories como en Instagram: pantalla completa, barritas de progreso arriba (una por story), toque a la derecha para
// la siguiente y a la izquierda para la anterior. Las fotos duran autoAdvanceMs; los videos avisan al terminar (onEnd en App).
export default function StoryViewer({story,own,media,close,remove,report,index=0,total=1,onPrev,onNext,autoAdvanceMs,avatarUri,paused=false,onHold}:{story:Story;own:boolean;media:React.ReactNode|((onProgress:(currentTime:number,duration:number)=>void,paused:boolean)=>React.ReactNode);close:()=>void;remove:()=>void;report:()=>void;index?:number;total?:number;onPrev?:()=>void;onNext?:()=>void;autoAdvanceMs?:number;avatarUri?:string|null;paused?:boolean;onHold?:(holding:boolean)=>void}){
 const next=useRef(onNext);
 useEffect(()=>{next.current=onNext;},[onNext]);
 const [progress]=useState(()=>new Animated.Value(0)),current=useRef(0);
 const videoProgress=useCallback((currentTime:number,duration:number)=>{
  const value=Number.isFinite(currentTime)&&Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(1,currentTime/duration)):0;
  progress.setValue(value);
 },[progress]);
 const [menu,setMenu]=useState(false);
 const stageWidth=useRef(0),holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null),holding=useRef(false);
 // Toque corto: izquierda = anterior, derecha = siguiente. Mantener presionado (0.2 s) pausa y al soltar continúa.
 const pressIn=()=>{holding.current=false;if(holdTimer.current)clearTimeout(holdTimer.current);holdTimer.current=setTimeout(()=>{holding.current=true;onHold?.(true);},200);};
 const pressOut=(x:number)=>{if(holdTimer.current)clearTimeout(holdTimer.current);holdTimer.current=null;if(holding.current){holding.current=false;onHold?.(false);return;}if(x<stageWidth.current/3)onPrev?.();else onNext?.();};
 useEffect(()=>()=>{if(holdTimer.current)clearTimeout(holdTimer.current);},[]);
 useEffect(()=>{const id=progress.addListener(({value})=>{current.current=value;});return()=>progress.removeListener(id);},[progress]);
 // Al cambiar de story la barra empieza de cero.
 useEffect(()=>{current.current=0;progress.setValue(0);},[story.id,progress]);
 // La barra de una foto se llena sola y al terminar pasa a la siguiente; se pausa mientras el menú está abierto.
 useEffect(()=>{
  if(!autoAdvanceMs)return;
  if(menu||paused)return;
  const animation=Animated.timing(progress,{toValue:1,duration:Math.max(50,autoAdvanceMs*(1-current.current)),easing:Easing.linear,useNativeDriver:false});
  animation.start(({finished})=>{if(finished)next.current?.();});
  return()=>animation.stop();
 },[story.id,autoAdvanceMs,menu,paused,progress]);
 const width=progress.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
 return <View style={s.screen}><StatusBar style="light"/>
  <View style={s.stage} onLayout={event=>{stageWidth.current=event.nativeEvent.layout.width;}}>
   <View style={StyleSheet.absoluteFill}>{(typeof media==='function'?media(videoProgress,menu||paused):media)||<View style={s.placeholder}><Icon name="photos" color={p.darkMuted} size={42}/><Text style={s.note}>STORY DE EJEMPLO · SIN ARCHIVO</Text></View>}</View>
   <Pressable accessibilityRole="button" accessibilityLabel="Toca a la derecha para la siguiente story y a la izquierda para la anterior. Mantén presionado para pausar." onPressIn={pressIn} onPressOut={event=>pressOut(event.nativeEvent.locationX)} style={StyleSheet.absoluteFill}/>
   <View pointerEvents="box-none" style={s.top}>
    <View style={s.bars}>{Array.from({length:total}).map((_,i)=><View key={i} style={s.segment}>{i<index?<View style={[s.fill,{width:'100%'}]}/>:i===index?<Animated.View style={[s.fill,{width}]}/>:null}</View>)}</View>
    <View style={s.header}>
     <View style={s.avatar}>{avatarUri?<Image accessibilityLabel={'Foto de '+story.name} source={{uri:avatarUri}} style={{width:36,height:36,borderRadius:18}}/>:<Text style={s.initial}>{story.name[0]?.toUpperCase()||'↗'}</Text>}</View>
     <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.name}>{story.name}</Text><Text style={s.time}>{ago(story.expires-24*3600*1000)}</Text></View>
     <Pressable accessibilityRole="button" accessibilityLabel="Más opciones de la story" onPress={()=>setMenu(value=>!value)} style={s.icon}><Text style={s.dots}>⋯</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Cerrar story" onPress={close} style={s.icon}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" color={p.onDark} size={26}/></View></Pressable>
    </View>
   </View>
   {menu&&<>
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={()=>setMenu(false)} style={StyleSheet.absoluteFill}/>
    <View style={s.menu}><Pressable accessibilityRole="button" onPress={()=>{setMenu(false);if(own)remove();else report();}} style={s.menuItem}><Text style={s.menuText}>{own?'Eliminar mi story':'Reportar story'}</Text></Pressable></View>
   </>}
  </View>
 </View>;
}
const shadow={textShadowColor:'rgba(0,0,0,.6)',textShadowRadius:4,textShadowOffset:{width:0,height:1}} as const;
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#000'},stage:{flex:1,width:'100%',maxWidth:480,alignSelf:'center',backgroundColor:'#0E0E12'},placeholder:{flex:1,justifyContent:'center',alignItems:'center',gap:18,padding:20},note:{fontSize:10,lineHeight:18,letterSpacing:1,color:p.darkMuted,textAlign:'center'},top:{position:'absolute',left:0,right:0,top:0,paddingTop:Platform.OS==='ios'?54:12,paddingHorizontal:10,backgroundColor:'rgba(0,0,0,.18)'},bars:{flexDirection:'row',gap:4},segment:{flex:1,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,.35)',overflow:'hidden'},fill:{height:3,backgroundColor:'#fff'},header:{flexDirection:'row',alignItems:'center',gap:10,paddingTop:10,paddingBottom:10},avatar:{width:36,height:36,borderRadius:18,backgroundColor:p.lime,alignItems:'center',justifyContent:'center',overflow:'hidden'},initial:{fontSize:16,fontWeight:'900',color:p.ink},name:{color:'#fff',fontSize:14,fontWeight:'800',...shadow},time:{color:'rgba(255,255,255,.8)',fontSize:12,marginTop:1,...shadow},icon:{width:44,height:44,alignItems:'center',justifyContent:'center'},dots:{color:'#fff',fontSize:26,fontWeight:'900',lineHeight:28,...shadow},menu:{position:'absolute',right:12,top:Platform.OS==='ios'?118:76,backgroundColor:p.surface,borderRadius:14,overflow:'hidden',minWidth:190},menuItem:{minHeight:48,paddingHorizontal:16,justifyContent:'center'},menuText:{color:p.ink,fontSize:14,fontWeight:'700'}});
