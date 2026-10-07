import React from 'react';
import {View,Text,TextInput,Pressable,ScrollView,KeyboardAvoidingView,Platform,StyleSheet} from 'react-native';
import {supabase} from '../lib/supabase';
import {loadPosts,type Review} from '../lib/posts';
import {deleteOwnContent,editOwnReview,pendingContent,type ContentTarget} from '../lib/ownContent';

export type ContentAction=ContentTarget&{owner:string;label:string;review?:Review;pending?:boolean};
const connection={url:process.env.EXPO_PUBLIC_SUPABASE_URL||'',key:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||''};
function ContentButton({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}){
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,disabled&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
}
export function ContentEditor({action,close,changed,withdrawn,done,busyChange}:{action:ContentAction;close:()=>void;changed:(review:Review)=>void;withdrawn:(target:ContentTarget)=>void;done:()=>void;busyChange:(value:boolean)=>void}){
 const [review,setReview]=React.useState(action.review),[place,setPlace]=React.useState(action.review?.place||''),[category,setCategory]=React.useState(action.review?.category||'Comer'),[text,setText]=React.useState(action.review?.text||'');
 const [removing,setRemoving]=React.useState(!action.review),[confirmation,setConfirmation]=React.useState(''),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[started,setStarted]=React.useState(!!action.pending);
 const lock=React.useRef(false),mounted=React.useRef(true);
 React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={busy||disabled} onPress={fn} style={[s.button,(busy||disabled)&&{opacity:.5}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const run=async(operation:()=>Promise<void>)=>{
  if(lock.current||!supabase)return;lock.current=true;setBusy(true);busyChange(true);setError('');
  try{await operation();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'No se pudo completar. Reintenta.');}
  finally{lock.current=false;if(mounted.current){setBusy(false);busyChange(false);}}
 };
 const save=()=>run(async()=>{
  if(!review)return;
  const version=await editOwnReview(supabase!,action.owner,action.id,review.version??0,{place,category,text},connection);
  if(mounted.current){changed({...review,place:place.trim(),category,text,version});close();}
 });
 const reload=()=>run(async()=>{
  const current=(await loadPosts({postIds:[action.id]}))[0];
  if(!current||current.userId!==action.owner)throw new Error('Esta reseña ya no está disponible.');
  if(mounted.current){setReview(current);setPlace(current.place);setCategory(current.category);setText(current.text);changed(current);}
 });
 const remove=()=>run(async()=>{
  await deleteOwnContent(supabase!,action.owner,action,confirmation,connection,()=>{
   if(mounted.current){setStarted(true);withdrawn(action);}
  });
  if(mounted.current){done();close();}
 });
 return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
 {button('Cerrar',close)}<Text style={s.title}>{removing?'Eliminar '+(action.kind==='story'?'story':'reseña'):'Editar reseña'}</Text><Text style={s.body}>{action.label}</Text>
 {removing?<>
  <Text style={s.body}>{started?'La publicación ya se retiró de la comunidad. Falta completar el borrado del archivo.':'Se retirará la publicación y se eliminará su foto o video.'} {action.kind==='post'?'También se quitarán sus comentarios, likes y guardados. ':''}Esta acción no se puede deshacer.</Text>
  <Text style={s.label}>Escribe ELIMINAR para confirmar</Text><TextInput accessibilityLabel="Confirmar eliminación de publicación" editable={!busy} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} maxLength={8} style={s.input}/>
  <ContentButton label={busy?'Eliminando…':started?'Reintentar eliminación':'Eliminar definitivamente'} onPress={remove} disabled={busy||confirmation!=='ELIMINAR'}/>
  {!started&&action.review&&button('Volver a editar',()=>{setRemoving(false);setError('');})}
  <Text style={s.note}>Si falla la conexión, podrás continuar desde «Eliminaciones pendientes» en tu perfil.</Text>
 </>:<>
  <Text style={s.label}>Lugar</Text><TextInput accessibilityLabel="Editar lugar" editable={!busy} value={place} onChangeText={setPlace} maxLength={100} style={s.input}/>
  <Text style={s.label}>Categoría</Text><View style={s.categories}>{['Comer','Divertirse','Explorar'].map(c=><Pressable accessibilityRole="button" accessibilityState={{selected:category===c}} disabled={busy} key={c} onPress={()=>setCategory(c)} style={[s.chip,category===c&&s.selected]}><Text style={{color:category===c?'white':'#243d31'}}>{c}</Text></Pressable>)}</View>
  <Text style={s.label}>Detalles</Text><TextInput accessibilityLabel="Editar detalles" editable={!busy} value={text} onChangeText={setText} multiline maxLength={1500} style={[s.input,{minHeight:140}]}/>
  <ContentButton label={busy?'Guardando…':'Guardar cambios'} onPress={save} disabled={busy}/><ContentButton label="Volver a cargar la reseña" onPress={reload} disabled={busy}/>
  <Text style={s.note}>Volver a cargar reemplaza lo que escribiste por la versión guardada. La foto o video conserva su archivo original.</Text>
  {button('Eliminar esta reseña',()=>{setRemoving(true);setError('');})}
 </>}
 {!!error&&<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
 </ScrollView></KeyboardAvoidingView>;
}
export function PendingContent({userId,version,open}:{userId:string;version:number;open:(action:ContentAction)=>void}){
 const [items,setItems]=React.useState<ContentTarget[]>([]),[error,setError]=React.useState(''),[attempt,setAttempt]=React.useState(0);
 React.useEffect(()=>{let active=true;Promise.resolve().then(async()=>{if(!active||!supabase)return;setItems([]);setError('');try{const rows=await pendingContent(supabase);if(active)setItems(rows);}catch(e){if(active)setError(e instanceof Error?e.message:'No se pudieron comprobar los pendientes.');}});return()=>{active=false;};},[userId,version,attempt]);
 if(!items.length&&!error)return null;
 return <View style={s.pending}><Text style={s.label}>Eliminaciones pendientes</Text>{items.map(item=><Pressable key={item.kind+item.id} accessibilityRole="button" onPress={()=>open({...item,pending:true,owner:userId,label:'Publicación retirada · '+item.id.slice(0,8)})} style={s.button}><Text style={s.buttonText}>Continuar borrado de {item.kind==='post'?'reseña':'story'}</Text></Pressable>)}{!!error&&<><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setAttempt(n=>n+1)} style={s.button}><Text style={s.buttonText}>Revisar pendientes</Text></Pressable></>}</View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#faf9f5'},form:{padding:22,paddingTop:Platform.OS==='ios'?60:24,maxWidth:590,width:'100%',alignSelf:'center'},title:{fontSize:28,fontWeight:'700',color:'#243d31',marginVertical:18},body:{fontSize:15,lineHeight:24,color:'#536350',marginBottom:16},label:{fontSize:14,color:'#334b3b',marginTop:18,marginBottom:10},input:{padding:15,borderRadius:12,backgroundColor:'#e9eee4',color:'#243d31',fontSize:16},button:{padding:16,borderRadius:12,backgroundColor:'#965337',marginVertical:6,alignItems:'center',minHeight:48},buttonText:{color:'white',fontWeight:'600'},categories:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},chip:{padding:12,borderRadius:22,backgroundColor:'#e6ecdf',minHeight:44},selected:{backgroundColor:'#935136'},note:{fontSize:12,lineHeight:20,color:'#536350',marginVertical:12},error:{fontSize:14,lineHeight:22,color:'#9c3d24',marginVertical:12},pending:{padding:16,backgroundColor:'#eef1e8',borderRadius:16,marginBottom:16}});
