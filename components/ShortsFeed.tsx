import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,FlatList,StyleSheet,Platform,type ViewToken} from 'react-native';
import {useVideoPlayer,VideoView} from 'expo-video';
import type {Review} from '../lib/posts';
import type {PostStats} from '../lib/interactions';
import {palette as p,categoryColor} from '../lib/theme';
import Icon from './Icon';

type Props={items:Review[];playing:boolean;liked:string[];tomatoed:string[];stats:Record<string,PostStats>;busy:boolean;refreshing:boolean;onRefresh:()=>void;onLike:(review:Review)=>void;onTomato:(review:Review)=>void;onComments:(review:Review)=>void;onMore:(review:Review)=>void;onShare:(review:Review)=>void;onCreate:()=>void};

// Un short por pantalla (como TikTok): se desliza hacia arriba, el que se ve se reproduce solo y en bucle.
function Short({review,height,playing,liked,tomato,counts,busy,onLike,onTomato,onComments,onMore,onShare}:{review:Review;height:number;playing:boolean;liked:boolean;tomato:boolean;counts?:PostStats;busy:boolean;onLike:()=>void;onTomato:()=>void;onComments:()=>void;onMore:()=>void;onShare:()=>void}){
 const [paused,setPaused]=useState(false);
 const player=useVideoPlayer(review.media?.uri||'',instance=>{instance.loop=true;instance.muted=Platform.OS==='web';});
 useEffect(()=>{if(playing&&!paused)player.play();else player.pause();},[playing,paused,player]);
 return <View style={{height,backgroundColor:'#000'}}>
  <Pressable accessibilityRole="button" accessibilityLabel={paused?'Reproducir short':'Pausar short'} onPress={()=>setPaused(v=>!v)} style={StyleSheet.absoluteFill}>
   <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="cover"/>
  </Pressable>
  {paused&&<View pointerEvents="none" style={s.pauseMark}><Icon name="video" color="#FFFFFF" size={44}/></View>}
  <View pointerEvents="box-none" style={s.info}>
   <Text numberOfLines={1} style={s.author}>{review.author}</Text>
   <Text numberOfLines={2} style={s.title}>{review.place}</Text>
   <View style={[s.chip,{backgroundColor:categoryColor(review.category)}]}><Text style={s.chipText}>{review.category}</Text></View>
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
  {height>0&&(items.length?<FlatList data={items} keyExtractor={item=>item.id} renderItem={renderItem} pagingEnabled decelerationRate="fast" showsVerticalScrollIndicator={false} getItemLayout={(_,index)=>({length:height,offset:height*index,index})} windowSize={3} initialNumToRender={1} maxToRenderPerBatch={1} removeClippedSubviews={Platform.OS!=='web'} onViewableItemsChanged={onViewable} viewabilityConfig={{itemVisiblePercentThreshold:80}} refreshing={refreshing} onRefresh={onRefresh}/>:<View style={s.empty}><Icon name="video" color={p.darkMuted} size={44}/><Text style={s.emptyTitle}>Todavía no hay shorts.</Text><Text style={s.emptyNote}>Sube el primero con el botón de arriba.</Text></View>)}
  <Pressable accessibilityRole="button" accessibilityLabel="Subir un short" onPress={onCreate} style={s.create}><Icon name="plus" size={20}/><Text style={s.createText}>Subir short</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({pauseMark:{position:'absolute',top:0,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.25)'},info:{position:'absolute',left:16,right:96,bottom:26,gap:6},author:{color:'#fff',fontSize:15,fontWeight:'800'},title:{color:'#fff',fontSize:17,lineHeight:23,fontWeight:'700'},chip:{alignSelf:'flex-start',borderRadius:99,paddingHorizontal:10,paddingVertical:3},chipText:{color:p.ink,fontSize:11,fontWeight:'800'},actions:{position:'absolute',right:10,bottom:26,alignItems:'center',gap:14},action:{minWidth:56,minHeight:56,alignItems:'center',justifyContent:'center',gap:3},count:{color:'#fff',fontSize:12,fontWeight:'800'},create:{position:'absolute',top:12,right:12,minHeight:44,paddingHorizontal:16,borderRadius:22,backgroundColor:p.lime,flexDirection:'row',alignItems:'center',gap:6},createText:{color:p.ink,fontSize:13,fontWeight:'800'},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:30},emptyTitle:{color:'#fff',fontSize:20,fontWeight:'900'},emptyNote:{color:p.darkMuted,fontSize:14,textAlign:'center'}});
