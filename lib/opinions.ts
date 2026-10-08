export type ReactionMood='confetti'|'splash'|'none';
export type OpinionSummary={likes:number;tomatoes:number;total:number;positiveRatio:number|null;mood:ReactionMood};

// La calificacion del lugar la pone quien publica la resena (1 a 5), como estrellas con nombre propio.
export const placeRatings=[{value:5,label:'Imperdible'},{value:4,label:'Volvería'},{value:3,label:'Pasa'},{value:2,label:'Tomatazo'},{value:1,label:'Mejor nada'}] as const;
export function ratingLabel(value?:number|null):string|null{return placeRatings.find(item=>item.value===value)?.label??null;}
export const MIN_ATMOSPHERE_VOTES=8;

// These are reactions to a review. They do not prove the quality of the place it describes.
function voteCount(value:unknown):number{
 return typeof value==='number'&&Number.isFinite(value)&&value>0?Math.min(Math.floor(value),Math.floor(Number.MAX_SAFE_INTEGER/2)):0;
}
export function summarizeOpinion(likes:unknown=0,tomatoes:unknown=0):OpinionSummary{
 const positive=voteCount(likes),negative=voteCount(tomatoes),total=positive+negative;
 const positiveRatio=total?positive/total:null;
 const mood:ReactionMood=total<MIN_ATMOSPHERE_VOTES||positiveRatio===null?'none':positiveRatio>=.75?'confetti':positiveRatio<=.25?'splash':'none';
 return {likes:positive,tomatoes:negative,total,positiveRatio,mood};
}

// A missing edit history must never be presented as proof that a review was untouched.
export function reviewFootprint(createdAt?:string,version?:number):{date:string;intact:boolean;label:string}|null{
 if(!createdAt)return null;
 const timestamp=Date.parse(createdAt);
 if(!Number.isFinite(timestamp))return null;
 const date=new Date(timestamp).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
 const intact=version===0;
 return {date,intact,label:intact?`Reseña original, intacta desde el ${date}`:`Publicada el ${date}`};
}
