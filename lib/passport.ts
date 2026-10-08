export type PassportStamp={id:string;name:string;country:string};
export const passportRanks=[
 {min:0,name:'De estreno'},
 {min:1,name:'Primer paso'},
 {min:3,name:'Pata de perro'},
 {min:5,name:'Mochilero'},
 {min:10,name:'Cazarrutas'},
 {min:15,name:'Trotamundos'},
 {min:25,name:'Cruza fronteras'},
 {min:40,name:'Cartógrafo callejero'},
 {min:75,name:'Leyenda del camino'},
 {min:150,name:'Sin fronteras'},
] as const;

// El sello pertenece a un estado, no a cada reseña. Dos estados homónimos
// en distintos países conservan sellos distintos gracias al ID del mapa.
export function uniquePassportStamps(values:readonly PassportStamp[]):PassportStamp[]{
 const ids=new Set<string>();
 return values.filter(value=>{
  if(!value||typeof value.id!=='string'||!value.id||typeof value.name!=='string'||!value.name||typeof value.country!=='string'||!value.country||ids.has(value.id))return false;
  ids.add(value.id);return true;
 }).map(value=>({id:value.id,name:value.name,country:value.country}));
}

export function passportProgress(rawCount:number){
 const count=Number.isFinite(rawCount)?Math.max(0,Math.floor(rawCount)):0;
 let index=0;
 for(let i=1;i<passportRanks.length;i++)if(count>=passportRanks[i].min)index=i;
 const current=passportRanks[index],next=passportRanks[index+1]??null;
 const progress=next?Math.min(1,(count-current.min)/(next.min-current.min)):1;
 return {count,level:index+1,current,next,remaining:next?next.min-count:0,progress};
}

// Solo aceptamos un PNG generado por el mapa, con un tamaño acotado.
export function isMapPng(value:unknown):value is string{
 return typeof value==='string'&&value.length<12000000&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value);
}
