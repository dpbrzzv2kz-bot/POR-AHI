import React,{useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import type {Story} from '../lib/posts';
import {loadAnswers,loadNames,loadPollSnapshot,submitAnswer,votePoll,type PollSnapshot,type StoryAnswer} from '../lib/storyInteractions';
import type {StoryOverlay} from '../lib/storyOverlays';
import {palette as p} from '../lib/theme';
import StoryOverlayLayer from './StoryOverlayLayer';

type Props={story:Story;userId:string|null;own:boolean;onPause:(holding:boolean)=>void};
const empty:PollSnapshot={counts:{},mine:{}};

// Textos y stickers de una story ya publicada, con las encuestas y preguntas conectadas a la base de datos.
export default function StoryOverlaysConnected({story,userId,own,onPause}:Props){
 const overlays=story.overlays||[];
 const hasPoll=overlays.some(item=>item.type==='poll'),hasQuestion=overlays.some(item=>item.type==='question');
 const [snapshot,setSnapshot]=useState<PollSnapshot>(empty),[notice,setNotice]=useState('');
 const [answering,setAnswering]=useState<StoryOverlay|null>(null),[answer,setAnswer]=useState(''),[sending,setSending]=useState(false);
 const [answers,setAnswers]=useState<StoryAnswer[]|null>(null),[names,setNames]=useState<Record<string,string>>({}),[listOpen,setListOpen]=useState(false);
 useEffect(()=>{
  if(!hasPoll)return;
  let active=true;const controller=new AbortController();
  loadPollSnapshot(story.id,userId,controller.signal).then(next=>{if(active)setSnapshot(next);}).catch(()=>{});
  return()=>{active=false;controller.abort();};
 },[story.id,userId,hasPoll]);
 const vote=(overlayId:string,choice:number)=>{
  if(!userId){setNotice('Inicia sesión para votar.');return;}
  setSnapshot(previous=>{const list=[...(previous.counts[overlayId]||[0,0])];list[choice]+=1;return {counts:{...previous.counts,[overlayId]:list},mine:{...previous.mine,[overlayId]:choice}};});
  votePoll(story.id,overlayId,choice).catch(e=>{setNotice(e instanceof Error?e.message:'No se pudo guardar tu voto.');loadPollSnapshot(story.id,userId).then(setSnapshot).catch(()=>{});});
 };
 const openAnswer=(item:StoryOverlay)=>{if(!userId){setNotice('Inicia sesión para responder.');return;}setAnswer('');setNotice('');setAnswering(item);onPause(true);};
 const closeAnswer=()=>{setAnswering(null);onPause(false);};
 const send=async()=>{
  if(!answering||sending)return;
  setSending(true);
  try{await submitAnswer(story.id,answering.id,answer);setNotice('Respuesta enviada.');closeAnswer();}
  catch(e){setNotice(e instanceof Error?e.message:'No se pudo enviar.');}
  finally{setSending(false);}
 };
 const openList=async()=>{
  setListOpen(true);onPause(true);setAnswers(null);
  try{const rows=await loadAnswers(story.id);setAnswers(rows);setNames(await loadNames(rows.map(row=>row.userId)));}catch(e){setNotice(e instanceof Error?e.message:'No se pudieron cargar las respuestas.');setAnswers([]);}
 };
 const closeList=()=>{setListOpen(false);onPause(false);};
 return <>
  <StoryOverlayLayer overlays={overlays} poll={hasPoll?{showResults:own,counts:snapshot.counts,mine:snapshot.mine,onVote:vote}:undefined} onAnswer={hasQuestion&&!own?openAnswer:undefined}/>
  {own&&hasQuestion&&<Pressable accessibilityRole="button" accessibilityLabel="Ver respuestas" onPress={openList} style={s.answersButton}><Text style={s.answersText}>💬 Ver respuestas</Text></Pressable>}
  {!!notice&&<Pressable accessibilityRole="alert" onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice}</Text></Pressable>}
  <Modal visible={!!answering} transparent animationType="fade" onRequestClose={closeAnswer}>
   <View style={s.backdrop}><View style={s.panel}>
    <Text style={s.title}>{answering?.text}</Text>
    <TextInput autoFocus multiline accessibilityLabel="Tu respuesta" placeholder="Escribe tu respuesta" placeholderTextColor={p.muted} value={answer} onChangeText={setAnswer} maxLength={200} style={s.input}/>
    <View style={s.row}>
     <Pressable accessibilityRole="button" onPress={closeAnswer} style={s.secondary}><Text style={s.secondaryText}>Cancelar</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Enviar respuesta" disabled={sending||!answer.trim()} onPress={()=>{void send();}} style={[s.primary,(sending||!answer.trim())&&{opacity:.4}]}><Text style={s.primaryText}>{sending?'Enviando…':'Enviar'}</Text></Pressable>
    </View>
   </View></View>
  </Modal>
  <Modal visible={listOpen} transparent animationType="fade" onRequestClose={closeList}>
   <View style={s.backdrop}><View style={s.panel}>
    <Text style={s.title}>Respuestas</Text>
    <ScrollView style={{maxHeight:320}}>
     {answers===null&&<Text style={s.muted}>Cargando…</Text>}
     {answers!==null&&!answers.length&&<Text style={s.muted}>Todavía nadie responde.</Text>}
     {(answers||[]).map(row=><View key={row.id} style={s.answer}><Text style={s.answerName}>{names[row.userId]||'Alguien'}</Text><Text style={s.answerText}>{row.answer}</Text></View>)}
    </ScrollView>
    <Pressable accessibilityRole="button" onPress={closeList} style={[s.primary,{marginTop:12}]}><Text style={s.primaryText}>Cerrar</Text></Pressable>
   </View></View>
  </Modal>
 </>;
}
const s=StyleSheet.create({
 answersButton:{position:'absolute',left:16,bottom:28,minHeight:44,paddingHorizontal:16,borderRadius:22,backgroundColor:'rgba(23,23,28,.82)',justifyContent:'center'},answersText:{color:'#fff',fontSize:13,fontWeight:'800'},
 notice:{position:'absolute',left:16,right:16,bottom:84,padding:12,borderRadius:12,backgroundColor:'rgba(23,23,28,.9)'},noticeText:{color:'#fff',fontSize:13,textAlign:'center'},
 backdrop:{flex:1,backgroundColor:'rgba(0,0,0,.6)',justifyContent:'center',padding:24},
 panel:{backgroundColor:p.surface,borderRadius:22,padding:20,width:'100%',maxWidth:460,alignSelf:'center'},
 title:{fontSize:18,fontWeight:'900',color:p.ink,marginBottom:12},
 input:{minHeight:90,borderRadius:14,backgroundColor:p.soft,padding:14,fontSize:16,color:p.ink,textAlignVertical:'top'},
 row:{flexDirection:'row',gap:10,marginTop:12},
 primary:{flex:1,minHeight:48,borderRadius:14,backgroundColor:p.lime,alignItems:'center',justifyContent:'center'},primaryText:{fontSize:14,fontWeight:'800',color:p.ink},
 secondary:{minHeight:48,paddingHorizontal:18,borderRadius:14,borderWidth:1,borderColor:p.line,alignItems:'center',justifyContent:'center'},secondaryText:{fontSize:13,fontWeight:'700',color:p.ink},
 muted:{color:p.muted,fontSize:14,paddingVertical:10},
 answer:{paddingVertical:10,borderBottomWidth:1,borderColor:p.line},answerName:{fontSize:12,fontWeight:'800',color:p.violet},answerText:{fontSize:15,color:p.ink,marginTop:3},
});
