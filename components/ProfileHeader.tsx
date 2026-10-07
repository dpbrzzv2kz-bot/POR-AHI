import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {palette as p} from '../lib/theme';
import Icon from './Icon';

export default function ProfileHeader({name,handle,bio,symbol,own,stats}:{name:string;handle:string;bio:string;symbol:string;own:boolean;stats:{label:string;value:string}[]}){
 return <View style={s.hero}>
  <View style={s.top}><Text style={s.kicker}>{own?'TU PERFIL':'COMUNIDAD'}</Text><Icon name="arrow" color={p.lime} size={26}/></View>
  <View style={s.avatar}><Text style={s.initial}>{symbol}</Text></View>
  <Text style={s.name}>{name}</Text><Text style={s.handle}>{handle}</Text><Text style={s.bio}>{bio}</Text>
  <View style={s.stats}>{stats.map(stat=><View key={stat.label} style={s.stat}><Text style={s.value}>{stat.value}</Text><Text style={s.label}>{stat.label}</Text></View>)}</View>
 </View>;
}
const s=StyleSheet.create({hero:{margin:16,padding:22,borderRadius:25,backgroundColor:p.ink},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},kicker:{color:p.darkMuted,fontSize:10,fontWeight:'700',letterSpacing:2},avatar:{width:70,height:70,borderRadius:23,backgroundColor:p.lime,alignItems:'center',justifyContent:'center',marginTop:16,marginBottom:16},initial:{fontSize:30,fontWeight:'900',color:p.ink},name:{color:p.onDark,fontSize:30,lineHeight:36,letterSpacing:-1,fontWeight:'900'},handle:{color:p.lime,fontSize:14,fontWeight:'600',marginTop:5},bio:{color:'#D8D8E0',fontSize:14,lineHeight:21,marginTop:14},stats:{flexDirection:'row',gap:8,borderTopWidth:1,borderColor:'#FFFFFF25',paddingTop:17,marginTop:20},stat:{flex:1,minWidth:0},value:{color:p.onDark,fontSize:22,fontWeight:'800'},label:{color:p.darkMuted,fontSize:11,marginTop:4}});
