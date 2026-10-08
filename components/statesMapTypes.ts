import type {VisitedPoint} from '../lib/regionsMapHtml';
import {isMapPng,uniquePassportStamps,type PassportStamp} from '../lib/passport.ts';
export type CountryProgress={a:string;v:number;t:number;names:string[]};
export type StatesMapResult={count:number;total:number;countries:CountryProgress[];regions:PassportStamp[]};
export type MapShareOwner={name:string;handle?:string;rank:string};
export type StatesMapProps={points:VisitedPoint[];onResult?:(result:StatesMapResult)=>void;expanded?:boolean;shareOwner?:MapShareOwner;exportRequest?:number;onExport?:(png:string,request:number)=>void;onExportError?:(message:string,request:number)=>void};
const boundedInt=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=10000;
export function parseStatesMapMessage(raw:string):StatesMapResult|null{
 try{
  if(raw.length>1500000)return null;
  const message=JSON.parse(raw);
  if(message.type!=='porahi-map-result'||!boundedInt(message.count)||!boundedInt(message.total)||message.count>message.total||!Array.isArray(message.regions)||!Array.isArray(message.countries))return null;
  const regions=uniquePassportStamps(message.regions).filter(region=>region.id.length<=120&&region.name.length<=160&&region.country.length<=160);
  if(regions.length!==message.count)return null;
  const countries:CountryProgress[]=message.countries.filter((c:CountryProgress)=>c&&typeof c.a==='string'&&c.a.length<=160&&boundedInt(c.v)&&boundedInt(c.t)&&c.v<=c.t&&Array.isArray(c.names)&&c.names.length===c.v&&c.names.every(n=>typeof n==='string'&&n.length<=160));
  if(countries.length!==message.countries.length)return null;
  return {count:regions.length,total:message.total,countries,regions};
 }catch{return null;}
}
export function parseStatesMapExport(raw:string):{request:number;png:string}|null{
 try{
  if(raw.length>12000500)return null;
  const message=JSON.parse(raw);
  return message.type==='porahi-map-export'&&Number.isSafeInteger(message.request)&&message.request>0&&isMapPng(message.png)?{request:message.request,png:message.png}:null;
 }catch{return null;}
}
export function parseStatesMapExportError(raw:string):{request:number;message:string}|null{
 try{if(raw.length>1000)return null;const value=JSON.parse(raw);return value.type==='porahi-map-export-error'&&Number.isSafeInteger(value.request)&&value.request>0?{request:value.request,message:'No se pudo crear la imagen del mapa. Intenta otra vez.'}:null;}catch{return null;}
}
