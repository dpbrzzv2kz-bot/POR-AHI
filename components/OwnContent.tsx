import React from 'react';
import {View,Text,TextInput,Pressable,ScrollView,KeyboardAvoidingView,Platform,StyleSheet} from 'react-native';
import {supabase} from '../lib/supabase';
import type {Review} from '../lib/posts';
import {deleteOwnContent,pendingContent,type ContentTarget} from '../lib/ownContent';
import {palette as p} from '../lib/theme';
import ui from '../lib/uiStyles';
import ScreenHeader from './ScreenHeader';

export type ContentAction=ContentTarget&{owner:string;label:string;review?:Review;pending?:boolean};
const connection={url:process.env.EXPO_PUBLIC_SUPABASE_URL||'',key:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||''};
function ContentButton({label,onPress,disabled=false,danger=false,secondary=false}:{label:string;onPress:()=>void;disabled?:boolean;danger?:boolean;secondary?:boolean}){
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[secondary?ui.secondary:ui.button,danger&&ui.danger,disabled&&{opacity:.5}]}><Text style={[ui.buttonText,danger&&ui.dangerText]}>{label}</Text></Pressable>;
}
// Las reseñas no se editan: lo que la gente vio y calificó no debe cambiar. Para corregir algo se elimina y se publica de nuevo.
export function ContentEditor({action,close,withdrawn,done,busyChange}:{action:ContentAction;close:()=>void;changed?:(review:Review)=>void;withdrawn:(target:ContentTarget)=>void;done:()=>void;busyChange:(value:boolean)=>void}){
 const [confirmation,setConfirmation]=React.useState(''),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[started,setStarted]=React.useState(!!action.pending);
 const lock=React.useRef(false),mounted=React.useRef(true);
 React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const run=async(operation:()=>Promise<void>)=>{
  if(lock.current||!supabase)return;lock.current=true;setBusy(true);busyChange(true);setError('');
  try{await operation();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'No se pudo completar. Reintenta.');}
  finally{lock.current=false;if(mounted.current){setBusy(false);busyChange(false);}}
 };
 const remove=()=>run(async()=>{
  await deleteOwnContent(supabase!,action.owner,action,confirmation,connection,()=>{
   if(mounted.current){setStarted(true);withdrawn(action);}
  });
  if(mounted.current){done();close();}
 });
 return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}><ScreenHeader close={close} disabled={busy}/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
 <Text style={ui.kicker}>TU CONTENIDO · ELIMINACIÓN</Text><Text style={s.title}>{'Eliminar '+(action.kind==='story'?'story':'reseña')}</Text><Text style={s.body}>{action.label}</Text>
 <Text style={s.body}>{started?'La publicación ya se retiró de la comunidad. Falta completar el borrado de sus archivos.':'Se retirará la publicación y se eliminarán sus fotos o videos.'} {action.kind==='post'?'También se quitarán sus comentarios, corazones, tomates y guardados. ':''}Esta acción no se puede deshacer.</Text>
 {action.kind==='post'&&!started&&<Text style={s.note}>Las reseñas no se pueden editar, para que lo que la gente vio y calificó no cambie. Si quieres corregir algo, elimínala y publica una nueva.</Text>}
 <Text style={s.label}>Escribe ELIMINAR para confirmar</Text><TextInput accessibilityLabel="Confirmar eliminación de publicación" editable={!busy} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} maxLength={8} style={s.input}/>
 <ContentButton label={busy?'Eliminando…':started?'Reintentar eliminación':'Eliminar definitivamente'} onPress={remove} disabled={busy||confirmation!=='ELIMINAR'} danger/>
 <Text style={s.note}>Si falla la conexión, podrás continuar desde «Eliminaciones pendientes» en tu perfil.</Text>
 {!!error&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
 </ScrollView></KeyboardAvoidingView>;
}
export function PendingContent({userId,version,open}:{userId:string;version:number;open:(action:ContentAction)=>void}){
 const [items,setItems]=React.useState<ContentTarget[]>([]),[error,setError]=React.useState(''),[attempt,setAttempt]=React.useState(0);
 React.useEffect(()=>{let active=true;Promise.resolve().then(async()=>{if(!active||!supabase)return;setItems([]);setError('');try{const rows=await pendingContent(supabase);if(active)setItems(rows);}catch(e){if(active)setError(e instanceof Error?e.message:'No se pudieron comprobar los pendientes.');}});return()=>{active=false;};},[userId,version,attempt]);
 if(!items.length&&!error)return null;
 return <View style={s.pending}><Text style={s.label}>Eliminaciones pendientes</Text>{items.map(item=><Pressable key={item.kind+item.id} accessibilityRole="button" onPress={()=>open({...item,pending:true,owner:userId,label:'Publicación retirada · '+item.id.slice(0,8)})} style={s.button}><Text style={s.buttonText}>Continuar borrado de {item.kind==='post'?'reseña':'story'}</Text></Pressable>)}{!!error&&<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={s.button}><Text style={s.buttonText}>Revisar pendientes</Text></Pressable></>}</View>;
}
const s=StyleSheet.create({...ui,form:ui.content,button:ui.secondary,buttonText:ui.secondaryText,categories:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},chip:{padding:12,borderRadius:14,backgroundColor:p.surface,borderWidth:1,borderColor:p.line,minHeight:44},selected:{backgroundColor:p.ink,borderColor:p.ink},pending:{padding:16,backgroundColor:p.violetSoft,borderRadius:18,marginBottom:16}});
