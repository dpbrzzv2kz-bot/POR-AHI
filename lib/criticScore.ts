// Confianza como crítico: mide qué tan seguido la gente coincide contigo (corazones) frente a quienes no (tomates).
// No depende de cuánto publicas ni de si tu opinión es positiva o negativa. Con pocas reacciones no se calcula.
export const MIN_REACTIONS=20;
export type CriticKey='nuevo'|'desarrollo'|'consistente'|'confiable'|'referencia';
export type CriticLevel={key:CriticKey;name:string;minLower:number;minTotal:number;blurb:string};

// Cada nivel pide una coincidencia mínima (cota inferior de Wilson al 95 %) y un mínimo de reacciones.
export const criticLevels:CriticLevel[]=[
 {key:'nuevo',name:'Crítico nuevo',minLower:0,minTotal:0,blurb:'Todavía hay pocas reacciones para medir tu nivel.'},
 {key:'desarrollo',name:'Crítico en camino',minLower:0,minTotal:MIN_REACTIONS,blurb:'Estás empezando a construir tu criterio.'},
 {key:'consistente',name:'Crítico consistente',minLower:.45,minTotal:MIN_REACTIONS,blurb:'Mucha gente suele coincidir contigo.'},
 {key:'confiable',name:'Crítico confiable',minLower:.6,minTotal:40,blurb:'Tus reseñas suelen ser de las que la gente respalda.'},
 {key:'referencia',name:'Crítico de referencia',minLower:.75,minTotal:100,blurb:'Tu criterio es una referencia para la comunidad.'},
];

const count=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>0?Math.min(Math.floor(value),1e9):0;

// Con pocos votos un 100 % engaña: la cota inferior de Wilson sube solo cuando hay suficientes reacciones que lo respalden.
export function wilsonLowerBound(positive:number,total:number,z=1.96):number{
 if(total<=0)return 0;
 const p=positive/total,z2=z*z;
 return Math.max(0,(p+z2/(2*total)-z*Math.sqrt((p*(1-p)+z2/(4*total))/total))/(1+z2/total));
}

export type CriticProfile={level:CriticLevel;rank:number;total:number;measured:boolean;progress:number;next:CriticLevel|null;hint:string};
export function criticProfile(likesValue:unknown,tomatoesValue:unknown):CriticProfile{
 const likes=count(likesValue),tomatoes=count(tomatoesValue),total=likes+tomatoes;
 if(total<MIN_REACTIONS){
  const remaining=MIN_REACTIONS-total;
  return {level:criticLevels[0],rank:1,total,measured:false,progress:total/MIN_REACTIONS,next:criticLevels[1],hint:`Te faltan ${remaining} ${remaining===1?'reacción':'reacciones'} para calcular tu nivel.`};
 }
 const lower=wilsonLowerBound(likes,total);
 let rank=2;
 for(let i=2;i<criticLevels.length;i++)if(lower>=criticLevels[i].minLower&&total>=criticLevels[i].minTotal)rank=i+1;
 const level=criticLevels[rank-1],next=criticLevels[rank]??null;
 if(!next)return {level,rank,total,measured:true,progress:1,next:null,hint:'Llegaste al nivel más alto. Sigue siendo una referencia.'};
 const missing=Math.max(0,next.minTotal-total),needsAgreement=lower<next.minLower;
 const progress=Math.max(0,Math.min(1,Math.min(lower/next.minLower,total/next.minTotal)));
 const hint=needsAgreement&&missing>0?`Para ser ${next.name}: más gente que coincida contigo y ${missing} reacciones más.`:needsAgreement?`Para ser ${next.name}: que más gente coincida contigo.`:`Para ser ${next.name}: te faltan ${missing} ${missing===1?'reacción':'reacciones'}.`;
 return {level,rank,total,measured:true,progress,next,hint};
}
