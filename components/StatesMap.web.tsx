import React,{useEffect,useMemo,useRef} from 'react';
import {regionsMapHtml} from '../lib/regionsMapHtml';
import {getRegionsJson} from '../lib/regionsData';
import {parseStatesMapMessage,parseStatesMapExport,parseStatesMapExportError,type StatesMapProps} from './statesMapTypes';

// Web: el mapa vive en un iframe y avisa cuántos estados pintó. Solo se aceptan mensajes de ese iframe.
export default function StatesMap({points,onResult,expanded=false,shareOwner,exportRequest=0,onExport,onExportError}:StatesMapProps){
 const name=shareOwner?.name??'Mi mapa',handle=shareOwner?.handle,rank=shareOwner?.rank??'De estreno';
 const html=useMemo(()=>regionsMapHtml(getRegionsJson(),points,expanded),[points,expanded]);
 const frame=useRef<{contentWindow?:Window|null}|null>(null);
 const ready=useRef(false),sent=useRef(0);
 useEffect(()=>{ready.current=false;},[html]);
 useEffect(()=>{
  const listener=(event:MessageEvent)=>{
   if(!event.source||event.source!==frame.current?.contentWindow||typeof event.data!=='string')return;
   const result=parseStatesMapMessage(event.data);if(result){ready.current=true;onResult?.(result);if(exportRequest>0&&sent.current!==exportRequest){sent.current=exportRequest;frame.current?.contentWindow?.postMessage(JSON.stringify({type:'porahi-map-export-request',request:exportRequest,owner:{name,handle,rank}}),'*');}return;}
   const image=parseStatesMapExport(event.data);if(image&&image.request===exportRequest){onExport?.(image.png,image.request);return;}
   const failure=parseStatesMapExportError(event.data);if(failure&&failure.request===exportRequest)onExportError?.(failure.message,failure.request);
  };
  window.addEventListener('message',listener);
  return()=>window.removeEventListener('message',listener);
 },[onResult,onExport,onExportError,exportRequest,name,handle,rank]);
 useEffect(()=>{if(exportRequest>0&&ready.current&&sent.current!==exportRequest){sent.current=exportRequest;frame.current?.contentWindow?.postMessage(JSON.stringify({type:'porahi-map-export-request',request:exportRequest,owner:{name,handle,rank}}),'*');}},[exportRequest,name,handle,rank]);
 return React.createElement('iframe' as never,{ref:frame,srcDoc:html,sandbox:'allow-scripts',title:'Mapa de estados reseñados',style:{border:0,width:'100%',height:'100%',background:'#0B0B0F'}} as never);
}
