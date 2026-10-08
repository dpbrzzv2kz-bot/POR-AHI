import React,{useEffect,useMemo,useRef} from 'react';
import {regionsMapHtml} from '../lib/regionsMapHtml';
import {getRegionsJson} from '../lib/regionsData';
import {parseStatesMapMessage,type StatesMapProps} from './statesMapTypes';

// Web: el mapa vive en un iframe y avisa cuántos estados pintó. Solo se aceptan mensajes de ese iframe.
export default function StatesMap({points,onResult,expanded=false}:StatesMapProps){
 const html=useMemo(()=>regionsMapHtml(getRegionsJson(),points,expanded),[points,expanded]);
 const frame=useRef<{contentWindow?:Window|null}|null>(null);
 useEffect(()=>{
  const listener=(event:MessageEvent)=>{
   if(!event.source||event.source!==frame.current?.contentWindow||typeof event.data!=='string')return;
   const result=parseStatesMapMessage(event.data);if(result)onResult?.(result);
  };
  window.addEventListener('message',listener);
  return()=>window.removeEventListener('message',listener);
 },[onResult]);
 return React.createElement('iframe' as never,{ref:frame,srcDoc:html,title:'Mapa de estados reseñados',style:{border:0,width:'100%',height:'100%',background:'#0B0B0F'}} as never);
}
