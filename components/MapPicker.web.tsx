import React,{useEffect,useRef} from 'react';
import MapPickerShell,{type MapPickerProps} from './MapPickerShell';

// Web: el mapa vive en un iframe y avisa con postMessage. Solo se aceptan mensajes de ese iframe.
function WebMap({html,onRaw}:{html:string;onRaw:(raw:string)=>void}){
 const frame=useRef<{contentWindow?:Window|null}|null>(null);
 useEffect(()=>{
  const listener=(event:MessageEvent)=>{if(event.source&&event.source===frame.current?.contentWindow&&typeof event.data==='string')onRaw(event.data);};
  window.addEventListener('message',listener);
  return()=>window.removeEventListener('message',listener);
 },[onRaw]);
 return React.createElement('iframe' as never,{ref:frame,srcDoc:html,title:'Mapa para elegir el lugar',style:{border:0,width:'100%',height:'100%'}} as never);
}
export default function MapPicker(props:MapPickerProps){
 return <MapPickerShell {...props} surface={({html,onRaw})=><WebMap html={html} onRaw={onRaw}/>}/>;
}
