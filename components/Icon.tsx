import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import {palette as p} from '../lib/theme';

export type IconName='photos'|'video'|'message'|'search'|'profile'|'plus'|'bell'|'bookmark'|'arrow'|'heart'|'refresh'|'settings'|'gallery';
// Code-native geometry keeps the same icon weight on web/iOS without a font download.
export default function Icon({name,size=24,color=p.ink,filled=false}:{name:IconName;size?:number;color?:string;filled?:boolean}){
 const border={borderColor:color};
 let drawing:React.ReactNode;
 switch(name){
  case 'plus':drawing=<><View style={[s.line,{left:4,top:11,width:16,backgroundColor:color}]}/><View style={[s.line,{left:11,top:4,width:2,height:16,backgroundColor:color}]}/></>;break;
  case 'photos':drawing=<>{[[3,3],[14,3],[3,14],[14,14]].map(([left,top])=><View key={left+'-'+top} style={[s.tile,border,{left,top},filled&&{backgroundColor:color}]}/>)}</>;break;
  case 'video':drawing=<><View style={[s.video,border]}/><View style={[s.triangle,{borderLeftColor:color}]}/></>;break;
  case 'message':drawing=<><View style={[s.chat,border]}/><View style={[s.tail,{borderLeftColor:color,borderBottomColor:color}]}/></>;break;
  case 'search':drawing=<><View style={[s.search,border]}/><View style={[s.line,{width:8,left:15,top:18,backgroundColor:color,transform:[{rotate:'45deg'}]}]}/></>;break;
  case 'profile':drawing=<><View style={[s.head,border]}/><View style={[s.shoulders,border]}/></>;break;
  case 'bookmark':drawing=<><View style={[s.bookmark,border,filled&&{backgroundColor:color}]}/><View style={[s.notch,{borderColor:filled?color:color}]}/></>;break;
  case 'bell':drawing=<><View style={[s.bell,border]}/><View style={[s.line,{left:3,top:18,width:18,backgroundColor:color}]}/><View style={{position:'absolute',left:10,top:21,width:4,height:2,borderRadius:2,backgroundColor:color}}/></>;break;
  case 'arrow':drawing=<><View style={[s.line,{left:3,top:11,width:19,backgroundColor:color,transform:[{rotate:'-45deg'}]}]}/><View style={{position:'absolute',left:10,top:4,width:10,height:10,borderTopWidth:2,borderRightWidth:2,borderColor:color}}/></>;break;
  case 'heart':drawing=<Text style={[s.glyph,{color,fontSize:29,lineHeight:29,top:-2}]}>{filled?'♥':'♡'}</Text>;break;
  case 'settings':drawing=<>{[5,11,17].map(top=><View key={top} style={[s.line,{left:3,top,width:18,backgroundColor:color}]}/>)}{[[6,3],[15,9],[9,15]].map(([left,top])=><View key={left} style={{position:'absolute',left,top,width:6,height:6,borderRadius:3,borderWidth:1.8,borderColor:color,backgroundColor:p.ink}}/>)}</>;break;
  case 'gallery':drawing=<><View style={{position:'absolute',left:2,top:3,width:20,height:18,borderWidth:1.8,borderRadius:5,borderColor:color}}/><View style={{position:'absolute',left:14,top:7,width:4,height:4,borderRadius:2,backgroundColor:color}}/><View style={{position:'absolute',left:3.8,top:4.8,width:16.4,height:14.4,borderRadius:3,overflow:'hidden'}}><View style={{position:'absolute',left:0,top:8,width:9,height:9,borderTopWidth:1.8,borderLeftWidth:1.8,borderColor:color,transform:[{rotate:'45deg'}]}}/><View style={{position:'absolute',left:7,top:10,width:7,height:7,borderTopWidth:1.8,borderLeftWidth:1.8,borderColor:color,transform:[{rotate:'45deg'}]}}/></View></>;break;
  case 'refresh':drawing=<Text style={[s.glyph,{color,fontSize:28,lineHeight:28,top:-2}]}>↻</Text>;break;
 }
 return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{width:size,height:size}}><View style={[s.base,{transform:[{scale:size/24}],left:(size-24)/2,top:(size-24)/2}]}>{drawing}</View></View>;
}
const s=StyleSheet.create({base:{position:'absolute',width:24,height:24},line:{position:'absolute',height:2,borderRadius:2},tile:{position:'absolute',width:7,height:7,borderWidth:1.8,borderRadius:2},video:{position:'absolute',left:2,top:3,width:20,height:18,borderWidth:1.8,borderRadius:5},triangle:{position:'absolute',left:10,top:8,width:0,height:0,borderTopWidth:4,borderBottomWidth:4,borderLeftWidth:6,borderTopColor:'transparent',borderBottomColor:'transparent'},chat:{position:'absolute',left:2,top:3,width:20,height:16,borderWidth:1.8,borderRadius:5},tail:{position:'absolute',left:5,top:17,width:5,height:5,borderLeftWidth:1.8,borderBottomWidth:1.8,transform:[{skewY:'-35deg'}]},search:{position:'absolute',left:2,top:2,width:16,height:16,borderWidth:1.8,borderRadius:10},head:{position:'absolute',left:8,top:2,width:9,height:9,borderWidth:1.8,borderRadius:6},shoulders:{position:'absolute',left:3,top:14,width:19,height:8,borderTopWidth:1.8,borderLeftWidth:1.8,borderRightWidth:1.8,borderTopLeftRadius:12,borderTopRightRadius:12},bookmark:{position:'absolute',left:6,top:3,width:13,height:16,borderTopWidth:1.8,borderLeftWidth:1.8,borderRightWidth:1.8,borderTopLeftRadius:3,borderTopRightRadius:3},notch:{position:'absolute',left:8,top:14,width:9,height:9,borderTopWidth:1.8,borderLeftWidth:1.8,transform:[{rotate:'45deg'}]},bell:{position:'absolute',left:5,top:4,width:14,height:14,borderWidth:1.8,borderBottomWidth:0,borderTopLeftRadius:9,borderTopRightRadius:9},glyph:{position:'absolute',width:24,textAlign:'center',fontWeight:'400'}});
