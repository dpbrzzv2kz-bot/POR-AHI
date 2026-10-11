import {APP_ORIGIN} from './appOrigin.ts';
const publicOrigin=APP_ORIGIN;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function sharedReviewId(value:unknown):string|null{
 return typeof value==='string'&&uuid.test(value)?value.toLowerCase():null;
}
export type ShareableReview={id:string;cloud?:boolean;place:string;author:string};
export function reviewLink(review:Pick<ShareableReview,'id'|'cloud'>):string{
 const id=sharedReviewId(review.id);
 if(!review.cloud||!id)throw new Error('Elige una reseña publicada para compartir.');
 return `${publicOrigin}/?review=${id}`;
}
export type SharingTransport={
 share?:(data:{title:string;text:string;url:string})=>Promise<'dismissed'|void>;
 copy?:(url:string)=>Promise<void>;
};
// Cancellation never falls through to clipboard: copying is a separate outcome.
export async function deliverReviewLink(review:ShareableReview,action:'share'|'copy',transport:SharingTransport):Promise<'shared'|'copied'|'cancelled'|'manual'>{
 const url=reviewLink(review);
 if(action==='share'&&transport.share){
  try{
   const result=await transport.share({title:review.place+' · Por Ahí',text:review.author+' recomienda '+review.place+'.',url});
   return result==='dismissed'?'cancelled':'shared';
  }catch(e){if(e&&typeof e==='object'&&'name' in e&&e.name==='AbortError')return 'cancelled';}
 }
 if(transport.copy){try{await transport.copy(url);return 'copied';}catch{}}
 return 'manual';
}
