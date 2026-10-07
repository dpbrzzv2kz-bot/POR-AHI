// Browser integration fixture only: never connects to Google or Supabase.
// Database permissions are independently verified by verify_beta_rollback.sql.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Buffer} from 'node:buffer';

const app=resolve(process.argv[2] || '.'),preview=resolve(app,'../../work/beta-preview');
const api='http://127.0.0.1:8797',ports=[8797,8798,8799];
const env=await readFile(resolve(app,'.env'),'utf8');
const productionKey=env.match(/^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim();
if(!productionKey)throw Error('Public build key not found');
const now=()=>new Date().toISOString();
const profiles=ports.map((_,i)=>({id:`10000000-0000-4000-8000-00000000000${i+1}`,display_name:['Beta Ana','Beta Bruno','Beta Carla'][i],username:['beta_ana','beta_bruno','beta_carla'][i],bio:'Perfil ficticio para pruebas locales'}));
const userOf=id=>({id,aud:'authenticated',role:'authenticated',email:`${profiles.find(p=>p.id===id).username}@example.invalid`,created_at:now(),app_metadata:{providers:['google']},user_metadata:{},identities:[{id,identity_id:id,user_id:id,provider:'google',created_at:now(),updated_at:now()}]});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const tokens=new Map(profiles.map(p=>[p.id,`${encode({alg:'HS256'})}.${encode({sub:p.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+7200})}.local-beta-only`]));
const session=id=>({access_token:tokens.get(id),refresh_token:`local-refresh-${id}`,token_type:'bearer',expires_in:7200,user:userOf(id)});
const data={posts:[],stories:[],follows:[],post_likes:[],bookmarks:[],comments:[],notifications:[],conversations:[],messages:[],user_blocks:[],content_reports:[]};
const files=new Map(),uploads=new Map(),events=[];
const deleting=new Set();
const contentDeletions=new Map();
let failContentOnce=process.env.BETA_CONTENT_FAILURE==='1';
if(process.env.BETA_OWN_CONTENT==='1'){
 const png=await readFile(resolve(app,'public/icons/icon-512.png'));
 for(const [i,p] of profiles.slice(0,2).entries()){
  const path=`${p.id}/review-fixture.png`;files.set(path,{bytes:png,mime:'image/png'});
  data.posts.push({id:randomUUID(),user_id:p.id,author_name:p.display_name,place:['Café de prueba Ana','Museo de prueba Bruno'][i],category:i?'Explorar':'Comer',description:'Reseña ficticia para editar y eliminar.',kind:'image',media_path:path,edit_version:0,created_at:now()});
 }
 const path=`${profiles[0].id}/story-fixture.png`;files.set(path,{bytes:png,mime:'image/png'});
 data.stories.push({id:randomUUID(),user_id:profiles[0].id,author_name:profiles[0].display_name,kind:'image',media_path:path,expires_at:new Date(Date.now()+86400000).toISOString(),created_at:now()});
}
let failDeletionOnce=process.env.BETA_DELETE_FAILURE==='1';
let sharedReviewFailures=process.env.BETA_SHARING_FAILURE==='1'?4:0;
if(process.env.BETA_SHARING==='1'){
 const png=await readFile(resolve(app,'public/icons/icon-512.png'));
 // Put Ana's seeded review beyond the newest 60 to exercise lookup by ID.
 for(let i=0;i<63;i++){
  const path=`${profiles[1].id}/sharing-${i}.png`;files.set(path,{bytes:png,mime:'image/png'});
  data.posts.push({id:randomUUID(),user_id:profiles[1].id,author_name:profiles[1].display_name,place:'Ejemplo reciente '+i,category:'Explorar',description:'Dato ficticio para probar un enlace a una reseña antigua.',kind:'image',media_path:path,edit_version:0,created_at:now()});
 }
 const path=`${profiles[0].id}/sharing-video.mp4`,video=await readFile(resolve(app,'../../work/media-fixtures/video-base.mp4'));
 files.set(path,{bytes:video,mime:'video/mp4'});
 data.posts.push({id:randomUUID(),user_id:profiles[0].id,author_name:profiles[0].display_name,place:'Video de prueba para compartir',category:'Divertirse',description:'Video ficticio reproducible por enlace.',kind:'video',media_path:path,edit_version:0,created_at:now()});
}
if(failDeletionOnce)files.set(`${profiles[2].id}/delete-test.png`,{bytes:Buffer.from('Synthetic local file'),mime:'image/png'});
let failMessageOnce=true;

// Isolated copies of the existing production export. No Expo code is changed.
const source=resolve(app,process.argv[3]||'web-preview');
for(const port of ports){
 const root=resolve(preview,String(port));await mkdir(root,{recursive:true});await cp(source,root,{recursive:true});
 const html=await readFile(resolve(root,'index.html'),'utf8');
 const bundle=html.match(/src="([^"]+entry-[^"]+\.js)"/)?.[1];if(!bundle)throw Error('Production entry missing');
 const path=resolve(root,'.'+bundle),text=await readFile(path,'utf8');
 const updated=text.replaceAll('https://bxsllqteuafbusruspqd.supabase.co',api).replaceAll('https://incredible-crumble-34cbca.netlify.app',`http://127.0.0.1:${port}`).replaceAll(productionKey,'local-beta-public-key');
 if(updated.includes('bxsllqteuafbusruspqd.supabase.co')||updated.includes(productionKey)||updated.includes('https://incredible-crumble-34cbca.netlify.app'))throw Error('Production endpoint remained in fixture');
 await writeFile(path,updated);await writeFile(resolve(root,'index.html'),html.replace('<title>resenas-app</title>','<title>Por Ahí · prueba local</title>'));
 await writeFile(resolve(root,'__mobile.html'),`<!doctype html><meta charset="utf-8"><title>Prueba web a 393 px</title><style>body{margin:20px;background:#eee;font:16px system-ui}iframe{display:block;width:393px;height:852px;border:1px solid #aaa;background:white}</style><h1>Prueba local de vista móvil</h1><p>393 × 852 px. Entorno ficticio; no es Safari ni un iPhone físico.</p><iframe title="Vista móvil" src="/?account=1"></iframe>`);
}

const bytes=async req=>{const parts=[];for await(const part of req)parts.push(part);return Buffer.concat(parts);};
const body=async req=>JSON.parse((await bytes(req)).toString()||'{}');
const reply=(res,value,status=200,headers={})=>res.writeHead(status,{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01',...headers}).end(JSON.stringify(value));
const blocked=(a,b)=>!!a&&data.user_blocks.some(r=>(r.blocker_id===a&&r.blocked_id===b)||(r.blocker_id===b&&r.blocked_id===a));
const visiblePost=(id,uid)=>data.posts.some(p=>p.id===id&&!blocked(uid,p.user_id)&&!contentDeletions.has('post:'+p.id));
const accessibleChat=(id,uid)=>data.conversations.some(c=>c.id===id&&[c.user_low,c.user_high].includes(uid)&&!blocked(uid,c.user_low===uid?c.user_high:c.user_low));
const event=(type,uid,extra={})=>events.push({type,actor:profiles.find(p=>p.id===uid)?.username || 'visitor',...extra});
const notice=(recipient,actor,kind,post=null,comment=null)=>{
 if(recipient===actor)return;
 const key=`${kind}:${actor}:${comment||post||recipient}`;let n=data.notifications.find(r=>r.event_key===key);
 if(n){n.withdrawn_at=null;return;}
 data.notifications.push({id:randomUUID(),recipient_id:recipient,actor_id:actor,actor_name:profiles.find(p=>p.id===actor)?.display_name,kind,post_id:post,comment_id:comment,event_key:key,created_at:now(),read_at:null,withdrawn_at:null});
};
const filter=(rows,url)=>rows.filter(row=>[...url.searchParams].every(([key,value])=>{
 if(['select','order','limit','offset','on_conflict','or'].includes(key))return true;
 if(value.startsWith('eq.'))return String(row[key])===value.slice(3);
 if(value.startsWith('in.'))return value.slice(4,-1).split(',').includes(String(row[key]));
 if(value==='is.null')return row[key]==null;return true;
}));
const tableRows=(table,uid)=>{
 if(table==='profiles')return profiles.filter(p=>p.id===uid);
 if(table==='public_profiles')return profiles.filter(p=>!blocked(uid,p.id));
 if(table==='posts'||table==='stories')return data[table].filter(p=>!blocked(uid,p.user_id)&&!contentDeletions.has((table==='posts'?'post:':'story:')+p.id)&&(table!=='stories'||Date.parse(p.expires_at)>Date.now()));
 if(table==='post_stats')return data.posts.filter(p=>visiblePost(p.id,uid)).map(p=>({post_id:p.id,likes_count:data.post_likes.filter(r=>r.post_id===p.id).length,comments_count:data.comments.filter(r=>r.post_id===p.id&&!r.deleted_at).length}));
 if(['follows','post_likes','bookmarks','notifications','user_blocks','content_reports'].includes(table))return data[table].filter(r=>(r.follower_id||r.user_id||r.recipient_id||r.blocker_id||r.reporter_id)===uid&&(!r.recipient_id||!r.withdrawn_at&&!blocked(uid,r.actor_id)));
 if(table==='comments')return data.comments.filter(r=>visiblePost(r.post_id,uid)&&!blocked(uid,r.user_id)&&(!r.deleted_at||r.user_id===uid));
 if(table==='conversations')return data.conversations.filter(c=>accessibleChat(c.id,uid));
 if(table==='messages')return data.messages.filter(m=>accessibleChat(m.conversation_id,uid));
 if(table==='chat_inbox')return data.conversations.filter(c=>accessibleChat(c.id,uid)).map(c=>{
  const peer=profiles.find(p=>p.id===(c.user_low===uid?c.user_high:c.user_low));return {id:c.id,updated_at:c.updated_at,peer_id:peer.id,peer_name:peer.display_name,peer_handle:peer.username,last_body:data.messages.filter(m=>m.conversation_id===c.id).at(-1)?.body||null};
 });return [];
};

async function handle(req,res,port){try{
 const origin=`http://127.0.0.1:${port}`,url=new URL(req.url,origin),path=decodeURIComponent(url.pathname);
 if(ports.map(p=>`http://127.0.0.1:${p}`).includes(req.headers.origin))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
 res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Expose-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,PATCH,DELETE,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 let uid=[...tokens].find(([,token])=>req.headers.authorization===`Bearer ${token}`)?.[0];
 if(uid&&!profiles.some(p=>p.id===uid))uid=undefined;
 if(path==='/__fixture'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(`<!doctype html><meta charset="utf-8"><title>Beta local · tres cuentas ficticias</title><h1>Prueba local de Por Ahí</h1><p>Datos ficticios; sin conexión a Supabase ni Google.</p>${profiles.map((p,i)=>`<p><a href="http://127.0.0.1:${ports[i]}/auth/google#access_token=${tokens.get(p.id)}&refresh_token=local-refresh-${p.id}&token_type=bearer&expires_in=7200">Abrir ${p.display_name}</a></p>`).join('')}<p><a href="/">Explorar sin entrar</a></p><p><a href="/__mobile.html">Vista web a 393 px</a></p><p><a href="/__checks">Resultados del entorno local</a></p>`);return;
 }
 if(path==='/__checks'){reply(res,{events,profiles,counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),posts:data.posts.map(p=>({id:p.id,place:p.place,version:p.edit_version})),pending:[...contentDeletions.values()].filter(d=>!d.finished),messages:data.messages.map(m=>({body:m.body,conversation_id:m.conversation_id})),files:[...files.values()].map(f=>({size:f.bytes.length,mime:f.mime})),isolated:true});return;}
 if(path==='/auth/v1/settings'){reply(res,{external:{google:true}});return;}
 if(path==='/auth/v1/user'){reply(res,uid?userOf(uid):{code:'bad_jwt',msg:'Invalid local session'},uid?200:401);return;}
 if(path==='/auth/v1/token'){const value=await body(req),id=profiles.find(p=>value.refresh_token===`local-refresh-${p.id}`)?.id;reply(res,id?session(id):{code:'invalid_grant'},id?200:400);return;}
 if(path==='/auth/v1/logout'){res.writeHead(204).end();return;}
 if(path==='/rest/v1/rpc/account_deletion'){
  const value=await body(req);
  if(!uid){reply(res,{code:'42501',message:'SIGN_IN_REQUIRED'},403);return;}
  if(value.p_action==='status'){reply(res,{pending:deleting.has(uid)});return;}
  if(value.p_confirmation!=='ELIMINAR'){reply(res,{message:'CONFIRMATION_REQUIRED'},400);return;}
  if(value.p_action==='begin'){deleting.add(uid);event('deletion_started',uid);reply(res,{pending:true});return;}
  if(!deleting.has(uid)){reply(res,{message:'DELETION_NOT_STARTED'},400);return;}
  const ownFiles=[...files.keys()].filter(path=>path.startsWith(`${uid}/`));
  if(value.p_action==='files'){reply(res,{files:ownFiles.slice(0,100)});return;}
  if(value.p_action==='finish'){
   if(ownFiles.length){reply(res,{message:'FILES_REMAIN'},400);return;}
   event('account_deleted',uid);profiles.splice(profiles.findIndex(p=>p.id===uid),1);deleting.delete(uid);reply(res,{deleted:true});return;
  }
 }
 if(path==='/rest/v1/rpc/edit_own_review'){
  const value=await body(req),row=data.posts.find(p=>p.id===value.p_id&&p.user_id===uid);
  if(!uid||!row||contentDeletions.has('post:'+value.p_id)){reply(res,{message:'CONTENT_UNAVAILABLE'},403);return;}
  if(row.edit_version!==value.p_version){reply(res,{message:'EDIT_CONFLICT'},409);return;}
  if(!['Comer','Divertirse','Explorar'].includes(value.p_category)||value.p_place.trim().length<2||value.p_place.length>100||value.p_description.length>1500){reply(res,{message:'INVALID_DETAILS'},400);return;}
  Object.assign(row,{place:value.p_place.trim(),category:value.p_category,description:value.p_description,edit_version:row.edit_version+1});event('own_review_edited',uid,{id:row.id});reply(res,{id:row.id,version:row.edit_version});return;
 }
 if(path==='/rest/v1/rpc/content_management'){
  const value=await body(req);
  if(!uid){reply(res,{message:'SIGN_IN_REQUIRED'},403);return;}
  if(value.p_action==='pending'){reply(res,{items:[...contentDeletions.values()].filter(d=>d.owner===uid&&!d.finished).map(d=>({kind:d.kind,id:d.id}))});return;}
  if(value.p_confirmation!=='ELIMINAR'){reply(res,{message:'CONFIRMATION_REQUIRED'},400);return;}
  const key=value.p_kind+':'+value.p_id,table=value.p_kind==='post'?'posts':'stories';let d=contentDeletions.get(key);
  if(d&&d.owner!==uid){reply(res,{message:'CONTENT_UNAVAILABLE'},403);return;}
  if(d?.finished){reply(res,{deleted:true});return;}
  if(value.p_action==='begin'){
   if(!d){const row=data[table].find(r=>r.id===value.p_id&&r.user_id===uid);if(!row){reply(res,{message:'CONTENT_UNAVAILABLE'},403);return;}
    d={kind:value.p_kind,id:row.id,owner:uid,path:row.media_path,finished:false};contentDeletions.set(key,d);event('own_content_withdrawn',uid,{kind:d.kind,id:d.id});}
   reply(res,{file:d.path,pending:true});return;
  }
  if(value.p_action==='finish'&&d){
   if(files.has(d.path)){reply(res,{message:'FILES_REMAIN'},400);return;}
   data[table]=data[table].filter(r=>r.id!==d.id);
   if(d.kind==='post')for(const table of ['post_likes','bookmarks','comments','notifications'])data[table]=data[table].filter(r=>r.post_id!==d.id);
   d.finished=true;event('own_content_deleted',uid,{kind:d.kind,id:d.id});reply(res,{deleted:true});return;
  }
  reply(res,{message:'INVALID_ACTION'},400);return;
 }
 if(path==='/storage/v1/object/review-media'&&req.method==='DELETE'){
  const value=await body(req);
  if(!uid||value.prefixes.some(path=>!path.startsWith(`${uid}/`)||(!deleting.has(uid)&&![...contentDeletions.values()].some(d=>d.owner===uid&&d.path===path&&!d.finished)))){reply(res,{message:'Denied'},403);return;}
  if(failContentOnce){failContentOnce=false;reply(res,{message:'Temporary failure'},503);return;}
  if(failDeletionOnce){failDeletionOnce=false;reply(res,{message:'Temporary failure'},503);return;}
  for(const name of value.prefixes)files.delete(name);
  event('deletion_files_removed',uid,{count:value.prefixes.length});reply(res,value.prefixes.map(name=>({name})));return;
 }
 if(path.startsWith('/rest/v1/rpc/')){await bytes(req);reply(res,path.endsWith('is_moderator')?false:[]);return;}
 if(path.startsWith('/rest/v1/')){
  const table=path.split('/').at(-1);
  if(table==='posts'&&req.method==='GET'&&url.searchParams.get('id')?.startsWith('in.')&&sharedReviewFailures>0){sharedReviewFailures--;event('simulated_shared_review_failure',uid);reply(res,{message:'Synthetic temporary failure'},503);return;}
  if(!['GET','HEAD'].includes(req.method)){
   if(!uid){reply(res,{code:'42501',message:'Local session required'},403);return;}
   const row=await body(req);
   if(req.method==='POST'){
    if(table==='profiles'){const profile=profiles.find(p=>p.id===uid);if(row.id!==uid){reply(res,{code:'42501'},403);return;}Object.assign(profile,row);event('profile_saved',uid);}
    else if(table==='posts'||table==='stories'){
     if(row.user_id!==uid||!files.has(row.media_path)){reply(res,{code:'42501'},403);return;}
     if(!data[table].some(p=>p.media_path===row.media_path)){data[table].push({...row,id:randomUUID(),author_name:profiles.find(p=>p.id===uid).display_name,created_at:now(),expires_at:new Date(Date.now()+86400000).toISOString()});event(table==='posts'?'review_published':'story_published',uid,{kind:row.kind});}
    }else if(table==='follows'){
     if(row.follower_id!==uid||blocked(uid,row.followed_id)){reply(res,{code:'42501'},403);return;}
     if(!data.follows.some(r=>r.follower_id===uid&&r.followed_id===row.followed_id)){data.follows.push(row);notice(row.followed_id,uid,'follow');event('follow',uid);}
    }else if(table==='post_likes'||table==='bookmarks'){
     if(row.user_id!==uid||!visiblePost(row.post_id,uid)){reply(res,{code:'42501'},403);return;}
     if(!data[table].some(r=>r.user_id===uid&&r.post_id===row.post_id)){data[table].push({...row,created_at:now()});if(table==='post_likes')notice(data.posts.find(p=>p.id===row.post_id).user_id,uid,'like',row.post_id);event(table==='bookmarks'?'bookmark':'like',uid);}
    }else if(table==='comments'){
     if(row.user_id!==uid||!visiblePost(row.post_id,uid)){reply(res,{code:'42501'},403);return;}
     if(!data.comments.some(r=>r.id===row.id)){data.comments.push({...row,author_name:profiles.find(p=>p.id===uid).display_name,created_at:now(),deleted_at:null});notice(data.posts.find(p=>p.id===row.post_id).user_id,uid,'comment',row.post_id,row.id);event('comment',uid);}
    }else if(table==='conversations'){
     if(![row.user_low,row.user_high].includes(uid)||blocked(row.user_low,row.user_high)){reply(res,{code:'42501'},403);return;}
     if(!data.conversations.some(c=>c.user_low===row.user_low&&c.user_high===row.user_high))data.conversations.push({...row,id:randomUUID(),updated_at:now()});
    }else if(table==='messages'){
     if(row.sender_id!==uid||!accessibleChat(row.conversation_id,uid)){reply(res,{code:'42501'},403);return;}
     if(failMessageOnce){failMessageOnce=false;event('simulated_message_failure',uid);reply(res,{code:'local_network_failure',message:'Synthetic transient failure'},503);return;}
     if(!data.messages.some(m=>m.id===row.id)){data.messages.push({...row,created_at:now()});data.conversations.find(c=>c.id===row.conversation_id).updated_at=now();event('message_sent',uid);}
    }else if(table==='user_blocks'){
     const peer=profiles.find(p=>p.id===row.blocked_id);if(row.blocker_id!==uid||!peer){reply(res,{code:'42501'},403);return;}
     data.user_blocks.push({...row,blocked_name:peer.display_name,blocked_handle:peer.username});data.follows=data.follows.filter(r=>![uid,row.blocked_id].includes(r.follower_id)||![uid,row.blocked_id].includes(r.followed_id));event('block',uid);
    }else if(table==='content_reports'){data.content_reports.push({...row,id:randomUUID(),status:'pending'});event('report',uid);}
   }else if(req.method==='PATCH'){
    const rows=filter(tableRows(table,uid),url);rows.forEach(r=>Object.assign(r,row));event(`${table}_updated`,uid);
    if(table==='comments')data.notifications.filter(n=>rows.some(r=>r.id===n.comment_id)).forEach(n=>n.withdrawn_at=row.deleted_at);
   }else if(req.method==='DELETE'){
    const rows=filter(tableRows(table,uid),url);data[table]=data[table].filter(r=>!rows.includes(r));event(`${table}_removed`,uid);
   }
  }
  let rows=filter(tableRows(table,uid),url);
  if(table==='public_profiles'&&url.searchParams.has('or')){const query=url.searchParams.get('or').match(/ilike\.%([^%]+)%/)?.[1]?.replace(/\\_/g,'_').toLowerCase() || '';rows=rows.filter(p=>`${p.username} ${p.display_name}`.toLowerCase().includes(query));}
  if(['posts','stories','notifications','comments','messages'].includes(table))rows=[...rows].reverse();
  const total=rows.length;rows=rows.slice(0,Number(url.searchParams.get('limit')||total));
  const headers={'Content-Range':`0-${Math.max(0,rows.length-1)}/${total}`};
  if(req.method==='HEAD'){res.writeHead(200,headers).end();return;}
  reply(res,req.headers.accept?.includes('vnd.pgrst.object')?rows[0]||null:rows,req.method==='POST'?201:200,headers);return;
 }
 if(path.startsWith('/storage/v1/object/info/review-media/')){const key=path.slice('/storage/v1/object/info/review-media/'.length),file=files.get(key);reply(res,file?{name:key,size:file.bytes.length,content_type:file.mime}:{statusCode:'404',message:'Object not found'},file?200:404);return;}
 if(path==='/storage/v1/object/sign/review-media'){const row=await body(req);reply(res,row.paths.map(path=>({path,signedURL:`/object/sign/review-media/${path}?token=local-beta` })));return;}
 if(path.startsWith('/storage/v1/object/sign/review-media/')){
  const file=files.get(path.slice('/storage/v1/object/sign/review-media/'.length));if(!file){res.writeHead(404).end();return;}
  const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/),start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),file.bytes.length-1):file.bytes.length-1;
  res.writeHead(range?206:200,{'Content-Type':file.mime,'Content-Length':end-start+1,'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${file.bytes.length}`}:{})}).end(file.bytes.subarray(start,end+1));return;
 }
 if(path.startsWith('/storage/v1/upload/resumable')){
  if(!uid){res.writeHead(403).end();return;}res.setHeader('Tus-Resumable','1.0.0');let upload;
  if(req.method==='POST'){
   const meta=Object.fromEntries(String(req.headers['upload-metadata']).split(',').map(part=>{const [key,value]=part.trim().split(' ');return [key,Buffer.from(value,'base64').toString()];}));
   upload={id:randomUUID(),owner:uid,path:meta.objectName,mime:meta.contentType,size:Number(req.headers['upload-length']),offset:0,chunks:[]};uploads.set(upload.id,upload);
  }else upload=uploads.get(path.split('/').at(-1));
  if(!upload||upload.owner!==uid){res.writeHead(404).end();return;}
  if(req.method==='HEAD'){res.writeHead(200,{'Upload-Offset':upload.offset,'Upload-Length':upload.size}).end();return;}
  if(req.method==='PATCH'&&Number(req.headers['upload-offset'])!==upload.offset){res.writeHead(409).end();return;}
  const part=await bytes(req);upload.chunks.push(part);upload.offset+=part.length;
  if(upload.offset===upload.size){files.set(upload.path,{bytes:Buffer.concat(upload.chunks),mime:upload.mime});event('file_uploaded',uid,{size:upload.size,mime:upload.mime});}
  res.writeHead(req.method==='POST'?201:204,{'Upload-Offset':upload.offset,Location:`${api}/storage/v1/upload/resumable/${upload.id}`}).end();return;
 }
 const root=resolve(preview,String(port));let file=resolve(root,'.'+path);
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
 if(!extname(file)||path==='/')file=resolve(root,'index.html');
 const content=await readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'application/javascript','.png':'image/png','.ico':'image/x-icon'}[extname(file)]||'application/octet-stream'}).end(content);
}catch(error){console.error('Fixture error:',error.message);reply(res,{message:'Local fixture failed'},500);}}
if(process.env.BETA_ORDER_RECHECK==='1'){
 // A small second run checks chronological rendering independently of uploads.
 const chat={id:randomUUID(),user_low:profiles[0].id,user_high:profiles[1].id,updated_at:now()};data.conversations.push(chat);
 data.messages.push({id:randomUUID(),conversation_id:chat.id,sender_id:profiles[1].id,body:'Primero: ¿vamos al café?',created_at:new Date(Date.now()-20000).toISOString()});
 data.messages.push({id:randomUUID(),conversation_id:chat.id,sender_id:profiles[0].id,body:'Después: ¡sí, nos vemos!',created_at:new Date(Date.now()-10000).toISOString()});failMessageOnce=false;
}
for(const port of ports)createServer((req,res)=>handle(req,res,port)).listen(port,'127.0.0.1',()=>console.log(`Isolated beta account at http://127.0.0.1:${port}/__fixture`));
