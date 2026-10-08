import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationText,type Notification} from '../lib/notifications.ts';
const notification=(kind:Notification['kind'],name='Ana'):Notification=>({id:'notice',actor_id:'real-user',actor_name:name,kind,post_id:'real-post',created_at:'2026-10-10T12:00:00Z',read_at:null});
test('notifications preserve the real actor and do not invent a restaurant name or visit',()=>{
 assert.equal(notificationText(notification('like')),'A Ana le gustó tu reseña. Ya te ganaste un lugar en su corazón.');
 assert.equal(notificationText(notification('follow','  Luis  ')),'Luis ya anda por aquí contigo. ¡Qué buena compañía!');
 assert.equal(notificationText(notification('comment','Mar')),'Mar comentó tu reseña. La plática ya se puso buena.');
 for(const kind of ['like','comment','follow'] as const)assert.doesNotMatch(notificationText(notification(kind)),/taquería|visitó|restaurante/);
});
test('a missing display name gets neutral copy instead of an invented person',()=>{
 assert.match(notificationText(notification('like','  ')),/Alguien/);assert.doesNotMatch(notificationText(notification('comment','')),/Ana|Luis|Mar /);
});
