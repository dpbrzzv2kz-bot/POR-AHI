import React,{useEffect,useMemo,useRef} from 'react';
import {WebView} from 'react-native-webview';
import {regionsMapHtml} from '../lib/regionsMapHtml';
import {getRegionsJson} from '../lib/regionsData';
import {parseStatesMapMessage,parseStatesMapExport,parseStatesMapExportError,type StatesMapProps} from './statesMapTypes';

// iPhone y Android: el mapa vive en un WebView sin red (todo va dentro de la página).
export default function StatesMap({points,onResult,expanded=false,shareOwner,exportRequest=0,onExport,onExportError}:StatesMapProps){
 const name=shareOwner?.name??'Mi mapa',handle=shareOwner?.handle,rank=shareOwner?.rank??'De estreno';
 const html=useMemo(()=>regionsMapHtml(getRegionsJson(),points,expanded),[points,expanded]);
 const view=useRef<WebView>(null),ready=useRef(false),sent=useRef(0);
 useEffect(()=>{ready.current=false;},[html]);
 useEffect(()=>{if(exportRequest>0&&ready.current&&sent.current!==exportRequest){sent.current=exportRequest;view.current?.injectJavaScript('window.exportPorAhiMap?.('+String(exportRequest)+','+JSON.stringify({name,handle,rank}).replace(/</g,'\\u003c')+'); true;');}},[exportRequest,name,handle,rank]);
 return <WebView ref={view} originWhitelist={['*']} source={{html}} scrollEnabled={expanded} scalesPageToFit={expanded} javaScriptEnabled allowFileAccess={false} mixedContentMode="never" onShouldStartLoadWithRequest={request=>request.url==='about:blank'||request.url.startsWith('data:text/html')} onMessage={event=>{
  const raw=event.nativeEvent.data,result=parseStatesMapMessage(raw);if(result){ready.current=true;onResult?.(result);if(exportRequest>0&&sent.current!==exportRequest){sent.current=exportRequest;view.current?.injectJavaScript('window.exportPorAhiMap?.('+String(exportRequest)+','+JSON.stringify({name,handle,rank}).replace(/</g,'\\u003c')+'); true;');}return;}
  const image=parseStatesMapExport(raw);if(image&&image.request===exportRequest){onExport?.(image.png,image.request);return;}
  const failure=parseStatesMapExportError(raw);if(failure&&failure.request===exportRequest)onExportError?.(failure.message,failure.request);
 }} style={{flex:1,backgroundColor:'#0B0B0F'}}/>;
}
