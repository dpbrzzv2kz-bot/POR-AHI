import {supabase} from './supabase';
export type PublicProfile={id:string;name:string;handle:string;bio:string;symbol:string};
export async function searchPeople(query:string,signal?:AbortSignal):Promise<PublicProfile[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const clean=query.trim().replace(/^@/,'').replace(/[^\p{L}\p{N}_. ]/gu,'').slice(0,80).replace(/_/g,'\\_');
 let request=supabase.from('public_profiles').select('id,display_name,username,bio').order('display_name').order('id').limit(30);
 if(clean)request=request.or(`display_name.ilike.%${clean}%,username.ilike.%${clean}%`);
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 if(error)throw new Error('No se pudo buscar. Vuelve a intentar.');
 return (data||[]).map(p=>({id:p.id,name:p.display_name,handle:p.username,bio:p.bio,symbol:p.display_name[0]?.toUpperCase()||'?'}));
}
export async function loadFollowing(userId:string):Promise<string[]>{
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 const {data,error}=await supabase.from('follows').select('followed_id').eq('follower_id',userId);
 if(error)throw new Error('No se pudo cargar a quién sigues. Vuelve a intentar.');
 return (data||[]).map(row=>row.followed_id);
}
export async function changeFollow(userId:string,targetId:string,follow:boolean){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 if(userId===targetId)throw new Error('Este es tu propio perfil.');
 const result=follow?await supabase.from('follows').upsert({follower_id:userId,followed_id:targetId},{onConflict:'follower_id,followed_id',ignoreDuplicates:true}):await supabase.from('follows').delete().eq('follower_id',userId).eq('followed_id',targetId);
 if(result.error)throw new Error('No se pudo cambiar el seguimiento. Comprueba tu sesión y que hayas guardado tu perfil.');
}
