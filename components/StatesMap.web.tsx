import React,{useEffect,useMemo,useRef} from 'react';
import {regionsMapHtml} from '../lib/regionsMapHtml';
import {getRegionsJson} from '../lib/regionsData';
import type {StatesMapProps} from './statesMapTypes';

// Web: el mapa vive en un iframe y avisa cuántos estados pintó. Solo se aceptan mensajes de ese iframe.
export default function StatesMap({points,onCount}:StatesMapProps){
 const html=useMemo(()=>regionsMapHtml(getRegionsJson(),points),[points]);
 const frame=useRef<{contentWindow?:Window|null}|null>(null);
 useEffect(()=>{
  const listener=(event:MessageEvent)=>{
   if(!event.source||event.source!==frame.current?.contentWindow||typeof event.data!=='string')return;
   try{const message=JSON.parse(event.data);if(typeof message.count==='number')onCount?.(message.count);}catch{/* Mensaje ajeno al mapa. */}
  };
  window.addEventListener('message',listener);
  return()=>window.removeEventListener('message',listener);
 },[onCount]);
 return React.createElement('iframe' as never,{ref:frame,srcDoc:html,title:'Mapa de estados reseñados',style:{border:0,width:'100%',height:'100%',background:'#0B0B0F'}} as never);
}
