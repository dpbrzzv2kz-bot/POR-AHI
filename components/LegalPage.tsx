import React from 'react';
import {ScrollView,View,Text,StyleSheet} from 'react-native';
import {Link} from 'expo-router';
import {LEGAL_VERSION,legalReady,privacySections,termsSections} from '../lib/legalContent';
import {palette as p} from '../lib/theme';

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
const s=StyleSheet.create({page:{flex:1,backgroundColor:p.canvas},content:{padding:24,paddingTop:45,paddingBottom:60,maxWidth:720,width:'100%',alignSelf:'center'},title:{fontSize:30,lineHeight:36,fontWeight:'900',letterSpacing:-.8,color:p.ink,marginTop:24},heading:{fontSize:18,fontWeight:'800',color:p.ink,marginBottom:8},body:{fontSize:15,lineHeight:25,color:p.ink},note:{fontSize:13,color:p.muted,marginTop:12},section:{marginTop:24},warning:{padding:16,backgroundColor:p.violetSoft,borderRadius:16,marginTop:18},link:{fontSize:14,fontWeight:'600',color:p.violet,marginTop:18,textDecorationLine:'underline',minHeight:44,paddingTop:12}});
