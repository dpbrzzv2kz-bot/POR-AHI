import {StyleSheet} from 'react-native';
import {palette as p} from './theme';

export default StyleSheet.create({
 screen:{flex:1,backgroundColor:p.canvas},content:{padding:22,paddingTop:26,paddingBottom:36,width:'100%',maxWidth:590,alignSelf:'center'},
 kicker:{fontSize:10,fontWeight:'800',letterSpacing:1.8,color:p.violet,marginBottom:10},title:{fontSize:31,lineHeight:36,fontWeight:'900',letterSpacing:-1,color:p.ink,marginBottom:16},
 body:{fontSize:15,lineHeight:24,color:p.ink,marginVertical:10},note:{fontSize:12,lineHeight:20,color:p.muted,marginVertical:10},label:{fontSize:12,fontWeight:'700',color:p.ink,marginTop:20,marginBottom:10},
 input:{minHeight:52,padding:15,borderRadius:15,backgroundColor:p.surface,borderWidth:1,borderColor:p.line,color:p.ink,fontSize:16},
 button:{minHeight:48,padding:15,borderRadius:15,backgroundColor:p.lime,alignItems:'center',justifyContent:'center',marginVertical:6},buttonText:{fontSize:13,fontWeight:'800',color:p.ink,textAlign:'center'},
 secondary:{minHeight:48,padding:15,borderRadius:15,backgroundColor:p.surface,borderWidth:1,borderColor:p.line,alignItems:'center',justifyContent:'center',marginVertical:6},secondaryText:{fontSize:13,fontWeight:'700',color:p.ink,textAlign:'center'},
 danger:{backgroundColor:p.error},dangerText:{color:p.onDark},error:{fontSize:13,lineHeight:21,color:p.error,backgroundColor:'#FDEEF0',padding:14,borderRadius:14,marginVertical:12},
 card:{backgroundColor:p.surface,borderWidth:1,borderColor:p.line,borderRadius:22,padding:18,marginVertical:10},notice:{backgroundColor:p.violetSoft,padding:15,borderRadius:15,color:p.ink,fontSize:13,lineHeight:22,marginVertical:12},
});
