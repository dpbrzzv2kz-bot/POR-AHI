import React,{useEffect,useMemo,useState} from 'react';
import {AccessibilityInfo,Animated,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {passportProgress,passportRanks,uniquePassportStamps,type PassportStamp} from '../lib/passport';
import {palette as p} from '../lib/theme';

function Stamp({item,index,animate}:{item:PassportStamp;index:number;animate:boolean}){
 const [scale]=useState(()=>new Animated.Value(1));
 useEffect(()=>{
  if(!animate||index>5){scale.setValue(1);return;}
  scale.setValue(1.14);
  const animation=Animated.sequence([
   Animated.delay(index*70),
   Animated.timing(scale,{toValue:0.96,duration:180,useNativeDriver:Platform.OS!=='web'}),
   Animated.timing(scale,{toValue:1,duration:140,useNativeDriver:Platform.OS!=='web'}),
  ]);
  animation.start();return()=>animation.stop();
 },[scale,index,animate]);
 return <Animated.View accessibilityLabel={'Sello de '+item.name+', '+item.country} style={[s.stamp,{transform:[{scale},{rotate:index%2?'3deg':'-3deg'}]}]}>
  <Text style={s.stampBrand}>POR AHÍ ↗</Text><Text numberOfLines={2} style={s.stampName}>{item.name==='Distrito Federal'?'Ciudad de México':item.name}</Text><Text numberOfLines={1} style={s.stampCountry}>{item.country==='Mexico'?'México':item.country}</Text><Text style={s.stampBottom}>RESEÑADO · {String(index+1).padStart(2,'0')}</Text>
 </Animated.View>;
}

export default function Passport({visible,onClose,name,stamps}:{visible:boolean;onClose:()=>void;name:string;stamps:PassportStamp[]}){
 const unique=useMemo(()=>uniquePassportStamps(stamps),[stamps]);
 const progress=passportProgress(unique.length),[reduceMotion,setReduceMotion]=useState<boolean|null>(null);
 useEffect(()=>{
  let active=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduceMotion(value);}).catch(()=>{if(active)setReduceMotion(true);});
  const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
  return()=>{active=false;listener.remove();};
 },[]);
 return <Modal visible={visible} animationType={reduceMotion===false?'fade':'none'} onRequestClose={onClose}>
  <View style={s.screen}>
   <View style={s.top}><View style={{flex:1}}><Text style={s.kicker}>PASAPORTE POR AHÍ</Text><Text numberOfLines={1} style={s.name}>{name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar pasaporte" onPress={onClose} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
   <ScrollView contentContainerStyle={s.content}>
    <View style={s.rankCard}><Text style={s.level}>RANGO {progress.level} / 10</Text><Text style={s.rank}>{progress.current.name}</Text><Text style={s.count}>{unique.length} {unique.length===1?'estado reseñado':'estados y regiones reseñados'}</Text>
     <View style={s.track}><View style={[s.fill,{width:(progress.progress*100+'%') as `${number}%`}]}/></View>
     <Text style={s.next}>{progress.next?'Te faltan '+progress.remaining+' '+(progress.remaining===1?'estado':'estados')+' para ser '+progress.next.name+'.':'Llegaste al rango más alto. El camino sigue.'}</Text>
    </View>
    <Text style={s.section}>TUS SELLOS</Text>
    {unique.length?<View style={s.stamps}>{unique.map((item,index)=><Stamp key={item.id} item={item} index={index} animate={visible&&reduceMotion===false}/>)}</View>:<View style={s.empty}><Text style={s.emptyTitle}>Tu primera aventura cabe aquí.</Text><Text style={s.emptyText}>Publica una reseña con ubicación para conseguir el sello de su estado.</Text></View>}
    <Text style={s.note}>Un sello por estado o región con una reseña tuya publicada y ubicada en el mapa. Repetir un estado no suma sellos.</Text>
    <Text style={s.section}>LOS 10 RANGOS</Text>
    {passportRanks.map((rank,index)=><View key={rank.min} style={s.rankRow}><Text style={[s.rankNumber,index+1===progress.level&&{color:p.lime}]}>{String(index+1).padStart(2,'0')}</Text><Text style={[s.rankLabel,index+1===progress.level&&{color:p.lime}]}>{rank.name}</Text><Text style={s.threshold}>{rank.min} {rank.min===1?'estado':'estados'}</Text></View>)}
   </ScrollView>
  </View>
 </Modal>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:p.ink},top:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingTop:Platform.OS==='ios'?58:20,paddingBottom:18},kicker:{fontSize:10,fontWeight:'800',letterSpacing:2,color:p.lime},name:{fontSize:24,fontWeight:'900',color:p.onDark,marginTop:7},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},closeText:{fontSize:36,color:p.onDark},content:{paddingHorizontal:20,paddingBottom:50},rankCard:{padding:22,borderRadius:24,backgroundColor:'#292930'},level:{color:p.darkMuted,fontSize:10,fontWeight:'800',letterSpacing:2},rank:{color:p.lime,fontSize:28,fontWeight:'900',marginTop:8},count:{color:p.onDark,fontSize:14,marginTop:8},track:{height:5,borderRadius:4,backgroundColor:'#41414A',marginTop:18,overflow:'hidden'},fill:{height:5,backgroundColor:p.lime},next:{color:p.darkMuted,fontSize:12,lineHeight:18,marginTop:10},section:{color:p.darkMuted,fontSize:10,letterSpacing:2,fontWeight:'800',marginTop:28,marginBottom:18},stamps:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:18,paddingHorizontal:5},stamp:{width:'46%',minHeight:148,borderWidth:2,borderStyle:'dashed',borderColor:p.lime,borderRadius:22,padding:12,alignItems:'center',justifyContent:'center',backgroundColor:'#D4FF3809'},stampBrand:{color:p.lime,fontSize:10,fontWeight:'900',letterSpacing:1.5},stampName:{color:p.lime,fontSize:18,lineHeight:22,fontWeight:'900',textAlign:'center',marginTop:10},stampCountry:{color:p.darkMuted,fontSize:11,marginTop:7},stampBottom:{color:p.lime,fontSize:8,fontWeight:'800',letterSpacing:1,marginTop:12},empty:{padding:22,borderRadius:20,borderWidth:1,borderStyle:'dashed',borderColor:'#595962'},emptyTitle:{color:p.onDark,fontSize:18,fontWeight:'800'},emptyText:{color:p.darkMuted,lineHeight:20,fontSize:13,marginTop:8},note:{color:p.darkMuted,fontSize:11,lineHeight:17,marginTop:25},rankRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#FFFFFF12'},rankNumber:{color:p.darkMuted,fontSize:12,width:24,fontWeight:'800'},rankLabel:{flex:1,color:p.onDark,fontSize:14,fontWeight:'700'},threshold:{color:p.darkMuted,fontSize:11},
});
