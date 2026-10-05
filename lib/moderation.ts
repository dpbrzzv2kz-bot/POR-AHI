import {supabase} from './supabase';
export type Decision='hide'|'restore'|'review'|'dismiss'|'reopen';
export type ReportStatus='pending'|'reviewed'|'dismissed';
export type ReportRow={id:string;created_at:string;target_kind:string;reason:string;status:ReportStatus;review_version:number};
export type ReportDetail=ReportRow&{target_id:string;author:string|null;details:string;preview:string|null;available:boolean;hidden:boolean;media_path:string|null;media_kind:'image'|'video'|null;media_url?:string;history:{action:Decision;note:string;created_at:string;moderator_id:string}[]};
export const decisionLabels:Record<Decision,string>={hide:'Ocultar contenido',restore:'Restaurar contenido',review:'Marcar como revisado',dismiss:'Descartar reporte',reopen:'Reabrir reporte'};
export const statusLabels:Record<ReportStatus,string>={pending:'Pendientes',reviewed:'Revisados',dismissed:'Descartados'};
export async function checkModerator(){
 if(!supabase)throw new Error('Conexión no configurada.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const {data,error}=await supabase.rpc('is_moderator').abortSignal(controller.signal);
 if(error)throw new Error('No se pudo comprobar tu permiso. Vuelve a intentar.');
 return data===true;}finally{clearTimeout(timer);}
}
export async function loadModeration(status:ReportStatus){
 if(!supabase)throw new Error('Conexión no configurada.');
 const {data,error}=await supabase.rpc('moderation_queue',{p_status:status});
 if(error)throw new Error('No se pudo cargar el panel. Comprueba tu permiso de administración.');
 return (data||[]) as ReportRow[];
}
export async function loadReport(id:string){
 if(!supabase)throw new Error('Conexión no configurada.');
 const {data,error}=await supabase.rpc('moderation_report',{p_report:id});
 if(error||!data)throw new Error('No se pudo abrir el reporte. Comprueba tu permiso y vuelve a intentar.');
 const row=data as ReportDetail;
 if(row.media_path){const result=await supabase.storage.from('review-media').createSignedUrl(row.media_path,300);if(result.error)throw new Error('No se pudo cargar el archivo reportado. Vuelve a intentar.');row.media_url=result.data.signedUrl;}
 return row;
}
export async function decideReport(row:ReportDetail,action:Decision,note:string,requestId:string){
 if(!supabase)throw new Error('Conexión no configurada.');
 if(note.trim().length<3||note.trim().length>1000)throw new Error('Escribe un motivo de 3 a 1000 caracteres.');
 const {error}=await supabase.rpc('moderation_decide',{p_report:row.id,p_action:action,p_note:note.trim(),p_version:row.review_version,p_request:requestId});
 if(error)throw new Error('No se pudo confirmar. El reporte o tu permiso pudieron cambiar. Actualiza antes de intentar de nuevo.');
}
