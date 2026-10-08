import React,{useMemo} from 'react';
import {WebView} from 'react-native-webview';
import {regionsMapHtml} from '../lib/regionsMapHtml';
import {getRegionsJson} from '../lib/regionsData';
import {parseStatesMapMessage,type StatesMapProps} from './statesMapTypes';

// iPhone y Android: el mapa vive en un WebView sin red (todo va dentro de la página).
export default function StatesMap({points,onResult,expanded=false}:StatesMapProps){
 const html=useMemo(()=>regionsMapHtml(getRegionsJson(),points,expanded),[points,expanded]);
 return <WebView originWhitelist={['*']} source={{html}} scrollEnabled={expanded} scalesPageToFit={expanded} javaScriptEnabled onMessage={event=>{const result=parseStatesMapMessage(event.nativeEvent.data);if(result)onResult?.(result);}} style={{flex:1,backgroundColor:'#0B0B0F'}}/>;
}
