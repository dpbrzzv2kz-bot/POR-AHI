import React,{useEffect,useRef,useState} from 'react';
import {Modal,PanResponder,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {
 OVERLAY_LIMIT,STROKE_LIMIT,countdownPresets,defaultSize,overlayColors,overlayEmojis,rotationOf,simplifyStroke,sizeRange,
 storyFilters,strokeWidths,textFonts,type FilterName,type StoryOverlay,type TextBg,type TextFont,type TextAlign,
} from '../lib/storyOverlays';
import {searchPeople,type PublicProfile} from '../lib/social';
import {palette as p} from '../lib/theme';
import StoryOverlayLayer,{StoryFilterLayer} from './StoryOverlayLayer';
import MapPicker from './MapPicker';

type Props={overlays:StoryOverlay[];setOverlays:(next:StoryOverlay[])=>void;disabled?:boolean};
type Mode='none'|'text'|'stickers'|'draw'|'filters'|'poll'|'question'|'countdown'|'mention'|'location';
const newId=()=>Math.random().toString(36).slice(2,10);
const bgCycle:TextBg[]=['none','solid','soft'],alignCycle:TextAlign[]=['center','left','right'];
const alignGlyph:Record<TextAlign,string>={left:'⇤',center:'↔',right:'⇥'};

// Editor de la story antes de publicar: texto, emojis, stickers, dibujo y filtros. Todo se guarda como lista y se dibuja encima.
export default function StoryOverlayEditor({overlays,setOverlays,disabled=false}:Props){
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [mode,setMode]=useState<Mode>('none');
 const [draft,setDraft]=useState(''),[draftColor,setDraftColor]=useState<string>('#FFFFFF'),[draftFont,setDraftFont]=useState<TextFont>('clasica'),[draftAlign,setDraftAlign]=useState<TextAlign>('center'),[draftBg,setDraftBg]=useState<TextBg>('none'),[editingId,setEditingId]=useState<string|null>(null);
 const [question,setQuestion]=useState(''),[optionA,setOptionA]=useState('Sí'),[optionB,setOptionB]=useState('No'),[title,setTitle]=useState('');
 const [people,setPeople]=useState<PublicProfile[]>([]),[personQuery,setPersonQuery]=useState(''),[personError,setPersonError]=useState('');
 const [penColor,setPenColor]=useState<string>('#FFFFFF'),[penWidth,setPenWidth]=useState<number>(strokeWidths[1]),[erasing,setErasing]=useState(false);
 const [live,setLive]=useState<StoryOverlay|null>(null);
 const selected=overlays.find(item=>item.id===selectedId)||null;
 const itemCount=overlays.filter(item=>item.type!=='draw'&&item.type!=='filter').length,full=itemCount>=OVERLAY_LIMIT;
 const filter=overlays.find(item=>item.type==='filter')?.name||null;
 const change=(id:string,patch:Partial<StoryOverlay>)=>setOverlays(overlays.map(item=>item.id===id?{...item,...patch}:item));
 const add=(item:Omit<StoryOverlay,'id'|'x'|'y'|'rot'|'color'|'size'>&Partial<Pick<StoryOverlay,'x'|'y'|'rot'|'color'|'size'>>)=>{
  if(full)return;
  const id=newId();
  setOverlays([...overlays,{x:.5,y:.2+(itemCount%5)*.15,rot:0,color:'#FFFFFF',size:defaultSize(item.type),...item,id}]);
  setSelectedId(id);setMode('none');
 };

 // Texto
 const openText=(item?:StoryOverlay)=>{setEditingId(item?item.id:null);setDraft(item?item.text:'');setDraftColor(item?item.color:'#FFFFFF');setDraftFont(item?.font||'clasica');setDraftAlign(item?.align||'center');setDraftBg(item?.bg||'none');setMode('text');};
 const finishText=()=>{
  const value=draft.trim().slice(0,120);
  if(value){
   if(editingId)change(editingId,{text:value,color:draftColor,font:draftFont,align:draftAlign,bg:draftBg});
   else add({type:'text',text:value,color:draftColor,font:draftFont,align:draftAlign,bg:draftBg});
  }else if(editingId)setOverlays(overlays.filter(item=>item.id!==editingId));
  setMode('none');setEditingId(null);setDraft('');
 };
 // Stickers con datos
 const openForm=(next:Mode)=>{setQuestion('');setTitle('');setOptionA('Sí');setOptionB('No');setPersonQuery('');setPeople([]);setPersonError('');setMode(next);};
 const addPoll=()=>{const q=question.trim(),a=optionA.trim(),b=optionB.trim();if(!q||!a||!b)return;add({type:'poll',text:q,options:[a,b]});};
 const addQuestion=()=>{const q=question.trim();if(!q)return;add({type:'question',text:q});};
 const addCountdown=(ms:number)=>add({type:'countdown',text:title.trim(),endsAt:new Date(Date.now()+ms).toISOString()});
 const addTime=()=>add({type:'time',text:new Date().toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'})});
 // Menciones: se busca mientras se escribe (con una pausa para no saturar)
 useEffect(()=>{
  if(mode!=='mention')return;
  let active=true;const controller=new AbortController();
  const timer=setTimeout(()=>{searchPeople(personQuery,controller.signal).then(found=>{if(active){setPeople(found.slice(0,8));setPersonError('');}}).catch(()=>{if(active)setPersonError('No se pudo buscar. Vuelve a intentar.');});},personQuery?350:0);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[mode,personQuery]);
 // Dibujo
 const drawSize=useRef({w:1,h:1}),drawRef=useRef({overlays,erasing,penColor,penWidth,setOverlays}),stroke=useRef<number[]>([]);
 useEffect(()=>{drawRef.current={overlays,erasing,penColor,penWidth,setOverlays};});
 const point=(event:{nativeEvent:{locationX:number;locationY:number}})=>[Math.min(1,Math.max(0,event.nativeEvent.locationX/drawSize.current.w)),Math.min(1,Math.max(0,event.nativeEvent.locationY/drawSize.current.h))] as const;
 const erase=(x:number,y:number)=>{
  const now=drawRef.current,limit=.035,ratio=drawSize.current.h/drawSize.current.w;
  const keep=now.overlays.filter(item=>{
   if(item.type!=='draw'||!item.points)return true;
   for(let i=0;i+1<item.points.length;i+=2)if(Math.hypot(item.points[i]-x,(item.points[i+1]-y)*ratio)<limit)return false;
   return true;
  });
  if(keep.length!==now.overlays.length)now.setOverlays(keep);
 };
 const drawer=useRef(PanResponder.create({
  onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:()=>true,onPanResponderTerminationRequest:()=>false,
  onPanResponderGrant:event=>{const [x,y]=point(event);if(drawRef.current.erasing){erase(x,y);return;}stroke.current=[x,y,x+.0005,y+.0005];setLive({id:'live',type:'draw',text:'',x:.5,y:.5,size:0,rot:0,color:drawRef.current.penColor,width:drawRef.current.penWidth,points:stroke.current});},
  onPanResponderMove:event=>{const [x,y]=point(event);if(drawRef.current.erasing){erase(x,y);return;}stroke.current=[...stroke.current,x,y];setLive(previous=>previous?{...previous,points:stroke.current}:previous);},
  onPanResponderRelease:()=>{
   const now=drawRef.current;
   if(!now.erasing&&stroke.current.length>=4&&now.overlays.filter(item=>item.type==='draw').length<STROKE_LIMIT){
    const points=simplifyStroke(stroke.current);
    if(points.length>=4)now.setOverlays([...now.overlays,{id:newId(),type:'draw',text:'',x:.5,y:.5,size:0,rot:0,color:now.penColor,width:now.penWidth,points}]);
   }
   stroke.current=[];setLive(null);
  },
 })).current;
 const undo=()=>{const index=overlays.map(item=>item.type).lastIndexOf('draw');if(index>=0)setOverlays(overlays.filter((_,i)=>i!==index));};
 const strokesCount=overlays.filter(item=>item.type==='draw').length;
 // Filtro
 const setFilter=(name:FilterName|null)=>{const rest=overlays.filter(item=>item.type!=='filter');setOverlays(name?[{id:'filter',type:'filter',text:'',x:.5,y:.5,size:0,rot:0,color:'#FFFFFF',name},...rest]:rest);};
 // Selección
 const resize=(factor:number)=>{if(!selected)return;const range=sizeRange(selected.type);change(selected.id,{size:Math.min(range.max,Math.max(range.min,selected.size*factor))});};
 const remove=()=>{if(!selected)return;setOverlays(overlays.filter(item=>item.id!==selected.id));setSelectedId(null);};
 const drawing=mode==='draw';
 const forms=mode==='poll'||mode==='question'||mode==='countdown'||mode==='mention';
 return <>
  <StoryFilterLayer overlays={overlays}/>
  <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={()=>setSelectedId(null)}/>
  <StoryOverlayLayer overlays={drawing&&live?[...overlays,live]:overlays} editable={!disabled&&!drawing} selectedId={selectedId} onSelect={setSelectedId} onChange={change} onTapSelected={id=>{const item=overlays.find(row=>row.id===id);if(item?.type==='text')openText(item);}}/>
  {!disabled&&drawing&&<View style={StyleSheet.absoluteFill} onLayout={event=>{drawSize.current={w:event.nativeEvent.layout.width||1,h:event.nativeEvent.layout.height||1};}} {...drawer.panHandlers}/>}
  {!disabled&&<View pointerEvents="box-none" style={s.tools}>
   <Tool label="Agregar texto" glyph="Aa" disabled={full} onPress={()=>openText()}/>
   <Tool label="Stickers y emojis" glyph="😊" onPress={()=>setMode(mode==='stickers'?'none':'stickers')}/>
   <Tool label="Dibujar" glyph="✏️" on={drawing} onPress={()=>{setSelectedId(null);setErasing(false);setMode(drawing?'none':'draw');}}/>
   <Tool label="Filtros" glyph="🎨" on={!!filter} onPress={()=>setMode(mode==='filters'?'none':'filters')}/>
  </View>}

  {!disabled&&mode==='none'&&!!selected&&<View style={s.bar}>
   <BarButton label="Hacer más pequeño" text="−" onPress={()=>resize(.85)}/>
   <BarButton label="Hacer más grande" text="+" onPress={()=>resize(1.18)}/>
   <BarButton label="Girar" text="↻" onPress={()=>change(selected.id,{rot:rotationOf(selected.rot+15)})}/>
   {selected.type==='text'&&<>
    <View style={s.swatches}>{overlayColors.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={'Color '+color} onPress={()=>change(selected.id,{color})} style={[s.swatch,{backgroundColor:color},selected.color===color&&s.swatchOn]}/>)}</View>
    <BarButton label="Editar texto" text="Editar" small onPress={()=>openText(selected)}/>
   </>}
   <BarButton label="Quitar" text="Quitar" small danger onPress={remove}/>
  </View>}

  {!disabled&&mode==='stickers'&&<View style={s.sheet}>
   <ScrollView contentContainerStyle={{paddingBottom:8}} keyboardShouldPersistTaps="handled">
    <Text style={s.sheetTitle}>STICKERS</Text>
    <View style={s.grid}>
     <Sticker glyph="📍" label="Ubicación" onPress={()=>setMode('location')} disabled={full}/>
     <Sticker glyph="@" label="Mención" onPress={()=>openForm('mention')} disabled={full}/>
     <Sticker glyph="📊" label="Encuesta" onPress={()=>openForm('poll')} disabled={full}/>
     <Sticker glyph="❓" label="Pregunta" onPress={()=>openForm('question')} disabled={full}/>
     <Sticker glyph="⏳" label="Cuenta regresiva" onPress={()=>openForm('countdown')} disabled={full}/>
     <Sticker glyph="🕒" label="Hora" onPress={addTime} disabled={full}/>
     <Sticker glyph="↗" label="por ahí" onPress={()=>add({type:'brand',text:'por ahí',y:.85})} disabled={full}/>
    </View>
    <Text style={s.sheetTitle}>EMOJIS</Text>
    <View style={s.grid}>{overlayEmojis.map(emoji=><Pressable key={emoji} accessibilityRole="button" accessibilityLabel={'Emoji '+emoji} disabled={full} onPress={()=>add({type:'emoji',text:emoji})} style={s.emojiButton}><Text style={s.emojiText}>{emoji}</Text></Pressable>)}</View>
   </ScrollView>
   <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={()=>setMode('none')} style={s.closeSheet}><Text style={s.barSmall}>Cerrar</Text></Pressable>
  </View>}

  {!disabled&&mode==='filters'&&<View style={s.bar}>
   <Pressable accessibilityRole="button" accessibilityState={{selected:!filter}} onPress={()=>setFilter(null)} style={[s.chip,!filter&&s.chipOn]}><Text style={[s.chipText,!filter&&{color:p.ink}]}>Ninguno</Text></Pressable>
   {storyFilters.map(item=><Pressable key={item.name} accessibilityRole="button" accessibilityLabel={'Filtro '+item.label} accessibilityState={{selected:filter===item.name}} onPress={()=>setFilter(item.name)} style={[s.chip,filter===item.name&&s.chipOn]}><Text style={[s.chipText,filter===item.name&&{color:p.ink}]}>{item.label}</Text></Pressable>)}
   <BarButton label="Cerrar" text="Listo" small onPress={()=>setMode('none')}/>
  </View>}

  {!disabled&&drawing&&<View style={s.bar}>
   <View style={s.swatches}>{overlayColors.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={'Color '+color} onPress={()=>{setPenColor(color);setErasing(false);}} style={[s.swatch,{backgroundColor:color},!erasing&&penColor===color&&s.swatchOn]}/>)}</View>
   <View style={s.swatches}>{strokeWidths.map(width=><Pressable key={width} accessibilityRole="button" accessibilityLabel={'Grosor '+width} onPress={()=>{setPenWidth(width);setErasing(false);}} style={[s.widthButton,!erasing&&penWidth===width&&s.chipOn]}><View style={{width:6+width*600,height:6+width*600,borderRadius:20,backgroundColor:!erasing&&penWidth===width?p.ink:'#fff'}}/></Pressable>)}</View>
   <BarButton label="Goma" text="Goma" small on={erasing} onPress={()=>setErasing(value=>!value)}/>
   <BarButton label="Deshacer" text="↶" disabled={!strokesCount} onPress={undo}/>
   <BarButton label="Listo" text="Listo" small onPress={()=>{setMode('none');setErasing(false);}}/>
  </View>}

  {!disabled&&mode==='text'&&<View style={s.textScreen}>
   <TextInput autoFocus multiline accessibilityLabel="Texto de la story" placeholder="Escribe algo" placeholderTextColor="rgba(255,255,255,.5)" value={draft} onChangeText={setDraft} maxLength={120} style={[s.input,{color:draftBg==='solid'?(draftColor==='#17171C'?'#fff':draftColor):draftColor,textAlign:draftAlign}]}/>
   <View style={s.chipsRow}>{textFonts.map(font=><Pressable key={font.key} accessibilityRole="button" accessibilityLabel={'Tipografía '+font.label} accessibilityState={{selected:draftFont===font.key}} onPress={()=>setDraftFont(font.key)} style={[s.chip,draftFont===font.key&&s.chipOn]}><Text style={[s.chipText,draftFont===font.key&&{color:p.ink}]}>{font.label}</Text></Pressable>)}</View>
   <View style={s.chipsRow}>
    <Pressable accessibilityRole="button" accessibilityLabel="Alineación" onPress={()=>setDraftAlign(alignCycle[(alignCycle.indexOf(draftAlign)+1)%3])} style={s.chip}><Text style={s.chipText}>{alignGlyph[draftAlign]}</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Fondo del texto" onPress={()=>setDraftBg(bgCycle[(bgCycle.indexOf(draftBg)+1)%3])} style={s.chip}><Text style={s.chipText}>Fondo: {draftBg==='none'?'sin':draftBg==='solid'?'color':'suave'}</Text></Pressable>
   </View>
   <View style={s.swatchRow}>{overlayColors.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={'Color '+color} onPress={()=>setDraftColor(color)} style={[s.swatch,{backgroundColor:color},draftColor===color&&s.swatchOn]}/>)}</View>
   <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={finishText} style={s.done}><Text style={s.doneText}>Listo</Text></Pressable>
  </View>}

  {!disabled&&forms&&<View style={s.textScreen}>
   {mode==='poll'&&<>
    <Text style={s.formTitle}>Encuesta</Text>
    <TextInput autoFocus accessibilityLabel="Pregunta de la encuesta" placeholder="Haz una pregunta" placeholderTextColor="rgba(255,255,255,.5)" value={question} onChangeText={setQuestion} maxLength={80} style={s.field}/>
    <TextInput accessibilityLabel="Primera respuesta" placeholder="Respuesta 1" placeholderTextColor="rgba(255,255,255,.5)" value={optionA} onChangeText={setOptionA} maxLength={30} style={s.field}/>
    <TextInput accessibilityLabel="Segunda respuesta" placeholder="Respuesta 2" placeholderTextColor="rgba(255,255,255,.5)" value={optionB} onChangeText={setOptionB} maxLength={30} style={s.field}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Agregar encuesta" disabled={!question.trim()||!optionA.trim()||!optionB.trim()} onPress={addPoll} style={[s.done,(!question.trim()||!optionA.trim()||!optionB.trim())&&{opacity:.4}]}><Text style={s.doneText}>Agregar</Text></Pressable>
   </>}
   {mode==='question'&&<>
    <Text style={s.formTitle}>Pregunta</Text>
    <TextInput autoFocus accessibilityLabel="Texto de la pregunta" placeholder="Pregúntame lo que quieras" placeholderTextColor="rgba(255,255,255,.5)" value={question} onChangeText={setQuestion} maxLength={80} style={s.field}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Agregar pregunta" disabled={!question.trim()} onPress={addQuestion} style={[s.done,!question.trim()&&{opacity:.4}]}><Text style={s.doneText}>Agregar</Text></Pressable>
   </>}
   {mode==='countdown'&&<>
    <Text style={s.formTitle}>Cuenta regresiva</Text>
    <TextInput autoFocus accessibilityLabel="Nombre del evento" placeholder="¿Para qué es? (opcional)" placeholderTextColor="rgba(255,255,255,.5)" value={title} onChangeText={setTitle} maxLength={40} style={s.field}/>
    <View style={s.chipsRow}>{countdownPresets.map(preset=><Pressable key={preset.label} accessibilityRole="button" accessibilityLabel={preset.label} onPress={()=>addCountdown(preset.ms)} style={s.chip}><Text style={s.chipText}>{preset.label}</Text></Pressable>)}</View>
   </>}
   {mode==='mention'&&<>
    <Text style={s.formTitle}>Mencionar a alguien</Text>
    <TextInput autoFocus accessibilityLabel="Buscar persona" placeholder="Busca por nombre o @usuario" placeholderTextColor="rgba(255,255,255,.5)" value={personQuery} onChangeText={setPersonQuery} maxLength={40} autoCapitalize="none" style={s.field}/>
    {!!personError&&<Text accessibilityRole="alert" style={s.formNote}>{personError}</Text>}
    <ScrollView style={{maxHeight:260}} keyboardShouldPersistTaps="handled">{people.map(person=><Pressable key={person.id} accessibilityRole="button" accessibilityLabel={'Mencionar a '+person.name} onPress={()=>add({type:'mention',text:'@'+person.handle,userId:person.id})} style={s.person}><Text style={s.personName}>{person.name}</Text><Text style={s.personHandle}>@{person.handle}</Text></Pressable>)}{!people.length&&!personError&&<Text style={s.formNote}>Sin resultados todavía.</Text>}</ScrollView>
   </>}
   <Pressable accessibilityRole="button" accessibilityLabel="Cancelar" onPress={()=>setMode('stickers')} style={s.cancel}><Text style={s.barSmall}>Cancelar</Text></Pressable>
  </View>}

  {!disabled&&mode==='location'&&<Modal visible animationType="slide" onRequestClose={()=>setMode('stickers')}>
   <MapPicker confirmLabel="Poner en la story" cancelLabel="Atrás" onCancel={()=>setMode('stickers')} onConfirm={place=>{const name=(place.label||place.address?.split(',')[0]||'').trim();setMode('none');if(name)add({type:'location',text:name.slice(0,60)});}}/>
  </Modal>}
 </>;
}

function Tool({label,glyph,onPress,disabled,on}:{label:string;glyph:string;onPress:()=>void;disabled?:boolean;on?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.round,on&&{backgroundColor:p.lime},disabled&&{opacity:.4}]}><Text style={[glyph==='Aa'?s.roundText:s.roundEmoji,on&&{color:p.ink}]}>{glyph}</Text></Pressable>;
}
function BarButton({label,text,onPress,small,danger,on,disabled}:{label:string;text:string;onPress:()=>void;small?:boolean;danger?:boolean;on?:boolean;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.barButton,danger&&{backgroundColor:'rgba(214,64,43,.9)'},on&&{backgroundColor:p.lime},disabled&&{opacity:.4}]}><Text style={[small?s.barSmall:s.barText,on&&{color:p.ink}]}>{text}</Text></Pressable>;
}
function Sticker({glyph,label,onPress,disabled}:{glyph:string;label:string;onPress:()=>void;disabled?:boolean}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.sticker,disabled&&{opacity:.4}]}><Text style={s.stickerGlyph}>{glyph}</Text><Text numberOfLines={1} style={s.stickerLabel}>{label}</Text></Pressable>;
}

const s=StyleSheet.create({
 tools:{position:'absolute',right:14,top:Platform.OS==='ios'?58:18,gap:10},
 round:{width:46,height:46,borderRadius:23,backgroundColor:'rgba(0,0,0,.5)',alignItems:'center',justifyContent:'center'},
 roundText:{color:'#fff',fontSize:18,fontWeight:'900'},roundEmoji:{fontSize:22},
 bar:{position:'absolute',left:12,right:12,bottom:Platform.OS==='ios'?118:104,flexDirection:'row',alignItems:'center',justifyContent:'center',flexWrap:'wrap',gap:8,backgroundColor:'rgba(23,23,28,.84)',borderRadius:18,padding:8},
 barButton:{minWidth:44,minHeight:40,paddingHorizontal:12,borderRadius:12,backgroundColor:'rgba(255,255,255,.16)',alignItems:'center',justifyContent:'center'},
 barText:{color:'#fff',fontSize:22,fontWeight:'800'},barSmall:{color:'#fff',fontSize:13,fontWeight:'800'},
 swatches:{flexDirection:'row',gap:6,alignItems:'center'},swatchRow:{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center',marginVertical:14},
 swatch:{width:26,height:26,borderRadius:13,borderWidth:2,borderColor:'rgba(255,255,255,.35)'},swatchOn:{borderColor:'#fff',transform:[{scale:1.2}]},
 widthButton:{width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,.16)',alignItems:'center',justifyContent:'center'},
 chip:{minHeight:38,paddingHorizontal:14,borderRadius:19,borderWidth:1.5,borderColor:'rgba(255,255,255,.4)',alignItems:'center',justifyContent:'center'},
 chipOn:{backgroundColor:p.lime,borderColor:p.lime},chipText:{color:'#fff',fontSize:13,fontWeight:'800'},chipsRow:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center',marginTop:10},
 sheet:{position:'absolute',left:0,right:0,bottom:0,maxHeight:'62%',backgroundColor:'rgba(23,23,28,.96)',borderTopLeftRadius:24,borderTopRightRadius:24,paddingTop:14,paddingBottom:Platform.OS==='ios'?32:18,paddingHorizontal:12},
 sheetTitle:{color:p.darkMuted,fontSize:10,fontWeight:'800',letterSpacing:2,marginVertical:8,marginLeft:6},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:4},
 sticker:{width:'31%',minHeight:64,borderRadius:14,backgroundColor:'rgba(255,255,255,.12)',alignItems:'center',justifyContent:'center',margin:'1%',padding:6},
 stickerGlyph:{fontSize:24,color:'#fff',fontWeight:'900'},stickerLabel:{color:'#fff',fontSize:11,fontWeight:'700',marginTop:3},
 emojiButton:{width:52,height:52,alignItems:'center',justifyContent:'center'},emojiText:{fontSize:32},
 closeSheet:{minHeight:44,alignItems:'center',justifyContent:'center',marginTop:6},
 textScreen:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.78)',justifyContent:'center',paddingHorizontal:24},
 input:{fontSize:30,fontWeight:'900',minHeight:90,textAlignVertical:'center'},
 done:{minHeight:52,borderRadius:16,backgroundColor:p.lime,alignItems:'center',justifyContent:'center',marginTop:8},doneText:{fontSize:15,fontWeight:'800',color:p.ink},
 formTitle:{color:'#fff',fontSize:22,fontWeight:'900',textAlign:'center',marginBottom:14},
 field:{color:'#fff',fontSize:18,fontWeight:'700',borderBottomWidth:2,borderColor:p.lime,paddingVertical:10,marginBottom:10},
 formNote:{color:p.darkMuted,fontSize:13,textAlign:'center',marginVertical:10},
 person:{paddingVertical:12,borderBottomWidth:1,borderColor:'rgba(255,255,255,.14)'},personName:{color:'#fff',fontSize:16,fontWeight:'800'},personHandle:{color:p.darkMuted,fontSize:13},
 cancel:{minHeight:44,alignItems:'center',justifyContent:'center',marginTop:8},
});
