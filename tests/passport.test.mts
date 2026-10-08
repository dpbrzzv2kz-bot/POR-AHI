import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {passportRanks,passportProgress,uniquePassportStamps,isMapPng,type PassportStamp} from '../lib/passport.ts';
import {parseStatesMapMessage,parseStatesMapExport} from '../components/statesMapTypes.ts';
import {regionsMapHtml} from '../lib/regionsMapHtml.ts';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHf8AAAAASUVORK5CYII=';
const region=(id:string,name:string,country:string,x:number)=>({i:id,n:name,a:country,b:[x,0,x+2,2],p:[[[x,0,x+2,0,x+2,2,x,2]]]});
function mapFixture(owner={name:'Ana',handle:'ana',rank:'Primer paso'}){
 const messages:string[]=[],drawn:string[]=[],listeners:Record<string,(event:unknown)=>void>={};
 const ctx={setTransform(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},drawImage(){},measureText:()=>({width:220}),fillText(text:string){drawn.push(text);}};
 const canvas=()=>({style:{},getContext:()=>ctx,toDataURL:()=>png});
 const win={devicePixelRatio:2,parent:{postMessage:(raw:string)=>messages.push(raw)},addEventListener:(type:string,listener:(event:unknown)=>void)=>{listeners[type]=listener;}};
 const html=regionsMapHtml(JSON.stringify([region('A','Centro','Mexico',0),region('B','Centro','España',10)]),[{lat:1,lng:1},{lat:1,lng:1},{lat:1,lng:11}],false,owner);
 const context={window:win,document:{getElementById:canvas,createElement:canvas,documentElement:{clientWidth:360}}};
 runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1],context);
 return {messages,drawn,listeners,win,html};
}

test('exactly ten ranks unlock at their state threshold; duplicates cannot supply extra states',()=>{
 assert.equal(passportRanks.length,10);
 for(let i=0;i<passportRanks.length;i++){
  assert.equal(passportProgress(passportRanks[i].min).level,i+1);
  if(i)assert.equal(passportProgress(passportRanks[i].min-1).level,i);
 }
 assert.equal(passportProgress(5).current.name,'Mochilero');
 assert.equal(passportProgress(15).current.name,'Trotamundos');
 assert.equal(passportProgress(4).remaining,1);
 assert.equal(passportProgress(4).next?.name,'Mochilero');
 assert.equal(passportProgress(10000).next,null);
 for(const count of [-5,NaN,Infinity])assert.equal(passportProgress(count).count,0);
});

test('passport deduplicates region IDs and retains same names across countries',()=>{
 const a={id:'MX-A',name:'Centro',country:'Mexico'},b={id:'ES-B',name:'Centro',country:'Spain'};
 assert.deepEqual(uniquePassportStamps([a,a,b]),[a,b]);
 assert.deepEqual(uniquePassportStamps([{id:'',name:'Inventado',country:'Mexico'}] as PassportStamp[]),[]);
});

test('map bridge supplies real distinct stamps and rejects inconsistent or forged counts',()=>{
 const fixture=mapFixture(),result=parseStatesMapMessage(fixture.messages[0]);
 assert.equal(result?.count,2);assert.equal(result?.regions.length,2);assert.deepEqual(result?.regions.map(r=>r.id),['A','B']);
 for(const invalid of [{...result,type:'other'},{...result,type:'porahi-map-result',count:3},{...result,type:'porahi-map-result',total:-1},{...result,type:'porahi-map-result',regions:[result!.regions[0],result!.regions[0]]}])assert.equal(parseStatesMapMessage(JSON.stringify(invalid)),null);
});

test('export is explicit, branded and request-scoped; unrelated frames cannot trigger it',()=>{
 const fixture=mapFixture();assert.equal(fixture.messages.length,1);
 fixture.listeners.message({source:{},data:{type:'porahi-map-export-request',request:8}});assert.equal(fixture.messages.length,1);
 fixture.listeners.message({source:fixture.win.parent,data:{type:'porahi-map-export-request',request:8}});
 const result=parseStatesMapExport(fixture.messages[1]);assert.equal(result?.request,8);assert.equal(result?.png,png);
 assert.ok(fixture.drawn.includes('por ahí'));assert.ok(fixture.drawn.includes('Ana'));assert.ok(fixture.drawn.includes('Primer paso'));assert.ok(fixture.drawn.includes('2'));
 assert.equal(parseStatesMapExport(JSON.stringify({type:'porahi-map-export',request:-1,png})),null);
 assert.equal(isMapPng('data:image/svg+xml;base64,PHN2Zz4='),false);
});

test('profile names cannot escape the offline map script',()=>{
 const name='</script><script>throw "injection"</script>',fixture=mapFixture({name,handle:'ana',rank:'De estreno'});
 assert.equal((fixture.html.match(/<script>/g)||[]).length,1);
 fixture.listeners.message({source:fixture.win.parent,data:{type:'porahi-map-export-request',request:9}});
 assert.ok(fixture.drawn.includes(name));
});
