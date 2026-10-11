import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeOverlays,simplifyStroke,countdownText,OVERLAY_LIMIT,STROKE_LIMIT,STROKE_POINT_LIMIT,overlayColors,sizeRange,rotationOf} from '../lib/storyOverlays.ts';

const base={id:'a',type:'text',text:'Hola',x:.5,y:.5,size:.07,rot:0,color:'#FFFFFF'};
const text={...base,font:'clasica',align:'center',bg:'none'};

test('a valid text keeps its fields, gets safe defaults and non-lists give an empty list',()=>{
 assert.deepEqual(sanitizeOverlays([base]),[text]);
 for(const value of [null,undefined,'x',{},42])assert.deepEqual(sanitizeOverlays(value),[]);
 const [styled]=sanitizeOverlays([{...base,font:'serif',align:'left',bg:'solid'}]);
 assert.equal(styled.font,'serif');assert.equal(styled.align,'left');assert.equal(styled.bg,'solid');
 const [bad]=sanitizeOverlays([{...base,font:'comic',align:'diagonal',bg:'neon'}]);
 assert.equal(bad.font,'clasica');assert.equal(bad.align,'center');assert.equal(bad.bg,'none');
});
test('invalid items and unknown types are dropped instead of drawn',()=>{
 const bad=[null,'x',{...base,type:'image'},{...base,type:'script'},{...base,text:''},{...base,text:'   '},{...base,x:'1'},{...base,y:NaN},{...base,size:Infinity},{...base,text:5}];
 assert.deepEqual(sanitizeOverlays(bad),[]);
});
test('positions, sizes, rotation and colors are clamped to safe values',()=>{
 const [item]=sanitizeOverlays([{...base,x:-3,y:9,size:5,rot:725,color:'javascript:alert(1)'}]);
 assert.equal(item.x,0);assert.equal(item.y,1);assert.equal(item.size,sizeRange('text').max);assert.equal(item.color,'#FFFFFF');assert.equal(item.rot,5);
 assert.equal(sanitizeOverlays([{...base,size:0}])[0].size,sizeRange('text').min);
 assert.equal(sanitizeOverlays([{...base,color:'#d4ff38'}])[0].color,'#D4FF38');
 assert.ok(overlayColors.includes('#D4FF38'));
 assert.equal(rotationOf(190),-170);assert.equal(rotationOf(-181),179);
});
test('text length, list size and per-type limits hold, counting emoji as one character',()=>{
 assert.equal(sanitizeOverlays([{...base,text:'a'.repeat(500)}])[0].text.length,120);
 assert.equal([...sanitizeOverlays([{...base,type:'emoji',size:.2,text:'😍'.repeat(20)}])[0].text].length,8);
 assert.equal(sanitizeOverlays(Array.from({length:80},(_,i)=>({...base,id:'i'+i}))).length,OVERLAY_LIMIT);
});
test('a missing or oversized id is replaced by a safe one',()=>{
 assert.equal(sanitizeOverlays([{...base,id:undefined}])[0].id,'0');
 assert.equal(sanitizeOverlays([{...base,id:'x'.repeat(100)}])[0].id,'0');
});
test('polls need a question and exactly two answers; questions need a prompt',()=>{
 const poll={...base,type:'poll',size:.055,text:'¿Tacos?',options:['Sí','No']};
 assert.deepEqual(sanitizeOverlays([poll])[0].options,['Sí','No']);
 for(const options of [undefined,['Sí'],['Sí',''],['',''],[1,2],'Sí,No'])assert.deepEqual(sanitizeOverlays([{...poll,options}]),[]);
 assert.equal(sanitizeOverlays([{...poll,options:['a','b','c']}])[0].options?.length,2);
 assert.equal(sanitizeOverlays([{...base,type:'question',size:.055,text:'Pregúntame'}])[0].type,'question');
 assert.deepEqual(sanitizeOverlays([{...base,type:'question',size:.055,text:''}]),[]);
});
test('countdowns need a real date, mentions keep only a valid user id',()=>{
 const countdown={...base,type:'countdown',size:.055,text:'',endsAt:'2026-12-25T00:00:00Z'};
 assert.equal(sanitizeOverlays([countdown])[0].endsAt,'2026-12-25T00:00:00.000Z');
 assert.deepEqual(sanitizeOverlays([{...countdown,endsAt:'mañana'}]),[]);
 assert.deepEqual(sanitizeOverlays([{...countdown,endsAt:5}]),[]);
 const id='123e4567-e89b-12d3-a456-426614174000';
 assert.equal(sanitizeOverlays([{...base,type:'mention',size:.055,text:'@ana',userId:id.toUpperCase()}])[0].userId,id);
 assert.equal(sanitizeOverlays([{...base,type:'mention',size:.055,text:'@ana',userId:'<script>'}])[0].userId,undefined);
});
test('countdown text shows days, hours or minutes and never negative time',()=>{
 const now=Date.parse('2026-10-10T12:00:00Z');
 assert.equal(countdownText('2026-10-12T15:00:00Z',now),'2 d 3 h');
 assert.equal(countdownText('2026-10-10T14:30:00Z',now),'2 h 30 min');
 assert.equal(countdownText('2026-10-10T12:20:00Z',now),'20 min');
 assert.equal(countdownText('2026-10-10T11:00:00Z',now),'Ya llegó');
 assert.equal(countdownText(undefined,now),'');
});
test('drawings keep valid points, round them, drop near-duplicates and cap their length and count',()=>{
 const stroke={id:'d',type:'draw',color:'#ff4d6d',width:.5,points:[0,0,.1,.1,.1,.1001,1.5,-2]};
 const [item]=sanitizeOverlays([stroke]);
 assert.deepEqual(item.points,[0,0,.1,.1,1,0]);assert.equal(item.width,.06);assert.equal(item.color,'#FF4D6D');
 for(const points of [[0,0],[0,0,.1],[0,0,'a',1],'x',undefined])assert.deepEqual(sanitizeOverlays([{...stroke,points}]),[]);
 const long=Array.from({length:400},(_,i)=>[i/400,.5]).flat();
 assert.equal(simplifyStroke(long).length/2,STROKE_POINT_LIMIT);
 assert.equal(sanitizeOverlays(Array.from({length:100},(_,i)=>({...stroke,id:'s'+i}))).length,STROKE_LIMIT);
});
test('only one filter is kept and only from the known list',()=>{
 const filter={id:'f',type:'filter',name:'mono'};
 assert.equal(sanitizeOverlays([filter,{...filter,id:'g',name:'warm'}]).length,1);
 assert.deepEqual(sanitizeOverlays([{...filter,name:'javascript'}]),[]);
 assert.equal(sanitizeOverlays([filter])[0].name,'mono');
});
