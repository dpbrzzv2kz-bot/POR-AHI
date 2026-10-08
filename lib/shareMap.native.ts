import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {isMapPng} from './passport';

export async function shareMapImage(png:string):Promise<'shared'|'downloaded'|'cancelled'>{
 if(!isMapPng(png))throw new Error('La imagen del mapa no es válida.');
 if(!await Sharing.isAvailableAsync())throw new Error('Este dispositivo no tiene una opción para compartir archivos.');
 const file=new File(Paths.cache,'por-ahi-mapa-'+Date.now()+'.png');
 try{
  file.create();
  file.write(png.split(',')[1],{encoding:'base64'});
  await Sharing.shareAsync(file.uri,{mimeType:'image/png',UTI:'public.png',dialogTitle:'Mi mapa Por Ahí'});
  return 'shared';
 }finally{try{if(file.exists)file.delete();}catch{/* El sistema también limpia la caché. */}}
}
