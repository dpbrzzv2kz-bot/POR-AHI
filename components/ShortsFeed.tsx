import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,Image,Pressable,FlatList,StyleSheet,Platform,type ViewToken} from 'react-native';
import {useVideoPlayer,VideoView} from 'expo-video';
import type {Review} from '../lib/posts';
import type {PostStats} from '../lib/interactions';
import {palette as p,categoryColor} from '../lib/theme';
import {ratingLabel} from '../lib/opinions';
import Icon from './Icon';
import OpinionMeter from './OpinionMeter';
import ReactionAtmosphere from './ReactionAtmosphere';

type Props={items:Review[];playing:boolean;liked:string[];tomatoed:string[];stats:Record<string,PostStats>;busy:boolean;refreshing:boolean;onRefresh:()=>void;onLike:(review:Review)=>void;onTomato:(review:Review)=>void;onComments:(review:Review)=>void;onMore:(review:Review)=>void;onShare:(review:Review)=>void;onCreate:()=>void};
const PHOTO_MS=4000;

// Una reseña por pantalla (como un short): se desliza hacia arriba y la que se ve se reproduce sola.
// Una reseña puede ser un video, una foto o una secuencia de fotos y videos que pasan uno tras otro y vuelven a empezar.
function Short({review,height,playing,liked,tomato,counts,busy,onLike,onTomato,onComments,onMore,onShare}:{review:Review;height:number;playing:boolean;liked:boolean;tomato:boolean;counts?:PostStats;busy:boolean;onLike:()=>void;onTomato:()=>void;onComments:()=>void;onMore:()=>void;onShare:()=>void}){
 const [paused,setPaused]=useState(false),[index,setIndex]=useState(0);
 const items=review.items&&review.items.length?review.items:review.media?[review.media]:[];
 const single=items.length<=1,current=items[Math.min(index,Math.max(0,items.length-1))],isVideo=current?.type==='video';
 const player=useVideoPlayer(isVideo?current.uri:null,instance=>{instance.loop=single;instance.muted=Platform.OS==='web';});
 useEffect(()=>{if(isVideo&&playing&&!paused)player.play();else player.pause();},[isVideo,playing,paused,player]);
 // En una secuencia, al terminar un video pasa al siguiente; una foto dura unos segundos.
 useEffect(()=>{
  if(single||!isVideo)return;
  const subscription=player.addListener('playToEnd',()=>setIndex(value=>(value+1)%items.length));
  return()=>subscription.remove();
 },[player,single,isVideo,items.length]);
 useEffect(()=>{
  if(single||isVideo||!playing||paused)return;
  const timer=setTimeout(()=>setIndex(value=>(value+1)%items.length),PHOTO_MS);
  return()=>clearTimeout(timer);
 },[index,single,isVideo,playing,paused,items.length]);
 // Al salir de la pantalla, la secuencia vuelve al principio.
 useEffect(()=>{if(playing)return;let active=true;Promise.resolve().then(()=>{if(active){setIndex(0);setPaused(false);}});return()=>{active=false;};},[playing]);
 return <View style={{height,backgroundColor:'#000'}}>
  <Pressable accessibilityRole="button" accessibilityLabel={paused?'Reproducir reseña':'Pausar reseña'} onPress={()=>setPaused(v=>!v)} style={StyleSheet.absoluteFill}>
   {isVideo?<VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="cover"/>:current?<Image accessibilityLabel={'Foto de '+review.place} source={{uri:current.uri}} style={StyleSheet.absoluteFill} resizeMode="cover"/>:null}
  </Pressable>
  <ReactionAtmosphere likes={counts?.likes} tomatoes={counts?.tomatoes} active={playing&&!paused}/>
  {!single&&<View pointerEvents="none" style={s.bars}>{items.map((_,i)=><View key={i} style={[s.bar,i<=index&&s.barOn]}/>)}</View>}
  {paused&&<View pointerEvents="none" style={s.pauseMark}><Icon name="video" color="#FFFFFF" size={44}/></View>}
  <View pointerEvents="box-none" style={s.info}>
   <Text numberOfLines={1} style={s.author}>{review.author}</Text>
   <Text numberOfLines={2} style={s.title}>{review.place}</Text>
   <View style={s.chips}>
    <View style={[s.chip,{backgroundColor:categoryColor(review.category)}]}><Text style={s.chipText}>{review.category}</Text></View>
    {!!ratingLabel(review.rating)&&<View style={[s.chip,{backgroundColor:p.ink}]}><Text style={[s.chipText,{color:p.lime}]}>{'★'.repeat(review.rating!)} {ratingLabel(review.rating)}</Text></View>}
   </View>
   {!!review.address&&<Text numberOfLines={1} style={s.address}>📍 {review.address.split(',').slice(0,2).join(',')}</Text>}
   <OpinionMeter likes={counts?.likes} tomatoes={counts?.tomatoes} compact dark/>
  </View>
  <View style={s.actions}>
   <Pressable accessibilityRole="button" accessibilityLabel={liked?'Quitar me gusta':'Me gusta'} disabled={busy} onPress={onLike} style={s.action}><Icon name="heart" filled={liked} color={liked?p.lime:'#FFFFFF'} size={30}/><Text style={s.count}>{counts?.likes??'—'}</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={tomato?'Quitar tomate':'Dar tomate: no estoy de acuerdo'} disabled={busy} onPress={onTomato} style={s.action}><Text style={{fontSize:28,opacity:tomato?1:.55}}>🍅</Text><Text style={s.count}>{counts?.tomatoes??'—'}</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={'Comentarios de '+review.place} onPress={onComments} style={s.action}><Icon name="message" color="#FFFFFF" size={28}/><Text style={s.count}>{counts?.comments??'—'}</Text></Pressable>
   {review.cloud&&<Pressable accessibilityRole="button" accessibilityLabel={'Compartir '+review.place} onPress={onShare} style={s.action}><Icon name="arrow" color="#FFFFFF" size={28}/></Pressable>}
   <Pressable accessibilityRole="button" accessibilityLabel={'Más opciones de '+review.place} onPress={onMore} style={s.action}><Text style={{color:'#FFFFFF',fontSize:28,fontWeight:'900',lineHeight:30}}>⋯</Text></Pressable>
  </View>
 </View>;
}

export default function ShortsFeed({items,playing,liked,tomatoed,stats,busy,refreshing,onRefresh,onLike,onTomato,onComments,onMore,onShare,onCreate}:Props){
 const [height,setHeight]=useState(0),[active,setActive]=useState(0);
 const onViewable=useRef(({viewableItems}:{viewableItems:ViewToken[]})=>{const first=viewableItems.find(v=>v.isViewable&&typeof v.index==='number');if(first&&typeof first.index==='number')setActive(first.index);}).current;
 const renderItem=useCallback(({item,index}:{item:Review;index:number})=><Short review={item} height={height} playing={playing&&index===active} liked={liked.includes(item.id)} tomato={tomatoed.includes(item.id)} counts={stats[item.id]} busy={busy} onLike={()=>onLike(item)} onTomato={()=>onTomato(item)} onComments={()=>onComments(item)} onMore={()=>onMore(item)} onShare={()=>onShare(item)}/>,[height,playing,active,liked,tomatoed,stats,busy,onLike,onTomato,onComments,onMore,onShare]);
 return <View style={{flex:1,backgroundColor:'#000'}} onLayout={event=>setHeight(Math.round(event.nativeEvent.layout.height))}>
  {height>0&&(items.length?<FlatList data={items} keyExtractor={item=>item.id} renderItem={renderItem} pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false} getItemLayout={(_,index)=>({length:height,offset:height*index,index})} windowSize={3} initialNumToRender={1} maxToRenderPerBatch={1} removeClippedSubviews={Platform.OS!=='web'} onViewableItemsChanged={onViewable} viewabilityConfig={{itemVisiblePercentThreshold:80}} refreshing={refreshing} onRefresh={onRefresh}/>:<View style={s.empty}><Icon name="video" color={p.darkMuted} size={44}/><Text style={s.emptyTitle}>Todavía no hay reseñas.</Text><Text style={s.emptyNote}>Sube la primera con el botón de arriba.</Text></View>)}
  <Pressable accessibilityRole="button" accessibilityLabel="Nueva reseña" onPress={onCreate} style={s.create}><Icon name="plus" size={20}/><Text style={s.createText}>Nueva reseña</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({pauseMark:{position:'absolute',top:0,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},bars:{position:'absolute',top:10,left:12,right:12,flexDirection:'row',gap:4},bar:{flex:1,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,.35)'},barOn:{backgroundColor:'#FFFFFF'},info:{position:'absolute',left:16,right:96,bottom:26,gap:6},author:{color:'#fff',fontSize:15,fontWeight:'800'},title:{color:'#fff',fontSize:17,lineHeight:23,fontWeight:'700'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{alignSelf:'flex-start',borderRadius:99,paddingHorizontal:10,paddingVertical:3},chipText:{color:p.ink,fontSize:11,fontWeight:'800'},address:{color:'rgba(255,255,255,.85)',fontSize:12},actions:{position:'absolute',right:10,bottom:26,alignItems:'center',gap:14},action:{minWidth:56,minHeight:56,alignItems:'center',justifyContent:'center',gap:3},count:{color:'#fff',fontSize:12,fontWeight:'800'},create:{position:'absolute',top:12,right:12,minHeight:44,paddingHorizontal:16,borderRadius:22,backgroundColor:p.lime,flexDirection:'row',alignItems:'center',gap:6},createText:{color:p.ink,fontSize:13,fontWeight:'800'},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:30},emptyTitle:{color:'#fff',fontSize:20,fontWeight:'900'},emptyNote:{color:p.darkMuted,fontSize:14,textAlign:'center'}});
