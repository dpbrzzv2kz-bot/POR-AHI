import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Platform,StyleSheet,View} from 'react-native';
import {summarizeOpinion} from '../lib/opinions';
import {palette as p} from '../lib/theme';

type Props={likes?:number;tomatoes?:number;active?:boolean};
const confetti=[{left:9,top:16,rotation:'-24deg',color:p.lime},{left:23,top:29,rotation:'22deg',color:'#C26BFF'},{right:10,top:25,rotation:'-34deg',color:p.lime},{right:27,top:12,rotation:'35deg',color:'#2DE2C0'},{left:10,bottom:35,rotation:'25deg',color:'#C26BFF'},{left:28,bottom:14,rotation:'-14deg',color:p.lime},{right:14,bottom:18,rotation:'-30deg',color:'#2DE2C0'},{right:30,bottom:38,rotation:'18deg',color:p.lime}];
const splashes=[{left:9,top:21,size:14},{right:14,top:10,size:19},{left:17,bottom:16,size:20},{right:8,bottom:35,size:13}];

// Only border accents: no particles over the center, no input interception and no loop.
export default function ReactionAtmosphere({likes,tomatoes,active=true}:Props){
 const {mood}=summarizeOpinion(likes,tomatoes);
 const [reduceMotion,setReduceMotion]=useState<boolean|null>(null),[progress]=useState(()=>new Animated.Value(1));
 const animatedMood=useRef('none');
 useEffect(()=>{
  let live=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(live)setReduceMotion(value);}).catch(()=>{if(live)setReduceMotion(true);});
  const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
  return()=>{live=false;subscription?.remove();};
 },[]);
 useEffect(()=>{
  if(mood==='none'||!active||reduceMotion!==false||animatedMood.current===mood){progress.setValue(1);return;}
  animatedMood.current=mood;
  progress.setValue(0);
  const animation=Animated.timing(progress,{toValue:1,duration:650,useNativeDriver:Platform.OS!=='web',isInteraction:false});
  animation.start();
  return()=>animation.stop();
 },[active,mood,progress,reduceMotion]);
 if(mood==='none')return null;
 return <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[StyleSheet.absoluteFill,s.overlay,{opacity:progress.interpolate({inputRange:[0,.55,1],outputRange:[.08,.72,.4]}),transform:[{scale:progress.interpolate({inputRange:[0,.55,1],outputRange:[.88,1.02,1]})}]}]}>
  {mood==='confetti'?confetti.map(({rotation,color,...position},index)=><View key={index} style={[s.confetti,position,{backgroundColor:color,transform:[{rotate:rotation}]}]}/>):splashes.map(({size,...position},index)=><View key={index} style={[s.splash,position,{width:size,height:size,borderRadius:size*.45}]}><View style={[s.droplet,{left:-4,top:-3,width:5,height:5}]}/><View style={[s.droplet,{right:-5,top:3,width:4,height:4}]}/><View style={[s.droplet,{right:1,bottom:-5,width:5,height:5}]}/></View>)}
 </Animated.View>;
}
const s=StyleSheet.create({overlay:{overflow:'hidden'},confetti:{position:'absolute',width:4,height:11,borderRadius:2},splash:{position:'absolute',backgroundColor:'#FF536C'},droplet:{position:'absolute',backgroundColor:'#FF536C',borderRadius:5}});
