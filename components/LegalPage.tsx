import React from 'react';
import {ScrollView,View,Text,StyleSheet} from 'react-native';
import {Link} from 'expo-router';
import {LEGAL_VERSION,legalReady,privacySections,termsSections} from '../lib/legalContent';

export default function LegalPage({kind}:{kind:'privacy'|'terms'}){
 const title=kind==='privacy'?'Aviso de privacidad':'Condiciones de la beta';
 return <ScrollView style={s.page} contentContainerStyle={s.content}>
  <Link href="/" style={s.link}>← Volver a Por Ahí</Link><Text accessibilityRole="header" style={s.title}>{title}</Text>
  <Text style={s.note}>Por Ahí Social · Versión {LEGAL_VERSION}</Text>
  {!legalReady&&<View style={s.warning}><Text style={s.body}>Borrador para revisión. Falta confirmar el nombre legal y domicilio del responsable antes de publicar esta versión.</Text></View>}
  {(kind==='privacy'?privacySections:termsSections).map(section=><View key={section.title} style={s.section}><Text accessibilityRole="header" style={s.heading}>{section.title}</Text><Text style={s.body}>{section.text}</Text></View>)}
  <Link href={kind==='privacy'?'/terms':'/privacy'} style={s.link}>{kind==='privacy'?'Leer condiciones de la beta':'Leer aviso de privacidad'}</Link>
  <Link href="/delete-account" style={s.link}>Eliminar cuenta</Link>
 </ScrollView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#fbf9f4'},content:{padding:24,paddingTop:45,paddingBottom:60,maxWidth:720,width:'100%',alignSelf:'center'},title:{fontSize:28,fontWeight:'700',color:'#243d31',marginTop:24},heading:{fontSize:18,fontWeight:'700',color:'#243d31',marginBottom:8},body:{fontSize:15,lineHeight:24,color:'#334b3b'},note:{fontSize:13,color:'#536350',marginTop:12},section:{marginTop:24},warning:{padding:16,backgroundColor:'#fff0d8',borderRadius:12,marginTop:18},link:{fontSize:15,color:'#965337',marginTop:18,textDecorationLine:'underline'}});
