import React, {useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import useModerator from './lib/useModerator';
import {View, Text, ScrollView, Pressable, StyleSheet, Image, Modal, Platform, PanResponder, RefreshControl, useWindowDimensions} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {VideoView, useVideoPlayer} from 'expo-video';
import Account, {type Profile,type ProfileStatus} from './components/Account';
import {supabase} from './lib/supabase';
import DiscoverySearch from './components/DiscoverySearch';
import useDiscovery from './lib/useDiscovery';
import type {ReviewCategory} from './lib/discovery';
import Comments from './components/Comments';
import NotificationsPanel from './components/NotificationsPanel';
import {Inbox,Chat} from './components/Messages';
import {ReportForm,BlockConfirm,BlockedList} from './components/Safety';
import type {ReportTarget} from './lib/safety';
import {openConversation,type Conversation} from './lib/messages';
import useNotifications from './lib/useNotifications';
import type {Notification} from './lib/notifications';
import useInteractions from './lib/useInteractions';
import type {PostStats} from './lib/interactions';
import {loadFollowing,changeFollow,getPublicProfile,type PublicProfile} from './lib/social';
import {loadPosts,loadStories,publishPost,publishStory,type Media,type Review,type Story} from './lib/posts';
import {prepareMedia} from './lib/media';
import {UploadPaused,type UploadProgress} from './lib/resumable';
import MediaComposer from './components/MediaComposer';
import StoryViewer from './components/StoryViewer';
import ReviewDetails from './components/ReviewDetails';
import {ContentEditor,PendingContent,type ContentAction} from './components/OwnContent';
import ShareReview from './components/ShareReview';
import useSharedReview from './lib/useSharedReview';
import {palette as p,categoryColor,categoryColors} from './lib/theme';
import s from './lib/appStyles';
import Icon,{type IconName} from './components/Icon';
import ProfileHeader from './components/ProfileHeader';
import ScreenHeader from './components/ScreenHeader';

const seed:Review[] = [
 {id:'1',kind:'image',userId:'ana',near:true,category:'Comer',place:'Café del Patio',text:'Café tranquilo, luz de tarde y una mesa para conversar. Lo recomendaría para ir sin prisa con un amigo.',author:'Ana · Ficticia',color:'#b68158',symbol:'☕'},
 {id:'2',kind:'image',userId:'luis',near:false,category:'Divertirse',place:'Foro Noche',text:'Un escenario pequeño y un ambiente relajado. Llegaría temprano para elegir un buen lugar.',author:'Luis · Ficticio',color:'#716b9b',symbol:'♫'},
 {id:'3',kind:'image',userId:'mar',near:true,category:'Explorar',place:'Galería Abierta',text:'Caminar sin itinerario y detenerse en los detalles. Un buen plan para una mañana libre.',author:'Mar · Ficticia',color:'#668773',symbol:'◈'},
];
function Video({uri,onEnd,contentFit='cover'}:{uri:string;onEnd?:()=>void;contentFit?:'cover'|'contain'}){
 const player=useVideoPlayer(uri,p=>{p.loop=false;});
 React.useEffect(()=>{if(!onEnd)return;const subscription=player.addListener('playToEnd',onEnd);return()=>subscription.remove();},[player,onEnd]);
 return <VideoView player={player} style={[StyleSheet.absoluteFill,{width:'100%',height:'100%'}]} nativeControls contentFit={contentFit} />;
}
function MediaCard({review,saved,toggle,open,share,height,liked,like,counts,busy}:{review:Review;saved:boolean;toggle:()=>void;open:()=>void;share:()=>void;height:number;liked:boolean;like:()=>void;counts?:PostStats;busy:boolean}){
 const [ended,setEnded]=useState(false);
 const gesture=React.useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>g.dy < -18 && Math.abs(g.dy)>Math.abs(g.dx)*1.5,onPanResponderRelease:(_,g)=>{if(g.dy < -45)open();}}),[open]);
 return <View style={s.mediaCard}>
  <View style={s.cardHeading}><View style={s.authorAvatar}><Text style={s.authorInitial}>{review.author[0]?.toUpperCase()||'↗'}</Text></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.cardAuthor}>{review.author}</Text><View style={{alignSelf:'flex-start',backgroundColor:categoryColor(review.category),borderRadius:99,paddingHorizontal:9,paddingVertical:2,marginTop:2}}><Text style={{color:p.ink,fontSize:11,fontWeight:'700'}}>{review.category}</Text></View></View><View style={s.categoryTag}><Text style={s.tagText}>{review.kind==='video'?'VIDEO':'FOTO'}</Text></View></View>
  <View style={[s.mediaArea,{height:Math.max(230,height-85),backgroundColor:review.color}]}>
  {review.media?.type==='video'?<Video uri={review.media.uri} onEnd={()=>setEnded(true)}/>:review.media?<Image source={{uri:review.media.uri}} style={StyleSheet.absoluteFill} resizeMode="cover"/>:<View style={s.placeholder}><Text style={s.symbol}>{review.symbol}</Text><Text style={s.placeholderText}>ESPACIO PARA FOTO O VIDEO</Text><Text style={s.placeholderText}>MAQUETA · LUGAR FICTICIO</Text></View>}
  <View style={s.bottomOverlay} {...gesture.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel={'Ver detalles de '+review.place} onPress={open} style={s.detailsButton}><View style={{flex:1,minWidth:0}}><Text numberOfLines={2} style={s.place}>{review.place}</Text><Text style={s.detailsText}>{ended?'¿Vamos? Ver detalles':'Ver detalles · desliza hacia arriba'}</Text></View><View style={s.detailArrow}><Icon name="arrow" size={21}/></View></Pressable></View>
  </View>
  <View style={s.cardActions}><Pressable accessibilityRole="button" accessibilityLabel={liked?'Quitar me gusta':'Me gusta'} disabled={busy} onPress={like} style={s.actionControl}><Icon name="heart" filled={liked} color={liked?p.violet:p.ink}/><Text style={s.actionCount}>{counts?.likes??'—'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={'Comentarios de '+review.place} onPress={open} style={s.actionControl}><Icon name="message" size={22}/><Text style={s.actionCount}>{counts?.comments??'—'}</Text></Pressable><View style={{flex:1}}/>{review.cloud&&<Pressable accessibilityRole="button" accessibilityLabel={'Compartir reseña de '+review.place} onPress={share} style={s.actionControl}><Icon name="arrow" size={23}/></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel={saved?'Quitar de pendientes':'Guardar en pendientes'} disabled={busy} onPress={toggle} style={s.actionControl}><Icon name="bookmark" filled={saved} color={saved?p.violet:p.ink}/></Pressable></View>
 </View>;
}

const initialReviews:Review[]=[...seed,...seed.map((r,i)=>({...r,id:'v'+i,kind:'video' as const,text:r.text,place:r.place+' · Video de maqueta',symbol:'▷'}))];
export default function App(){
 const {account,review:reviewParam}=useLocalSearchParams<{account?:string;review?:string|string[]}>();
 const {height}=useWindowDimensions();
 const [ownProfile,setOwnProfile]=useState<Profile|null>(null);
 const [authReady,setAuthReady]=useState(false);
 const [userId,setUserId]=useState<string|null>(null),[feedError,setFeedError]=useState(''),[feedBusy,setFeedBusy]=useState(false);
 const feedGeneration=React.useRef(0),uploadToken=React.useRef('');
 const [tab,setTab]=useState('Fotos'),[audience,setAudience]=useState('Para ti'),[reviews,setReviews]=useState(initialReviews),[detail,setDetail]=useState<Review|null>(null);
 const [profileCategory,setProfileCategory]=useState('Todas');
 const [focus,setFocus]=useState('Todo'),[focusOpen,setFocusOpen]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [profileStatus,setProfileStatus]=useState<ProfileStatus>('loading');
 const onProfileStatus=React.useCallback((status:ProfileStatus)=>setProfileStatus(previous=>status==='loading'&&previous==='complete'?previous:status),[]);
 const accent=focus==='Todo'?p.lime:categoryColors[focus];
 const [following,setFollowing]=useState<string[]>([]),[person,setPerson]=useState<string|null>(null),[showSaved,setShowSaved]=useState(false);
 React.useEffect(()=>{if(account==='1'){setTab('Perfil');setPerson(null);setShowSaved(false);}},[account]);
 const [activePerson,setActivePerson]=useState<PublicProfile|null>(null),[socialError,setSocialError]=useState(''),[followBusy,setFollowBusy]=useState(false),[socialAttempt,setSocialAttempt]=useState(0),[followingReady,setFollowingReady]=useState(false);
 const [profileReviews,setProfileReviews]=useState<Review[]>([]),[followReviews,setFollowReviews]=useState<Review[]>([]),[profileBusy,setProfileBusy]=useState(false),[followFeedBusy,setFollowFeedBusy]=useState(false),[profileError,setProfileError]=useState(''),[followFeedError,setFollowFeedError]=useState('');
 const socialGeneration=React.useRef(0);
 React.useEffect(()=>{let active=true;socialGeneration.current++;setFollowing([]);setFollowingReady(false);setSocialError('');setFollowBusy(false);if(!userId){setFollowingReady(true);return;}loadFollowing(userId).then(ids=>{if(active){setFollowing(ids);setFollowingReady(true);}}).catch(e=>{if(active)setSocialError(e.message);});return()=>{active=false;};},[userId,socialAttempt]);
 React.useEffect(()=>{if(tab!=='Perfil')return;let active=true;setProfileReviews([]);setProfileError('');const target=person||userId;if(!target){setProfileBusy(false);return;}setProfileBusy(true);loadPosts({userId:target}).then(rows=>{if(active)setProfileReviews(rows);}).catch(e=>{if(active)setProfileError(e.message);}).finally(()=>{if(active)setProfileBusy(false);});return()=>{active=false;};},[tab,person,userId,reviews]);
 React.useEffect(()=>{let active=true;setFollowReviews([]);setFollowFeedError('');if(!userId||!followingReady||!following.length){setFollowFeedBusy(false);return;}setFollowFeedBusy(true);loadPosts({userIds:following}).then(rows=>{if(active)setFollowReviews(rows);}).catch(e=>{if(active)setFollowFeedError(e.message);}).finally(()=>{if(active)setFollowFeedBusy(false);});return()=>{active=false;};},[userId,following,followingReady,reviews]);
 const [stories,setStories]=useState<Story[]>([]),[story,setStory]=useState<Story|null>(null);
 const [contentAction,setContentAction]=useState<ContentAction|null>(null),[contentVersion,setContentVersion]=useState(0),[contentBusy,setContentBusy]=useState(false);
 const [shareReview,setShareReview]=useState<Review|null>(null);
 React.useEffect(()=>{Promise.resolve().then(()=>setProfileStatus('loading'));},[userId]);
 React.useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(active){setContentAction(null);setContentBusy(false);setDetail(null);setStory(null);setShareReview(null);}});return()=>{active=false;};},[userId]);
 const openShare=(review:Review)=>{setDetail(null);setShareReview(review);};
 const closeContent=()=>{setContentAction(null);setContentVersion(n=>n+1);};
 const openContent=(action:ContentAction)=>{setDetail(null);setStory(null);setContentBusy(false);setContentAction(action);};
 const contentChanged=(review:Review)=>{
  const change=(rows:Review[])=>rows.map(r=>r.id===review.id?review:r);
  setReviews(change);setProfileReviews(change);setFollowReviews(change);
 };
 const [chat,setChat]=useState<{owner:string;conversation:Conversation}|null>(null);
 const startChat=async(peerId:string)=>{if(followBusy)return;if(!userId){setSocialError('Inicia sesión desde tu Perfil para enviar mensajes.');return;}const owner=userId,generation=socialGeneration.current;setFollowBusy(true);setSocialError('');try{const conversation=await openConversation(owner,peerId);if(generation===socialGeneration.current){setChat({owner,conversation});setTab('Mensajes');}}catch(e){if(generation===socialGeneration.current)setSocialError((e as Error).message);}finally{if(generation===socialGeneration.current)setFollowBusy(false);}};
 const [compose,setCompose]=useState(false),[storyMode,setStoryMode]=useState(false),[media,setMedia]=useState<Media|null>(null),[place,setPlace]=useState(''),[text,setText]=useState(''),[category,setCategory]=useState('Comer'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [uploadProgress,setUploadProgress]=useState<UploadProgress|null>(null),[retryPublication,setRetryPublication]=useState(false);
 const uploadController=React.useRef<AbortController|null>(null),publishLock=React.useRef(false),pickGeneration=React.useRef(0);
 React.useEffect(()=>{pickGeneration.current++;uploadController.current?.abort();uploadController.current=null;publishLock.current=false;setBusy(false);setCompose(false);setMedia(null);setUploadProgress(null);setRetryPublication(false);setError('');},[userId]);
 React.useEffect(()=>()=>{pickGeneration.current++;uploadController.current?.abort();},[]);
 const [clock,setClock]=useState(()=>Date.now());
 const [safetyVersion,setSafetyVersion]=useState(0),[report,setReport]=useState<ReportTarget|null>(null),[blockTarget,setBlockTarget]=useState<{id:string;name:string}|null>(null);
 const shared=useSharedReview(reviewParam,userId,safetyVersion+contentVersion);
 const [searchMode,setSearchMode]=useState<'Reseñas'|'Personas'>('Reseñas');
 const discovery=useDiscovery(userId,safetyVersion+contentVersion,tab==='Buscar'&&searchMode==='Reseñas',focus==='Todo'?'Todas':focus as ReviewCategory);
 const sharedId=shared.review?.id,sharedKind=shared.review?.kind;
 React.useEffect(()=>{let active=true;if(sharedId)Promise.resolve().then(()=>{if(active){setTab(sharedKind==='video'?'Videos':'Fotos');setAudience('Para ti');}});return()=>{active=false;};},[sharedId,sharedKind]);
 const reportItem=(target:ReportTarget)=>{setDetail(null);setStory(null);setChat(null);setReport(target);};
 const blockPerson=(id:string,name:string)=>{setDetail(null);setStory(null);setChat(null);setBlockTarget({id,name});};
 const safetyLogin=()=>{setReport(null);setBlockTarget(null);setPerson(null);setActivePerson(null);setTab('Perfil');};
 const refresh=React.useCallback(async()=>{const generation=++feedGeneration.current;setFeedBusy(true);setFeedError('');const results=await Promise.allSettled([loadPosts(),loadStories()]);if(generation!==feedGeneration.current)return;if(results[0].status==='fulfilled')setReviews(results[0].value.length?results[0].value:initialReviews);if(results[1].status==='fulfilled')setStories(results[1].value);setFeedError(results.filter(r=>r.status==='rejected').map(r=>r.status==='rejected'?(r.reason instanceof Error?r.reason.message:'No se pudo actualizar.'):'').join(' '));setFeedBusy(false);},[]);
 React.useEffect(()=>{refresh();const id=setInterval(refresh,50*60*1000);if(!supabase){Promise.resolve().then(()=>setAuthReady(true));return()=>clearInterval(id);}const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setUserId(next?.user.id||null);setAuthReady(true);});supabase.auth.getSession().then(({data})=>{setUserId(data.session?.user.id||null);setAuthReady(true);});return()=>{clearInterval(id);subscription.unsubscribe();feedGeneration.current++;};},[refresh]);
 React.useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(id);},[]);
 React.useEffect(()=>{if(story&&story.expires<=clock)setStory(null);},[clock,story]);
 const interactions=useInteractions(userId,[...reviews,...profileReviews,...followReviews,...discovery.reviews,...(detail?[detail]:[]),...(shared.review?[shared.review]:[])].filter(r=>r.cloud).map(r=>r.id),reviews);
 const {saved,liked}=interactions;
 const contentWithdrawn=(target:{kind:'post'|'story';id:string})=>{
  feedGeneration.current++;
  if(target.kind==='post'){
   const remove=(rows:Review[])=>rows.filter(r=>r.id!==target.id);
   setReviews(remove);setProfileReviews(remove);setFollowReviews(remove);
  }else setStories(rows=>rows.filter(r=>r.id!==target.id));
  setContentVersion(n=>n+1);interactions.retry();
 };
 const safetyChanged=()=>{setBlockTarget(null);setDetail(null);setStory(null);setChat(null);setActivePerson(null);setPerson(null);setProfileReviews([]);setFollowReviews([]);setSafetyVersion(n=>n+1);setSocialAttempt(n=>n+1);interactions.retry();notices.refresh();setTab('Perfil');};
 React.useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(active){setReviews(initialReviews);setStories([]);refresh();}});return()=>{active=false;};},[userId,safetyVersion,refresh]);
 const notices=useNotifications(userId);
 const moderator=useModerator(userId);
 const [noticeOpen,setNoticeOpen]=useState(false),[noticeError,setNoticeError]=useState(''),[noticeBusy,setNoticeBusy]=useState(false);
 const noticeLock=React.useRef(false);
 const openNotice=async(row:Notification)=>{if(noticeLock.current)return;noticeLock.current=true;setNoticeBusy(true);setNoticeError('');try{
  const target=row.kind==='follow'?await getPublicProfile(row.actor_id):null;
  const post=row.kind!=='follow'&&row.post_id?(await loadPosts({postIds:[row.post_id]}))[0]:null;
  if(row.kind==='follow'?!target:!post)throw new Error(row.kind==='follow'?'Este perfil ya no está disponible.':'Esta publicación ya no está disponible.');
  if(!await notices.mark(row.id))return;
  setNoticeOpen(false);if(target){setActivePerson(target);setPerson(target.id);setShowSaved(false);setCategory('Fotos');setTab('Perfil');}else if(post)setDetail(post);
 }catch(e){setNoticeError(e instanceof Error?e.message:'No se pudo abrir el aviso.');}finally{noticeLock.current=false;setNoticeBusy(false);}};
 const toggle=(r:Review)=>interactions.change(r.id,'save',!!r.cloud);
 const like=(r:Review)=>interactions.change(r.id,'like',!!r.cloud);
 const follow=async(id:string)=>{if(followBusy)return;setSocialError('');if(!userId){setSocialError('Inicia sesión desde tu Perfil para seguir personas.');return;}if(!followingReady){setSocialError('Primero vuelve a cargar tu seguimiento.');return;}const generation=socialGeneration.current;setFollowBusy(true);try{await changeFollow(userId,id,!following.includes(id));const ids=await loadFollowing(userId);if(generation===socialGeneration.current)setFollowing(ids);}catch(e){if(generation===socialGeneration.current)setSocialError(e instanceof Error?e.message:'No se pudo cambiar el seguimiento.');}finally{if(generation===socialGeneration.current)setFollowBusy(false);}};
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={fn} style={[s.button,disabled&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const newMedia=(isStory=false)=>{if(busy||publishLock.current)return;if(reviewParam!==undefined)router.setParams({review:undefined});pickGeneration.current++;uploadToken.current=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);setStoryMode(isStory);setCategory('Comer');setMedia(null);setPlace('');setText('');setError('');setUploadProgress(null);setRetryPublication(false);setCompose(true);};
 const pick=async()=>{
  if(busy||publishLock.current)return;
  const generation=++pickGeneration.current;setError('');
  // A web picker may not report Cancel; avoid locking the form while it is open.
  if(Platform.OS!=='web')setBusy(true);
  try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],allowsEditing:false,quality:.85});
   if(generation!==pickGeneration.current||result.canceled)return;
   const a=result.assets[0];if(a.type!=='image'&&a.type!=='video')throw new Error('Selecciona una foto o video.');
   setBusy(true);
   const chosen=await prepareMedia({uri:a.uri,type:a.type,mimeType:a.mimeType,fileName:a.fileName||undefined,file:a.file,size:a.fileSize,duration:a.duration? a.duration/1000:undefined});
   if(generation!==pickGeneration.current)return;
   setMedia(chosen);setUploadProgress(null);setRetryPublication(false);uploadToken.current=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  }catch(e){if(generation===pickGeneration.current)setError(e instanceof Error?e.message:'No se pudo abrir el archivo. Prueba otro formato.');}
  finally{if(generation===pickGeneration.current)setBusy(false);}
 };
 const publish=async()=>{
  if(busy||publishLock.current)return;
  if(!media){setError('Selecciona una foto o video.');return;}
  if(!storyMode&&place.trim().length<2){setError('Escribe el nombre del lugar.');return;}
  publishLock.current=true;pickGeneration.current++;const controller=new AbortController();uploadController.current=controller;
  setBusy(true);setError('');setRetryPublication(false);
  const options={signal:controller.signal,progress:(value:UploadProgress)=>{if(uploadController.current===controller&&!controller.signal.aborted)setUploadProgress(value);}};
  try{if(storyMode)await publishStory(media,uploadToken.current,options);else await publishPost(media,place,category,text,uploadToken.current,options);
   if(uploadController.current!==controller)return;
   setCompose(false);setMedia(null);setUploadProgress(null);setTab(storyMode?'Fotos':media.type==='image'?'Fotos':'Videos');setAudience('Para ti');await refresh();
  }catch(e){if(uploadController.current===controller){setError(e instanceof UploadPaused?e.message:e instanceof Error?e.message:'No se pudo publicar. Intenta de nuevo.');setRetryPublication(true);setUploadProgress(value=>value?{...value,sent:value.accepted??value.sent,phase:'paused'}:null);}}
  finally{if(uploadController.current===controller){uploadController.current=null;publishLock.current=false;setBusy(false);}}
 };
 const renderCard=(r:Review,small=false)=><MediaCard key={r.id} review={r} saved={saved.includes(r.id)} toggle={()=>toggle(r)} open={()=>setDetail(r)} share={()=>openShare(r)} liked={liked.includes(r.id)} like={()=>like(r)} counts={interactions.stats[r.id]} busy={interactions.busy} height={small?340:tab==='Videos'?Math.max(430,Math.min(740,height-180)):430}/>;
 // Feed único: lo de quienes sigues; sin seguidos, lo más reciente de la comunidad. El 10% de cerca de ti queda apartado hasta tener ubicación real.
 const list=(following.length?followReviews:reviews).filter(r=>r.kind===(tab==='Videos'?'video':'image')&&(focus==='Todo'||r.category===focus));
 const activeStories=stories.filter(st=>st.expires>clock);
 const profileList=(showSaved?interactions.savedPosts:profileReviews.filter(r=>r.kind===(category==='Videos'?'video':'image'))).filter(r=>profileCategory==='Todas'||r.category===profileCategory);
 const tabs:[string,IconName][]=[['Fotos','photos'],['Videos','video'],['Mensajes','message'],['Buscar','search'],['Perfil','profile']];
 if(!userId)return <View style={s.app}><StatusBar style="dark"/><View style={s.header}><View style={s.headerInner}><View style={s.brandGroup}><Text accessibilityLabel="Por Ahí" style={s.brand}>por ahí</Text><View style={s.brandMark}><Icon name="arrow" size={20}/></View></View></View></View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><View style={s.intro}><Text style={s.kicker}>BIENVENIDO</Text><Text style={s.introTitle}>Entra para ver los planes.</Text><Text style={s.introNote}>Inicia sesión o crea tu cuenta para explorar y compartir recomendaciones.</Text></View>{authReady?<View style={s.profileBody}><Account onProfileChange={setOwnProfile}/></View>:<Text style={s.demo}>Cargando…</Text>}</ScrollView></View>;
 if(profileStatus!=='complete')return <View style={s.app}><StatusBar style="dark"/><View style={s.header}><View style={s.headerInner}><View style={s.brandGroup}><Text accessibilityLabel="Por Ahí" style={s.brand}>por ahí</Text><View style={s.brandMark}><Icon name="arrow" size={20}/></View></View></View></View>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><View style={s.profileBody}><Account onboarding onProfileChange={setOwnProfile} onProfileStatus={onProfileStatus}/></View></ScrollView></View>;
 return <View style={s.app}><StatusBar style="dark"/><View style={s.header}><View style={s.headerInner}><View style={s.brandGroup}><Text accessibilityLabel="Por Ahí" style={s.brand}>por ahí</Text><Pressable accessibilityRole="button" accessibilityLabel={'Filtro de categoría: '+focus} onPress={()=>setFocusOpen(true)} hitSlop={12} style={[s.brandMark,{backgroundColor:accent}]}><Icon name="arrow" size={20}/></Pressable>{focus!=='Todo'&&<Text style={{fontSize:12,fontWeight:'800',color:p.ink,marginLeft:2}}>{focus}</Text>}</View><View style={s.headerActions}><Pressable accessibilityRole="button" accessibilityLabel="Nueva foto o video" onPress={()=>newMedia()} style={s.createButton}><Icon name="plus" color={p.onDark} size={22}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={'Notificaciones'+(notices.unread?' · '+notices.unread+' sin leer':'')} onPress={()=>{setNoticeError('');setNoticeOpen(true);notices.refresh();}} style={s.headerControl}><Icon name="bell" size={23}/>{notices.unread>0&&<View style={s.noticeBadge}><Text style={s.noticeCount}>{notices.unread>99?'99+':notices.unread}</Text></View>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="Mis guardados" onPress={()=>{setTab('Perfil');setPerson(null);setActivePerson(null);setShowSaved(true);}} style={s.headerControl}><Icon name="bookmark" size={23}/></Pressable></View></View></View>
 <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={feedBusy} onRefresh={()=>{interactions.retry();refresh();}} tintColor={p.violet}/>}>{!!interactions.error&&<View style={s.form}><Text accessibilityRole="alert" style={s.error}>{interactions.error}</Text>{button('Reintentar interacciones',interactions.retry,interactions.busy)}</View>}
 {(tab==='Fotos'||tab==='Videos')&&shared.requested&&<><View style={s.form}><Text style={s.personName}>Una recomendación para ti</Text>{button('Explorar otras recomendaciones',()=>{router.setParams({review:undefined});setAudience('Para ti');})}{shared.loading&&<Text accessibilityRole="alert" style={s.body}>Cargando reseña…</Text>}{!!shared.error&&<Text accessibilityRole="alert" style={s.body}>{shared.error}</Text>}{shared.review&&button('Actualizar reseña',shared.retry,shared.loading)}{!!shared.error&&shared.valid&&button('Reintentar reseña',shared.retry)}</View>{shared.review&&renderCard(shared.review)}</>}
 {(tab==='Fotos'||tab==='Videos')&&!shared.requested&&<>{tab==='Fotos'&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storyRow}><Pressable accessibilityRole="button" accessibilityLabel="Crear story" onPress={()=>newMedia(true)} style={s.storyItem}><View style={s.storyCircle}><Text style={s.storyLetter}>＋</Text></View><Text style={s.storyName}>Tu story</Text></Pressable>{activeStories.map(st=><Pressable key={st.id} accessibilityRole="button" accessibilityLabel={'Ver story de '+st.name} onPress={()=>setStory(st)} style={s.storyItem}><View style={[s.storyCircle,{borderColor:p.violet,backgroundColor:p.violet}]}><Text style={[s.storyLetter,{color:'#fff'}]}>{st.name[0]}</Text></View><Text numberOfLines={1} style={s.storyName}>{st.name.split(' ')[0]}</Text></Pressable>)}</ScrollView>}<View style={s.feedToolbar}><Text style={s.feedNote}>{following.length?'Publicaciones de las personas que sigues.':reviews.some(r=>r.cloud)?'Lo más reciente de la comunidad. Sigue a personas desde Buscar para personalizar tu feed.':'Ejemplos ficticios para explorar la app.'}</Text></View>{!!feedError&&<Text accessibilityRole="alert" style={s.body}>{feedError}</Text>}{followFeedBusy&&<Text style={s.demo}>Cargando publicaciones de quienes sigues…</Text>}{!!(socialError||followFeedError)&&<Text accessibilityRole="alert" style={s.error}>{socialError||followFeedError}</Text>}{!!socialError&&button('Recargar seguimiento',()=>setSocialAttempt(n=>n+1))}{list.map(r=>renderCard(r))}{!list.length&&<View style={s.form}><Text style={s.body}>Todavía no hay contenido en esta vista. Sigue otro perfil desde Buscar o añade tu propia foto o video.</Text></View>}</>}
 {tab==='Buscar'&&<DiscoverySearch key={(userId||'guest')+'-'+safetyVersion} mode={searchMode} setMode={setSearchMode} search={discovery} renderReview={r=>renderCard(r,true)} openPerson={u=>{setActivePerson(u);setPerson(u.id);setShowSaved(false);setCategory('Fotos');setTab('Perfil');}}/>}
 {tab==='Mensajes'&&<Inbox key={(userId||'guest')+'-'+safetyVersion} userId={userId} open={conversation=>{if(userId)setChat({owner:userId,conversation});}} login={()=>{setPerson(null);setActivePerson(null);setTab('Perfil');}}/>}
 {tab==='Perfil'&&<>
  <ProfileHeader own={!activePerson} onSettings={()=>setSettingsOpen(true)} name={activePerson?activePerson.name:(ownProfile?.display_name||'Tu perfil')} symbol={activePerson?activePerson.symbol:(ownProfile?.display_name?.[0]?.toUpperCase()||'T')} handle={activePerson?'@'+activePerson.handle:ownProfile?.username?'@'+ownProfile.username:'Tu próximo plan empieza aquí'} bio={activePerson?activePerson.bio:(ownProfile?.bio||'Tus lugares, tus experiencias y tus próximos planes.')} stats={activePerson?[{label:'publicaciones',value:profileBusy?'—':profileReviews.length+(profileReviews.length===60?'+':'')}]:[{label:'publicaciones',value:profileBusy?'—':profileReviews.length+(profileReviews.length===60?'+':'')},{label:'siguiendo',value:userId&&!followingReady?'—':String(following.length)},{label:'guardados',value:userId&&!interactions.ready?'—':String(saved.length)}]}/>
  <View style={s.profileBody}>
   {!activePerson&&userId&&<PendingContent key={userId} userId={userId} version={contentVersion} open={openContent}/>}
   {!activePerson&&userId&&moderator.allowed&&button('Administración',()=>router.push('/admin'))}
   {!!socialError&&<Text accessibilityRole="alert" style={s.error}>{socialError}</Text>}{!!socialError&&button('Recargar seguimiento',()=>setSocialAttempt(n=>n+1))}
   {activePerson&&activePerson.id===userId&&<Text style={s.demo}>Este es tu perfil público.</Text>}
   {activePerson&&activePerson.id!==userId&&<>
    <View style={s.profileActions}><Pressable accessibilityRole="button" disabled={followBusy||!followingReady} onPress={()=>follow(activePerson.id)} style={[s.profilePrimary,(followBusy||!followingReady)&&{opacity:.5}]}><Text style={s.profilePrimaryText}>{followBusy?'Guardando…':following.includes(activePerson.id)?'Dejar de seguir':'Seguir'}</Text></Pressable><Pressable accessibilityRole="button" disabled={followBusy} onPress={()=>startChat(activePerson.id)} style={[s.profileSecondary,followBusy&&{opacity:.5}]}><Icon name="message" size={20}/><Text style={s.profilePrimaryText}>{followBusy?'Abriendo…':'Enviar mensaje'}</Text></Pressable></View>
    <View style={s.profileSafety}><Pressable accessibilityRole="button" onPress={()=>reportItem({kind:'profile',id:activePerson.id,label:activePerson.name})} style={s.profileTextControl}><Text style={s.profileSafetyText}>Reportar perfil</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>blockPerson(activePerson.id,activePerson.name)} style={s.profileTextControl}><Text style={s.profileSafetyText}>Bloquear usuario</Text></Pressable></View>
   </>}
   <View style={s.profileTabs}>{(activePerson?['Fotos','Videos']:['Fotos','Videos','Guardados']).map(label=>{const selected=showSaved?label==='Guardados':label===category;return <Pressable key={label} accessibilityRole="button" accessibilityState={{selected}} onPress={()=>{setShowSaved(label==='Guardados');setCategory(label);}} style={[s.profileTab,selected&&s.profileTabActive]}><Icon name={label==='Fotos'?'photos':label==='Videos'?'video':'bookmark'} size={18} color={selected?p.onDark:p.muted}/><Text style={[s.profileTabText,selected&&{color:p.onDark}]}>{label}</Text></Pressable>;})}</View>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10}}>{['Todas',...Object.keys(categoryColors)].map(c=>{const on=profileCategory===c;const col=c==='Todas'?p.ink:categoryColors[c];return <Pressable key={c} accessibilityRole="button" accessibilityLabel={'Categoría '+c} accessibilityState={{selected:on}} onPress={()=>setProfileCategory(c)} style={{flexDirection:'row',alignItems:'center',gap:6,borderRadius:99,paddingHorizontal:12,minHeight:36,borderWidth:1.5,borderColor:col,backgroundColor:on?col:p.surface}}>{c!=='Todas'&&<View style={{width:8,height:8,borderRadius:4,backgroundColor:on?p.ink:col}}/>}<Text style={{fontSize:13,fontWeight:'700',color:on&&c==='Todas'?p.onDark:p.ink}}>{c}</Text></Pressable>;})}</View>
  </View>
  {showSaved&&<><Text style={s.demo}>{!userId?'Inicia sesión para ver tus guardados.':!interactions.ready?'Cargando guardados…':interactions.savedBusy?'Cargando publicaciones guardadas…':!saved.length?'Todavía no has guardado publicaciones.':'Tus publicaciones guardadas.'}</Text>{!!interactions.savedError&&<Text accessibilityRole="alert" style={s.error}>{interactions.savedError}</Text>}{!!interactions.savedError&&button('Reintentar guardados',interactions.retry)}</>}
  {profileBusy&&!showSaved&&<Text style={s.demo}>Cargando publicaciones…</Text>}{!!profileError&&!showSaved&&<Text accessibilityRole="alert" style={s.error}>{profileError}</Text>}
  {profileList.map(r=>renderCard(r,true))}{profileCategory!=='Todas'&&!profileBusy&&!profileList.length&&<Text style={s.demo}>No hay publicaciones de esta categoría.</Text>}
  {!activePerson&&!showSaved&&!profileBusy&&!profileError&&!profileReviews.length&&<View style={s.profileEmpty}><Icon name="photos" size={28} color={p.violet}/><Text style={s.profileEmptyTitle}>Aquí van tus recomendaciones.</Text><Text style={s.body}>Pulsa ＋ para añadir tu primera foto o video. Stories y reseñas son formatos separados.</Text></View>}
 </>}
 </ScrollView><View style={s.nav}>{tabs.map(([t,icon])=><Pressable key={t} accessibilityRole="button" accessibilityLabel={'Ir a '+t} accessibilityState={{selected:tab===t}} onPress={()=>{if(reviewParam!==undefined)router.setParams({review:undefined});setTab(t);if(t==='Perfil'){setPerson(null);setActivePerson(null);setShowSaved(false);setCategory('Fotos');}}} style={s.navItem}><View style={[s.navIconBox,tab===t&&s.navIconActive,tab===t&&{backgroundColor:accent}]}><Icon name={icon} size={25} color={tab===t?p.ink:p.darkMuted}/></View></Pressable>)}</View>
 <Modal visible={!!detail} transparent animationType="slide" onRequestClose={()=>setDetail(null)}>{detail&&<ReviewDetails review={detail} saved={saved.includes(detail.id)} busy={interactions.busy} error={interactions.error} close={()=>setDetail(null)} save={()=>toggle(detail)} retry={interactions.retry} share={detail.cloud?()=>openShare(detail):undefined} manage={detail.cloud&&userId&&detail.userId===userId?()=>openContent({kind:'post',id:detail.id,owner:userId,label:detail.place,review:detail}):undefined} report={detail.cloud&&detail.userId!==userId?()=>reportItem({kind:'post',id:detail.id,label:detail.place}):undefined} block={detail.cloud&&detail.userId!==userId&&detail.userId?()=>blockPerson(detail.userId!,detail.author):undefined}>{detail.cloud?<Comments key={detail.id+'-'+userId} postId={detail.id} userId={userId} onChange={interactions.refreshCounts} report={reportItem}/>:<Text style={s.demo}>Los comentarios están disponibles en publicaciones reales.</Text>}</ReviewDetails>}</Modal>
 <Modal visible={noticeOpen} animationType="slide" onRequestClose={()=>setNoticeOpen(false)}><NotificationsPanel userId={userId} rows={notices.rows} unread={notices.unread} loading={notices.loading} busy={notices.busy||noticeBusy} error={noticeError||notices.error} refresh={()=>{setNoticeError('');notices.refresh();}} mark={()=>notices.mark()} open={openNotice} close={()=>setNoticeOpen(false)} login={()=>{setNoticeOpen(false);setPerson(null);setActivePerson(null);setShowSaved(false);setTab('Perfil');}}/></Modal>
 <Modal visible={compose} animationType="slide" onRequestClose={()=>{if(!busy){pickGeneration.current++;setCompose(false);}}}><MediaComposer storyMode={storyMode} media={media} busy={busy} place={place} category={category} text={text} error={error} retry={retryPublication} progress={uploadProgress} close={()=>{pickGeneration.current++;setCompose(false);}} pick={pick} publish={publish} pause={()=>uploadController.current?.abort()} setPlace={setPlace} setCategory={setCategory} setText={setText} preview={media?(media.type==='image'?<Image source={{uri:media.uri}} style={StyleSheet.absoluteFill} resizeMode="contain"/>:<Video uri={media.uri} contentFit="contain"/>):null}/></Modal>
 <Modal visible={!!story} animationType="fade" onRequestClose={()=>setStory(null)}>{story&&<StoryViewer story={story} own={!!userId&&story.userId===userId} close={()=>setStory(null)} remove={()=>{if(userId&&story.userId===userId)openContent({kind:'story',id:story.id,owner:userId,label:'Story de '+story.name});}} report={()=>reportItem({kind:'story',id:story.id,label:'Story de '+story.name})} media={story.media?(story.media.type==='image'?<Image source={{uri:story.media.uri}} style={StyleSheet.absoluteFill} resizeMode="contain"/>:<Video uri={story.media.uri} contentFit="contain"/>):null}/>}</Modal>
 <Modal visible={!!shareReview} animationType="slide" onRequestClose={()=>setShareReview(null)}>{shareReview&&<ShareReview key={shareReview.id+'-'+userId} review={shareReview} close={()=>setShareReview(null)}/>}</Modal>
 <Modal visible={!!contentAction&&contentAction.owner===userId} animationType="slide" onRequestClose={()=>{if(!contentBusy)closeContent();}}>{contentAction&&contentAction.owner===userId&&<ContentEditor key={contentAction.kind+contentAction.id+'-'+userId} action={contentAction} close={closeContent} changed={contentChanged} withdrawn={contentWithdrawn} done={()=>{interactions.retry();notices.refresh();refresh();}} busyChange={setContentBusy}/>}</Modal>
 <Modal visible={!!chat&&chat.owner===userId} animationType="slide" onRequestClose={()=>setChat(null)}>{chat&&chat.owner===userId&&userId&&<Chat key={chat.owner+chat.conversation.id} userId={userId} conversation={chat.conversation} close={()=>setChat(null)} report={reportItem} block={()=>blockPerson(chat.conversation.peer_id,chat.conversation.peer_name)}/>}</Modal>
 <Modal visible={!!report} animationType="slide" onRequestClose={()=>setReport(null)}>{report&&<ReportForm key={report.kind+report.id+'-'+userId} target={report} userId={userId} close={()=>setReport(null)} login={safetyLogin}/>}</Modal>
 <Modal visible={!!blockTarget} animationType="slide" onRequestClose={()=>setBlockTarget(null)}>{blockTarget&&<BlockConfirm key={blockTarget.id+'-'+userId} target={blockTarget} userId={userId} close={()=>setBlockTarget(null)} done={safetyChanged} login={safetyLogin}/>}</Modal>
 <Modal visible={focusOpen} transparent animationType="fade" onRequestClose={()=>setFocusOpen(false)}><Pressable accessibilityLabel="Cerrar filtro" onPress={()=>setFocusOpen(false)} style={{flex:1,backgroundColor:'rgba(23,23,28,.35)'}}><View style={{marginTop:Platform.OS==='ios'?100:64,marginHorizontal:18,alignSelf:'flex-start',minWidth:230,backgroundColor:p.surface,borderRadius:18,padding:8}}>{['Todo','Comer','Divertirse','Explorar'].map(o=>{const col=o==='Todo'?p.lime:categoryColors[o];return <Pressable key={o} accessibilityRole="button" accessibilityState={{selected:focus===o}} onPress={()=>{setFocus(o);setFocusOpen(false);}} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:48,paddingHorizontal:12,borderRadius:12,backgroundColor:focus===o?p.soft:'transparent'}}><View style={{width:16,height:16,borderRadius:8,backgroundColor:col,borderWidth:o==='Todo'?1:0,borderColor:p.ink}}/><Text style={{fontSize:15,fontWeight:focus===o?'800':'600',color:p.ink}}>{o}</Text></Pressable>;})}</View></Pressable></Modal>
 <Modal visible={settingsOpen} animationType="slide" onRequestClose={()=>setSettingsOpen(false)}><View style={{flex:1,backgroundColor:p.canvas}}><ScreenHeader close={()=>setSettingsOpen(false)} label="Cerrar configuración"/><ScrollView contentContainerStyle={{padding:20,paddingBottom:40,width:'100%',maxWidth:590,alignSelf:'center'}} keyboardShouldPersistTaps="handled"><Account settings onProfileChange={setOwnProfile} onProfileStatus={onProfileStatus}/>{!!userId&&<BlockedList key={userId} userId={userId} onChange={safetyChanged}/>}</ScrollView></View></Modal>
 </View>;
}
