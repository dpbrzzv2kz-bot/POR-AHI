import React,{useMemo} from 'react';
import {WebView} from 'react-native-webview';
import {regionsMapHtml} from '../lib/regionsMapHtml';
import {getRegionsJson} from '../lib/regionsData';
import type {StatesMapProps} from './statesMapTypes';

// iPhone y Android: el mapa vive en un WebView sin red (todo va dentro de la página).
export default function StatesMap({points,onCount}:StatesMapProps){
 const html=useMemo(()=>regionsMapHtml(getRegionsJson(),points),[points]);
 return <WebView originWhitelist={['*']} source={{html}} scrollEnabled={false} javaScriptEnabled onMessage={event=>{try{const message=JSON.parse(event.nativeEvent.data);if(typeof message.count==='number')onCount?.(message.count);}catch{/* Mensaje ajeno al mapa. */}}} style={{flex:1,backgroundColor:'#0B0B0F'}}/>;
}
