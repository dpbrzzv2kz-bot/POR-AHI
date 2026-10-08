import {isMapPng} from './passport';

export async function shareMapImage(png:string):Promise<'shared'|'downloaded'|'cancelled'>{
 if(!isMapPng(png))throw new Error('La imagen del mapa no es válida.');
 const binary=atob(png.split(',')[1]),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const file=new File([bytes],'mi-mapa-por-ahi.png',{type:'image/png'});
 if(navigator.canShare?.({files:[file]})&&navigator.share){
  try{await navigator.share({files:[file],title:'Mi mapa Por Ahí'});return 'shared';}
  catch(error){
   if(error instanceof DOMException&&error.name==='AbortError')return 'cancelled';
   // Algunos navegadores pierden la activación al generar el canvas en el iframe.
   // En ese caso conservamos la imagen mediante descarga, sin subirla a ningún sitio.
   if(!(error instanceof DOMException&&error.name==='NotAllowedError'))throw error;
  }
 }
 const url=URL.createObjectURL(file),link=document.createElement('a');
 link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 return 'downloaded';
}
