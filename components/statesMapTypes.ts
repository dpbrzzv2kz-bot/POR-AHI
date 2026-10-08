import type {VisitedPoint} from '../lib/regionsMapHtml';
export type CountryProgress={a:string;v:number;t:number;names:string[]};
export type StatesMapResult={count:number;total:number;countries:CountryProgress[]};
export type StatesMapProps={points:VisitedPoint[];onResult?:(result:StatesMapResult)=>void;expanded?:boolean};
export function parseStatesMapMessage(raw:string):StatesMapResult|null{
 try{
  const message=JSON.parse(raw);
  if(typeof message.count!=='number')return null;
  const countries:CountryProgress[]=Array.isArray(message.countries)?message.countries.filter((c:CountryProgress)=>c&&typeof c.a==='string'&&typeof c.v==='number'&&typeof c.t==='number'&&Array.isArray(c.names)):[];
  return {count:message.count,total:Number(message.total)||0,countries};
 }catch{return null;}
}
