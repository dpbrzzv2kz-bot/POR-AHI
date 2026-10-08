import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {View,Text,TextInput,Pressable,Modal,FlatList,KeyboardAvoidingView,StyleSheet,Platform,useWindowDimensions} from 'react-native';
import type {ReportTarget} from '../lib/safety';
import type {Review} from '../lib/posts';
import {loadComments,addComment,removeComment,commentId,loadCommentReactions,setCommentReaction,type Comment,type CommentReaction,type CommentStats} from '../lib/interactions';
import {palette as p} from '../lib/theme';
import {softReactionFeedback} from '../lib/reactionFeedback';
import Icon from './Icon';

const ago=(iso:string)=>{
 const seconds=(Date.now()-Date.parse(iso))/1000;
 if(!Number.isFinite(seconds)||seconds<60)return 'ahora';
 const minutes=Math.floor(seconds/60);if(minutes<60)return 'hace '+minutes+' min';
 const hours=Math.floor(minutes/60);if(hours<24)return 'hace '+hours+' h';
 const days=Math.floor(hours/24);if(days<7)return 'hace '+days+' d';
 return new Date(iso).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
};
const empty:CommentStats={hearts:0,tomatoes:0};

// Comentarios como en TikTok: una hoja que sube desde abajo, con respuestas en hilo (dos niveles), corazón y tomate por comentario,
// y la caja para escribir fija abajo.
function Sheet({review,userId,close,onChange,report}:{review:Review;userId:string|null;close:()=>void;onChange:()=>void;report:(target:ReportTarget)=>void}){
 const {height}=useWindowDimensions();
 const [rows,setRows]=useState<Comment[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState(''),[menu,setMenu]=useState<string|null>(null),[removed,setRemoved]=useState<string|null>(null);
 const [stats,setStats]=useState<Record<string,CommentStats>>({}),[mine,setMine]=useState<Record<string,CommentReaction>>({}),[replyTo,setReplyTo]=useState<{parent:string;name:string}|null>(null),[open,setOpen]=useState<Record<string,boolean>>({});
 const draftId=useRef(''),mounted=useRef(true),lock=useRef(false),input=useRef<TextInput>(null),list=useRef<FlatList<Comment>>(null);
 const reload=useCallback(async(signal?:AbortSignal)=>{
  try{
   const data=await loadComments(review.id,signal);
   if(!mounted.current)return;
   setRows(data);
   if(userId){const found=await loadCommentReactions(userId,data.map(row=>row.id),signal);if(mounted.current){setStats(found.stats);setMine(found.mine);}}
  }finally{if(mounted.current)setLoading(false);}
 },[review.id,userId]);
 useEffect(()=>{mounted.current=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);reload(controller.signal).catch(e=>{if(mounted.current){setError(e instanceof Error?e.message:'No se pudieron cargar los comentarios.');setLoading(false);}});return()=>{mounted.current=false;clearTimeout(timeout);controller.abort();};},[reload]);
 const run=async(action:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();if(mounted.current){onChange();await reload();}}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'No se pudo completar.');}finally{lock.current=false;if(mounted.current)setBusy(false);}};

 // Comentarios principales (lo más nuevo arriba) y sus respuestas (las más antiguas primero). Si el principal ya no está, su hilo tampoco.
 const {tops,repliesOf}=useMemo(()=>{
  const topRows=rows.filter(row=>!row.parent_id).reverse();
  const known=new Set(topRows.map(row=>row.id));
  const map:Record<string,Comment[]>={};
  for(const row of rows)if(row.parent_id&&known.has(row.parent_id))(map[row.parent_id]=map[row.parent_id]||[]).push(row);
  return {tops:topRows,repliesOf:map};
 },[rows]);
 const visible=tops.length+Object.values(repliesOf).reduce((n,list)=>n+list.length,0);

 const send=()=>{
  if(!userId||!draft.trim())return;
  if(!draftId.current)draftId.current=commentId();
  const parent=replyTo?.parent||null;
  run(async()=>{
   await addComment(userId,review.id,draft,draftId.current,parent);
   if(mounted.current){setDraft('');draftId.current='';setReplyTo(null);if(parent)setOpen(value=>({...value,[parent]:true}));else list.current?.scrollToOffset({offset:0,animated:true});}
  });
 };
 const startReply=(row:Comment)=>{
  const parent=row.parent_id||row.id;
  setReplyTo({parent,name:row.author_name});
  if(row.parent_id&&!draft.trim()){setDraft('@'+row.author_name+' ');draftId.current='';}
  setMenu(null);setTimeout(()=>input.current?.focus(),50);
 };
 const react=async(row:Comment,kind:CommentReaction)=>{
  if(!userId)return;
  const current=mine[row.id],next=current===kind?null:kind,before=stats[row.id]||empty;
  const after={hearts:before.hearts-(current==='heart'?1:0)+(next==='heart'?1:0),tomatoes:before.tomatoes-(current==='tomato'?1:0)+(next==='tomato'?1:0)};
  setStats(value=>({...value,[row.id]:after}));
  setMine(value=>{const copy={...value};if(next)copy[row.id]=next;else delete copy[row.id];return copy;});
  try{await setCommentReaction(userId,row.id,next,current);if(next)void softReactionFeedback();}
  catch(e){
   if(!mounted.current)return;
   setStats(value=>({...value,[row.id]:before}));
   setMine(value=>{const copy={...value};if(current)copy[row.id]=current;else delete copy[row.id];return copy;});
   setError(e instanceof Error?e.message:'No se pudo guardar tu reacción.');
  }
 };

 const line=(row:Comment,reply:boolean)=>{
  const count=stats[row.id]||empty,own=mine[row.id];
  return <View style={[s.row,reply&&s.replyRow]}>
   <View style={[s.avatar,reply&&s.avatarSmall]}><Text style={s.initial}>{row.author_name[0]?.toUpperCase()}</Text></View>
   <View style={{flex:1,minWidth:0}}>
    <Text style={s.author}>{row.author_name} <Text style={s.time}>· {ago(row.created_at)}</Text></Text>
    <Text style={s.body}>{row.body}</Text>
    <View style={s.actions}>
     {!!userId&&<Pressable accessibilityRole="button" accessibilityLabel={'Responder a '+row.author_name} onPress={()=>startReply(row)} style={s.link}><Text style={s.linkText}>Responder</Text></Pressable>}
     <Pressable accessibilityRole="button" accessibilityLabel="Más opciones del comentario" onPress={()=>setMenu(menu===row.id?null:row.id)} style={s.link}><Text style={s.linkText}>⋯</Text></Pressable>
    </View>
    {menu===row.id&&<View style={s.menu}>
     {row.user_id===userId
      ?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>{setMenu(null);if(userId)run(async()=>{await removeComment(userId,row.id);if(mounted.current)setRemoved(row.id);});}} style={s.menuButton}><Text style={s.menuText}>Borrar mi comentario</Text></Pressable>
      :<Pressable accessibilityRole="button" onPress={()=>{setMenu(null);report({kind:'comment',id:row.id,label:'Comentario de '+row.author_name});}} style={s.menuButton}><Text style={s.menuText}>Reportar comentario</Text></Pressable>}
    </View>}
   </View>
   <View style={s.reactions}>
    <Pressable accessibilityRole="button" accessibilityLabel={own==='heart'?'Quitar corazón':'Dar corazón'} accessibilityState={{selected:own==='heart'}} disabled={!userId} onPress={()=>{void react(row,'heart');}} style={s.reaction}><Icon name="heart" size={20} filled={own==='heart'} color={own==='heart'?p.violet:p.muted}/><Text style={s.reactionCount}>{count.hearts>0?count.hearts:' '}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={own==='tomato'?'Quitar tomate':'Dar tomate'} accessibilityState={{selected:own==='tomato'}} disabled={!userId} onPress={()=>{void react(row,'tomato');}} style={s.reaction}><Text style={{fontSize:17,opacity:own==='tomato'?1:.4}}>🍅</Text><Text style={s.reactionCount}>{count.tomatoes>0?count.tomatoes:' '}</Text></Pressable>
   </View>
  </View>;
 };

 const title=loading?'Comentarios':visible===0?'Comentarios':visible>=200?'200+ comentarios':visible===1?'1 comentario':visible+' comentarios';
 return <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.wrap}>
  <Pressable accessibilityRole="button" accessibilityLabel="Cerrar comentarios" onPress={close} style={StyleSheet.absoluteFill}/>
  <View style={[s.sheet,{height:Math.round(height*0.72)}]}>
   <View style={s.handle}/>
   <View style={s.header}><View style={{width:44}}/><Text accessibilityRole="header" style={s.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cerrar comentarios" onPress={close} style={s.close}><View style={{transform:[{rotate:'45deg'}]}}><Icon name="plus" size={22}/></View></Pressable></View>
   {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
   <FlatList ref={list} data={tops} keyExtractor={row=>row.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:16,paddingBottom:12,flexGrow:1}}
    ListEmptyComponent={loading?<Text style={s.note}>Cargando comentarios…</Text>:error?null:<View style={s.empty}><Icon name="message" size={34} color={p.muted}/><Text style={s.emptyTitle}>Todavía no hay comentarios</Text><Text style={s.note}>Sé la primera persona en comentar.</Text></View>}
    renderItem={({item:row})=>{
     const replies=repliesOf[row.id]||[],expanded=!!open[row.id];
     return <View>
      {line(row,false)}
      {replies.length>0&&<Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setOpen(value=>({...value,[row.id]:!expanded}))} style={s.thread}><View style={s.threadLine}/><Text style={s.threadText}>{expanded?'Ocultar respuestas':replies.length===1?'Ver 1 respuesta':'Ver '+replies.length+' respuestas'}</Text></Pressable>}
      {expanded&&replies.map(reply=><View key={reply.id}>{line(reply,true)}</View>)}
     </View>;
    }}/>
   {removed&&userId&&<View style={s.undo}><Text style={s.undoText}>Comentario borrado</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>run(async()=>{await removeComment(userId,removed,true);if(mounted.current)setRemoved(null);})}><Text style={s.undoButton}>Deshacer</Text></Pressable></View>}
   {review.cloud?<View style={s.composer}>
    {replyTo&&<View style={s.replying}><Text numberOfLines={1} style={s.replyingText}>Respondiendo a {replyTo.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancelar respuesta" onPress={()=>{setReplyTo(null);}} style={s.replyingClose}><Text style={s.replyingX}>✕</Text></Pressable></View>}
    <View style={s.inputBar}>
     <TextInput ref={input} accessibilityLabel={replyTo?'Escribir respuesta':'Escribir comentario'} value={draft} onChangeText={text=>{setDraft(text);draftId.current='';}} editable={!busy} maxLength={1000} multiline placeholder={replyTo?'Escribe tu respuesta…':'Añade un comentario…'} placeholderTextColor={p.muted} style={s.input}/>
     <Pressable accessibilityRole="button" accessibilityLabel="Enviar" disabled={busy||!draft.trim()} onPress={send} style={[s.send,(busy||!draft.trim())&&{opacity:.35}]}><Icon name="arrow" size={22}/></Pressable>
    </View>
   </View>:<Text style={[s.note,{textAlign:'center',paddingBottom:20}]}>Los comentarios están disponibles en publicaciones reales.</Text>}
  </View>
 </KeyboardAvoidingView>;
}

export default function CommentsSheet({review,userId,close,onChange,report}:{review:Review|null;userId:string|null;close:()=>void;onChange:()=>void;report:(target:ReportTarget)=>void}){
 return <Modal visible={!!review} transparent animationType="slide" onRequestClose={close}>{review&&<Sheet key={review.id} review={review} userId={userId} close={close} onChange={onChange} report={report}/>}</Modal>;
}
const s=StyleSheet.create({wrap:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.35)'},sheet:{backgroundColor:p.surface,borderTopLeftRadius:22,borderTopRightRadius:22,width:'100%',maxWidth:590,alignSelf:'center',overflow:'hidden'},handle:{width:40,height:4,borderRadius:2,backgroundColor:p.line,alignSelf:'center',marginTop:8},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:8,paddingVertical:4,borderBottomWidth:1,borderColor:p.line},title:{fontSize:15,fontWeight:'800',color:p.ink},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},error:{color:p.error,fontSize:13,lineHeight:19,paddingHorizontal:16,paddingTop:10},note:{color:p.muted,fontSize:13,lineHeight:20,paddingVertical:8},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:6,paddingVertical:30},emptyTitle:{fontSize:16,fontWeight:'800',color:p.ink},row:{flexDirection:'row',gap:10,paddingTop:14},replyRow:{marginLeft:46},avatar:{width:36,height:36,borderRadius:18,backgroundColor:p.violetSoft,alignItems:'center',justifyContent:'center'},avatarSmall:{width:28,height:28,borderRadius:14},initial:{color:p.violet,fontWeight:'800',fontSize:13},author:{fontSize:12,fontWeight:'700',color:p.muted},time:{fontWeight:'500'},body:{fontSize:15,lineHeight:22,color:p.ink,marginTop:3},actions:{flexDirection:'row',alignItems:'center',gap:6,marginTop:2},link:{minHeight:36,paddingRight:12,justifyContent:'center'},linkText:{fontSize:12,fontWeight:'700',color:p.muted},menu:{flexDirection:'row',marginTop:2,marginBottom:4},menuButton:{minHeight:36,paddingHorizontal:12,justifyContent:'center',borderRadius:12,backgroundColor:p.soft},menuText:{fontSize:12,fontWeight:'700',color:p.ink},reactions:{alignItems:'center',gap:2,width:40},reaction:{minHeight:44,minWidth:40,alignItems:'center',justifyContent:'center'},reactionCount:{fontSize:11,fontWeight:'700',color:p.muted,height:14},thread:{flexDirection:'row',alignItems:'center',gap:8,marginLeft:46,minHeight:36},threadLine:{width:24,height:1,backgroundColor:p.line},threadText:{fontSize:12,fontWeight:'700',color:p.muted},undo:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginHorizontal:16,marginBottom:8,paddingHorizontal:14,minHeight:44,borderRadius:14,backgroundColor:p.ink},undoText:{color:'#fff',fontSize:13},undoButton:{color:p.lime,fontSize:13,fontWeight:'800'},composer:{borderTopWidth:1,borderColor:p.line,backgroundColor:p.surface},replying:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:16,backgroundColor:p.soft},replyingText:{flex:1,fontSize:12,fontWeight:'700',color:p.muted},replyingClose:{width:44,height:36,alignItems:'center',justifyContent:'center'},replyingX:{color:p.muted,fontSize:14,fontWeight:'800'},inputBar:{flexDirection:'row',alignItems:'flex-end',gap:10,paddingHorizontal:14,paddingTop:10,paddingBottom:Platform.OS==='ios'?30:12},input:{flex:1,minHeight:44,maxHeight:110,paddingHorizontal:16,paddingTop:12,paddingBottom:12,borderRadius:22,backgroundColor:p.soft,color:p.ink,fontSize:15,lineHeight:20},send:{width:44,height:44,borderRadius:22,backgroundColor:p.lime,alignItems:'center',justifyContent:'center'}});
