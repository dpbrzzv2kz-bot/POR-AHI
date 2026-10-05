import {supabase} from './supabase';
export type Notification={id:string;actor_id:string;actor_name:string;kind:'follow'|'like'|'comment';post_id:string|null;created_at:string;read_at:string|null};
export async function loadNotifications(userId:string,signal?:AbortSignal){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 let list=supabase.from('notifications').select('id,actor_id,actor_name,kind,post_id,created_at,read_at').eq('recipient_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
 let unread=supabase.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',userId).is('read_at',null);
 if(signal){list=list.abortSignal(signal);unread=unread.abortSignal(signal);}
 const [rows,total]=await Promise.all([list,unread]);
 if(rows.error||total.error)throw new Error('No se pudieron cargar tus notificaciones. Pulsa Actualizar avisos.');
 return {rows:(rows.data||[]) as Notification[],unread:total.count||0};
}
export async function markNotificationsRead(userId:string,id?:string){
 if(!supabase)throw new Error('La conexión todavía no está configurada.');
 let request=supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',userId).is('read_at',null);
 if(id)request=request.eq('id',id);
 const {error}=await request;
 if(error)throw new Error('No se pudo marcar como leído. Vuelve a intentar.');
}
export function notificationText(row:Notification){return `${row.actor_name} ${row.kind==='follow'?'empezó a seguirte.':row.kind==='like'?'dio me gusta a tu publicación.':'comentó tu publicación.'}`;}
