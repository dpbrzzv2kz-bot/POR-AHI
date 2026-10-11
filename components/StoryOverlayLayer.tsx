import React,{useEffect,useMemo,useRef,useState} from 'react';
import {PanResponder,Platform,Pressable,StyleSheet,Text,View,type GestureResponderEvent} from 'react-native';
import {countdownText,isInteractiveSticker,sizeRange,type FilterName,type StoryOverlay,type TextFont} from '../lib/storyOverlays';
import {palette as p} from '../lib/theme';

type Box={w:number;h:number};
export type PollState={showResults?:boolean;counts:Record<string,number[]>;mine:Record<string,number>;onVote:(overlayId:string,choice:number)=>void};
type Props={
 overlays:StoryOverlay[];editable?:boolean;selectedId?:string|null;
 onSelect?:(id:string|null)=>void;onChange?:(id:string,patch:Partial<StoryOverlay>)=>void;onTapSelected?:(id:string)=>void;
 poll?:PollState;onAnswer?:(item:StoryOverlay)=>void;
};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

const fontFamily=(font?:TextFont)=>font==='serif'?Platform.select({ios:'Georgia',android:'serif',default:'Georgia, serif'}):font==='maquina'?Platform.select({ios:'Courier New',android:'monospace',default:'"Courier New", monospace'}):font==='manuscrita'?Platform.select({ios:'Noteworthy',android:'cursive',default:'cursive'}):undefined;
// Texto negro sobre colores claros y blanco sobre oscuros.
const contrast=(hex:string)=>{const n=parseInt(hex.slice(1),16),r=n>>16,g=(n>>8)&255,b=n&255;return (r*299+g*587+b*114)/1000>150?'#17171C':'#FFFFFF';};
function useNow(){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(id);},[]);
 return now;
}

// Capa de color de un filtro: va como hermana de la foto o el video (no dentro de la capa de textos) para mezclarse con ellos.
const filterStyles:Record<FilterName,object>={
 warm:{backgroundColor:'#FF9A3C',opacity:.22},
 cool:{backgroundColor:'#3A86FF',opacity:.2},
 mono:{backgroundColor:'#000000',mixBlendMode:'saturation'},
 vivid:{backgroundColor:'#FF0000',mixBlendMode:'saturation',opacity:.4},
 fade:{backgroundColor:'#FFFFFF',opacity:.24},
};
export function StoryFilterLayer({overlays}:{overlays:StoryOverlay[]}){
 const name=overlays.find(item=>item.type==='filter')?.name;
 if(!name)return null;
 return <View pointerEvents="none" style={[StyleSheet.absoluteFill,filterStyles[name]]}/>;
}

// Dibuja textos, emojis, stickers y trazos sobre una story. En modo editable se arrastran, se pellizcan y se giran con los dedos.
export default function StoryOverlayLayer({overlays,editable=false,selectedId=null,onSelect,onChange,onTapSelected,poll,onAnswer}:Props){
 const [box,setBox]=useState<Box>({w:0,h:0});
 const now=useNow();
 const strokes=overlays.filter(item=>item.type==='draw'),items=overlays.filter(item=>item.type!=='draw'&&item.type!=='filter');
 return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={event=>setBox({w:event.nativeEvent.layout.width,h:event.nativeEvent.layout.height})}>
  {box.w>0&&box.h>0&&<>
   {strokes.map(stroke=><Stroke key={stroke.id} item={stroke} box={box}/>)}
   {items.map(item=><OverlayItem key={item.id} item={item} box={box} now={now} editable={editable} selected={selectedId===item.id} onSelect={onSelect} onChange={onChange} onTapSelected={onTapSelected} poll={poll} onAnswer={onAnswer}/>)}
  </>}
 </View>;
}

function Stroke({item,box}:{item:StoryOverlay;box:Box}){
 const points=item.points||[],thickness=Math.max(2,(item.width||.012)*box.w),segments=[];
 for(let i=0;i+3<points.length;i+=2){
  const x1=points[i]*box.w,y1=points[i+1]*box.h,x2=points[i+2]*box.w,y2=points[i+3]*box.h;
  const length=Math.hypot(x2-x1,y2-y1)+thickness*.4;
  segments.push(<View key={i} style={{position:'absolute',left:(x1+x2)/2-length/2,top:(y1+y2)/2-thickness/2,width:length,height:thickness,borderRadius:thickness/2,backgroundColor:item.color,transform:[{rotate:Math.atan2(y2-y1,x2-x1)+'rad'}]}}/>);
 }
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{segments}</View>;
}

const distance=(event:GestureResponderEvent)=>{const [a,b]=event.nativeEvent.touches;return Math.hypot(b.pageX-a.pageX,b.pageY-a.pageY);};
const angle=(event:GestureResponderEvent)=>{const [a,b]=event.nativeEvent.touches;return Math.atan2(b.pageY-a.pageY,b.pageX-a.pageX)*180/Math.PI;};

type ItemProps={item:StoryOverlay;box:Box;now:number;editable:boolean;selected:boolean}&Pick<Props,'onSelect'|'onChange'|'onTapSelected'|'poll'|'onAnswer'>;
function OverlayItem({item,box,now,editable,selected,onSelect,onChange,onTapSelected,poll,onAnswer}:ItemProps){
 const [size,setSize]=useState<Box>({w:0,h:0});
 const start=useRef({x:0,y:0,size:0,rot:0,dist:0,angle:0,pinching:false}),wasSelected=useRef(false);
 const latest=useRef({item,box,selected,onSelect,onChange,onTapSelected});
 useEffect(()=>{latest.current={item,box,selected,onSelect,onChange,onTapSelected};});
 const responder=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponder:()=>true,
  onPanResponderTerminationRequest:()=>false,
  onPanResponderGrant:()=>{const now2=latest.current;start.current={x:now2.item.x,y:now2.item.y,size:now2.item.size,rot:now2.item.rot,dist:0,angle:0,pinching:false};wasSelected.current=now2.selected;now2.onSelect?.(now2.item.id);},
  onPanResponderMove:(event,gesture)=>{
   const now2=latest.current,range=sizeRange(now2.item.type);
   if(event.nativeEvent.touches.length>=2){
    if(!start.current.pinching){start.current={...start.current,dist:distance(event),angle:angle(event),size:now2.item.size,rot:now2.item.rot,pinching:true};return;}
    now2.onChange?.(now2.item.id,{size:clamp(start.current.size*distance(event)/Math.max(1,start.current.dist),range.min,range.max),rot:Math.round(start.current.rot+angle(event)-start.current.angle)});
    return;
   }
   now2.onChange?.(now2.item.id,{x:clamp(start.current.x+gesture.dx/now2.box.w,0,1),y:clamp(start.current.y+gesture.dy/now2.box.h,0,1)});
  },
  onPanResponderRelease:(_,gesture)=>{const now2=latest.current;if(!start.current.pinching&&wasSelected.current&&Math.abs(gesture.dx)<6&&Math.abs(gesture.dy)<6)now2.onTapSelected?.(now2.item.id);},
 }),[]);
 const interactive=!editable&&isInteractiveSticker(item.type)&&(item.type==='poll'?!!poll:!!onAnswer);
 return <View {...(editable?responder.panHandlers:{})} pointerEvents={editable||interactive?'auto':'none'} onLayout={event=>setSize({w:event.nativeEvent.layout.width,h:event.nativeEvent.layout.height})}
  style={[s.item,{left:item.x*box.w-size.w/2,top:item.y*box.h-size.h/2,maxWidth:box.w*.92,transform:[{rotate:item.rot+'deg'}]},editable&&selected&&s.selected]}>
  <Content item={item} box={box} now={now} editable={editable} poll={poll} onAnswer={onAnswer}/>
 </View>;
}

function Content({item,box,now,editable,poll,onAnswer}:{item:StoryOverlay;box:Box;now:number;editable:boolean;poll?:PollState;onAnswer?:(item:StoryOverlay)=>void}){
 const fs=item.size*box.w;
 if(item.type==='emoji')return <Text accessibilityLabel={'Emoji '+item.text} style={{fontSize:fs,lineHeight:fs*1.2,textAlign:'center'}}>{item.text}</Text>;
 if(item.type==='text'){
  const solid=item.bg==='solid',soft=item.bg==='soft',color=solid?contrast(item.color):item.color;
  return <View style={[(solid||soft)&&{backgroundColor:solid?item.color:'rgba(0,0,0,.5)',borderRadius:fs*.3,paddingHorizontal:fs*.35,paddingVertical:fs*.12}]}>
   <Text accessibilityLabel={item.text} style={[s.text,{fontSize:fs,lineHeight:fs*1.25,color,textAlign:item.align||'center',fontFamily:fontFamily(item.font)},!(solid||soft)&&s.shadow]}>{item.text}</Text>
  </View>;
 }
 if(item.type==='location')return <View style={[s.pill,{backgroundColor:'#FFFFFF',paddingHorizontal:fs*.7,paddingVertical:fs*.35,borderRadius:fs}]}><Text style={{fontSize:fs}}>📍</Text><Text numberOfLines={2} style={{fontSize:fs,fontWeight:'800',color:p.ink,marginLeft:fs*.3,flexShrink:1}}>{item.text}</Text></View>;
 if(item.type==='mention')return <View style={[s.pill,{backgroundColor:'#FFFFFF',paddingHorizontal:fs*.7,paddingVertical:fs*.35,borderRadius:fs}]}><Text numberOfLines={1} style={{fontSize:fs,fontWeight:'800',color:p.violet}}>{item.text}</Text></View>;
 if(item.type==='time')return <View style={[s.pill,{backgroundColor:'rgba(23,23,28,.78)',paddingHorizontal:fs*.7,paddingVertical:fs*.35,borderRadius:fs}]}><Text style={{fontSize:fs,fontWeight:'800',color:'#FFFFFF'}}>{item.text}</Text></View>;
 if(item.type==='brand')return <View style={[s.pill,{backgroundColor:p.lime,paddingHorizontal:fs*.8,paddingVertical:fs*.3,borderRadius:fs}]}><Text style={{fontSize:fs,fontWeight:'900',color:p.ink,letterSpacing:-.5}}>{item.text||'por ahí'} ↗</Text></View>;
 if(item.type==='countdown')return <View style={[s.card,{width:box.w*.56,backgroundColor:'#17171C',borderRadius:fs*.8,padding:fs*.8}]}>
  {!!item.text&&<Text numberOfLines={2} style={{fontSize:fs*.8,fontWeight:'800',color:p.lime,textAlign:'center',letterSpacing:1}}>{item.text.toUpperCase()}</Text>}
  <Text style={{fontSize:fs*1.7,fontWeight:'900',color:'#FFFFFF',textAlign:'center'}}>{countdownText(item.endsAt,now)}</Text>
 </View>;
 if(item.type==='poll'){
  const counts=poll?.counts[item.id]||[0,0],mine=poll?.mine[item.id],total=counts[0]+counts[1],voted=mine!==undefined||!!poll?.showResults;
  return <View style={[s.card,{width:box.w*.7,backgroundColor:'#FFFFFF',borderRadius:fs*.9,padding:fs*.8,gap:fs*.5}]}>
   <Text style={{fontSize:fs*1.05,fontWeight:'900',color:p.ink,textAlign:'center'}}>{item.text}</Text>
   {(item.options||[]).map((option,index)=>{
    const percent=total?Math.round(counts[index]/total*100):0;
    return <Pressable key={index} disabled={editable||!poll||voted} accessibilityRole="button" accessibilityLabel={'Votar '+option} onPress={()=>poll?.onVote(item.id,index)} style={{minHeight:fs*2.2,borderRadius:fs*.6,backgroundColor:p.soft,overflow:'hidden',justifyContent:'center',paddingHorizontal:fs*.8}}>
     {voted&&<View style={{position:'absolute',left:0,top:0,bottom:0,width:(percent+'%') as `${number}%`,backgroundColor:mine===index?p.lime:'#D9D9E3'}}/>}
     <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text numberOfLines={1} style={{fontSize:fs,fontWeight:'800',color:p.ink,flexShrink:1}}>{option}</Text>{voted&&<Text style={{fontSize:fs*.95,fontWeight:'800',color:p.ink}}>{percent}%</Text>}</View>
    </Pressable>;
   })}
  </View>;
 }
 if(item.type==='question')return <View style={[s.card,{width:box.w*.7,backgroundColor:p.violet,borderRadius:fs*.9,padding:fs*.8,gap:fs*.6}]}>
  <Text style={{fontSize:fs*1.05,fontWeight:'900',color:'#FFFFFF',textAlign:'center'}}>{item.text}</Text>
  <Pressable disabled={editable||!onAnswer} accessibilityRole="button" accessibilityLabel="Responder" onPress={()=>onAnswer?.(item)} style={{minHeight:fs*2.2,borderRadius:fs*.6,backgroundColor:'rgba(255,255,255,.92)',justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:fs*.9,fontWeight:'700',color:p.muted}}>Toca para responder</Text></Pressable>
 </View>;
 return null;
}
const s=StyleSheet.create({
 item:{position:'absolute',padding:4,borderRadius:8,borderWidth:1,borderColor:'transparent'},
 selected:{borderColor:'rgba(255,255,255,.9)',borderStyle:'dashed'},
 text:{fontWeight:'900'},
 shadow:{textShadowColor:'rgba(0,0,0,.55)',textShadowRadius:6,textShadowOffset:{width:0,height:1}},
 pill:{flexDirection:'row',alignItems:'center'},
 card:{alignItems:'stretch'},
});
