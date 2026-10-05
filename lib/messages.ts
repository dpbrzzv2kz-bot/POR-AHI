import {supabase} from './supabase';
export type Conversation={id:string;peer_id:string;peer_name:string;peer_handle:string;last_body:string|null;updated_at:string};
export type Message={id:string;sender_id:string;body:string;created_at:string};
export async function loadInbox(){
 if(!supabase)throw new Error('Conexión no configurada.');
 const {data,error}=await supabase.from('chat_inbox').select('*').order('updated_at',{ascending:false}).limit(50);
 if(error)throw new Error('No se pudieron cargar tus conversaciones. Vuelve a intentar.');
 return (data||[]) as Conversation[];
}
export async function openConversation(userId:string,peerId:string){
 if(!supabase||userId===peerId)throw new Error('Elige el perfil de otra persona.');
 const [user_low,user_high]=[userId,peerId].sort();
 const result=await supabase.from('conversations').upsert({user_low,user_high},{onConflict:'user_low,user_high',ignoreDuplicates:true});
 if(result.error)throw new Error('No se pudo iniciar la conversación. Completa tu nombre y @usuario en Perfil.');
 const {data,error}=await supabase.from('chat_inbox').select('*').eq('peer_id',peerId).single();
 if(error||!data)throw new Error('No se pudo abrir la conversación. Vuelve a intentar.');
 return data as Conversation;
}
export async function loadMessages(id:string){
 if(!supabase)throw new Error('Conexión no configurada.');
 const {data,error}=await supabase.from('messages').select('id,sender_id,body,created_at').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
 if(error)throw new Error('No se pudo cargar el historial. Vuelve a intentar.');
 return ((data||[]) as Message[]).reverse();
}
export async function sendMessage(userId:string,conversationId:string,body:string,id:string){
 if(!supabase)throw new Error('Conexión no configurada.');
 const text=body.trim();if(!text||text.length>1000)throw new Error('Escribe de 1 a 1000 caracteres.');
 const {error}=await supabase.from('messages').upsert({id,conversation_id:conversationId,sender_id:userId,body:text},{onConflict:'id',ignoreDuplicates:true});
 if(error)throw new Error('No se pudo enviar. Tu texto sigue aquí para volver a intentar.');
}
