import {supabase} from './supabase';
export type ReportTarget={kind:'profile'|'post'|'story'|'comment'|'message';id:string;label:string};
export type BlockedPerson={blocked_id:string;blocked_name:string;blocked_handle:string};
export const reportReasons=['Spam','Acoso','Contenido inapropiado','Suplantación','Otro'] as const;
export async function loadBlocks(){
 if(!supabase)throw new Error('Conexión no configurada.');
 const {data,error}=await supabase.from('user_blocks').select('blocked_id,blocked_name,blocked_handle').order('created_at',{ascending:false});
 if(error)throw new Error('No se pudieron cargar tus bloqueos. Vuelve a intentar.');
 return (data||[]) as BlockedPerson[];
}
export async function changeBlock(userId:string,targetId:string,blocked:boolean){
 if(!supabase)throw new Error('Conexión no configurada.');
 if(userId===targetId)throw new Error('Este es tu propio perfil.');
 const result=blocked?await supabase.from('user_blocks').upsert({blocker_id:userId,blocked_id:targetId},{onConflict:'blocker_id,blocked_id',ignoreDuplicates:true}):await supabase.from('user_blocks').delete().eq('blocker_id',userId).eq('blocked_id',targetId);
 if(result.error)throw new Error('No se pudo cambiar el bloqueo. Revisa tu sesión y vuelve a intentar.');
}
export async function submitReport(userId:string,target:ReportTarget,reason:string,details:string){
 if(!supabase)throw new Error('Conexión no configurada.');
 const {error}=await supabase.from('content_reports').upsert({reporter_id:userId,target_kind:target.kind,target_id:target.id,reason,details:details.trim()},{onConflict:'reporter_id,target_kind,target_id',ignoreDuplicates:true});
 if(error)throw new Error('No se pudo registrar. El contenido debe seguir disponible y pertenecer a otra persona. Vuelve a intentar.');
}
