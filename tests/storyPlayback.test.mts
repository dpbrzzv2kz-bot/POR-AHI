import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Execute the real component effects without loading native modules or starting Expo.
// This is a focused lifecycle harness, not a replacement for testing on an iPhone.
type Element={type:unknown;props:Record<string,any>;children:any[]};
const element=(type:unknown,props:Record<string,any>|null,...children:any[]):Element=>({type,props:props??{},children:children.flat(Infinity)});
const equalDeps=(a:unknown[]|undefined,b:unknown[]|undefined)=>!!a&&!!b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
class Hooks {
 cells:any[]=[];cursor=0;pending:(()=>void)[]=[];
 useRef=(value:unknown)=>{const i=this.cursor++;return this.cells[i]??(this.cells[i]={current:value});};
 useState=(initial:any)=>{const i=this.cursor++;if(!(i in this.cells))this.cells[i]=typeof initial==='function'?initial():initial;return [this.cells[i],(value:any)=>{this.cells[i]=typeof value==='function'?value(this.cells[i]):value;}];};
 useCallback=(fn:Function,deps:unknown[])=>{const i=this.cursor++,old=this.cells[i];if(!old||!equalDeps(old.deps,deps))this.cells[i]={fn,deps};return this.cells[i].fn;};
 useEffect=(effect:()=>void|(()=>void),deps?:unknown[])=>{
  const i=this.cursor++,old=this.cells[i];if(old&&equalDeps(old.deps,deps))return;
  this.pending.push(()=>{old?.cleanup?.();this.cells[i]={deps,cleanup:effect()};});
 };
 react(){const api={createElement:element,useRef:this.useRef,useState:this.useState,useEffect:this.useEffect,useCallback:this.useCallback};return {__esModule:true,default:api,...api};}
 render(component:Function,props:Record<string,any>){this.cursor=0;const tree=component(props);for(const effect of this.pending.splice(0))effect();return tree;}
 dispose(){for(const cell of this.cells)cell?.cleanup?.();this.cells=[];}
}
class Value {
 value:number;listeners=new Map<string,Function>();sequence=0;
 constructor(value:number){this.value=value;}
 setValue(value:number){this.value=value;for(const fn of this.listeners.values())fn({value});}
 addListener(fn:Function){const id=String(++this.sequence);this.listeners.set(id,fn);return id;}
 removeListener(id:string){this.listeners.delete(id);}
 interpolate(){return {read:()=>this.value};}
}
class Player {
 currentTime=0;duration=0;timeUpdateEventInterval=0;loop=false;playing=false;
 listeners=new Map<string,Set<Function>>();history=new Map<string,Function[]>();
 play(){this.playing=true;}pause(){this.playing=false;}
 addListener(event:string,fn:Function){if(!this.listeners.has(event))this.listeners.set(event,new Set());this.listeners.get(event)!.add(fn);this.history.set(event,[...(this.history.get(event)??[]),fn]);return {remove:()=>this.listeners.get(event)?.delete(fn)};}
 emit(event:string,payload?:unknown){for(const fn of this.listeners.get(event)??[])fn(payload);}
 load(duration:number){this.duration=duration;this.emit('sourceLoad',{duration});}
 advance(time:number){if(!this.playing)return;this.currentTime=time;this.emit('timeUpdate',{currentTime:time});}
 count(){return [...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
const native={View:'View',Text:'Text',Image:'Image',Pressable:'Pressable',Platform:{OS:'ios'},Easing:{linear:(v:number)=>v},StyleSheet:{create:(styles:unknown)=>styles,absoluteFill:{position:'absolute'}}};
function load(source:string,host:Hooks,modules:Record<string,unknown>){
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 const exports:Record<string,any>={};runInNewContext(code,{exports,require:(name:string)=>{if(name==='react')return host.react();assert.ok(name in modules,'Unexpected native dependency: '+name);return modules[name];},setTimeout,clearTimeout});return exports;
}
const appFile=new URL('../App.tsx',import.meta.url),viewerFile=new URL('../components/StoryViewer.tsx',import.meta.url);
const appSource=ts.createSourceFile('App.tsx',readFileSync(appFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const videoNode=appSource.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='Video');
assert.ok(videoNode,'The Video component must exist in App.tsx');
const videoSource="import React from 'react';import {StyleSheet} from 'react-native';import {VideoView,useVideoPlayer} from 'expo-video';"+videoNode.getText(appSource)+';exports.Video=Video;';
const viewerSource=readFileSync(viewerFile,'utf8');
function find(tree:Element,type:unknown):Element[]{return [tree,...tree.children.filter(child=>child&&typeof child==='object'&&'children' in child).flatMap(child=>find(child,type))].filter(node=>node.type===type);}
function fixture(id='video-1',index=0){
 const viewerHost=new Hooks(),videoHost=new Hooks(),player=new Player();let progress:Function=()=>{},paused=false,tree:Element;let next=0;
 const animations:{value:Value;duration:number;callback?:Function;stopped:boolean}[]=[];
 const animated={Value,View:'Animated.View',timing:(value:Value,options:{duration:number})=>{const animation={value,duration:options.duration,callback:undefined as Function|undefined,stopped:false};animations.push(animation);return {start:(fn:Function)=>{animation.callback=fn;},stop:()=>{animation.stopped=true;animation.callback?.({finished:false});}};}};
 const Viewer=load(viewerSource,viewerHost,{'react-native':{...native,Animated:animated},'expo-status-bar':{StatusBar:'StatusBar'},'../lib/theme':{palette:{}},'./Icon':{default:'Icon'}}).default;
 const Video=load(videoSource,videoHost,{'react-native':native,'expo-video':{VideoView:'VideoView',useVideoPlayer:(_uri:string,setup:Function)=>videoHost.useState(()=>{setup(player);return player;})[0]}}).Video;
 const props={story:{id,name:'Synthetic Person',expires:Date.now()+86400000},own:false,index,total:3,close:()=>{},remove:()=>{},report:()=>{},onNext:()=>{next++;},media:(fn:Function,isPaused:boolean)=>{progress=fn;paused=isPaused;return element('VideoView',{});}};
 const render=(changes:Record<string,any>={})=>{Object.assign(props,changes);tree=viewerHost.render(Viewer,props);videoHost.render(Video,{uri:id,autoPlay:true,controls:false,paused,onProgress:progress,onEnd:props.onNext});};
 render();
 return {player,animations,render,viewerHost,videoHost,
  ratio:()=>find(tree,'Animated.View')[0].props.style[1].width.read(),
  previous:()=>find(tree,'View').filter(node=>Array.isArray(node.props.style)&&node.props.style[1]?.width==='100%').length,
  menu:()=>{find(tree,'Pressable').find(node=>node.props.accessibilityLabel==='Más opciones de la story')!.props.onPress();render();},
  next:()=>next,dispose:()=>{videoHost.dispose();viewerHost.dispose();}};
}

test('video stories start empty and follow playback time, including loading and invalid durations',()=>{
 const f=fixture();try{
  assert.equal(f.ratio(),0);assert.equal(f.animations.length,0);
  f.player.advance(3);assert.equal(f.ratio(),0,'Unknown duration must not fill the bar');
  f.player.load(12);assert.equal(f.ratio(),0.25,'Loading metadata reports the existing playback time');
  f.player.advance(6);assert.equal(f.ratio(),0.5);
  f.player.advance(30);assert.equal(f.ratio(),1,'The bar never exceeds its segment');
  f.player.load(Number.NaN);assert.equal(f.ratio(),0);
  f.player.load(0);assert.equal(f.ratio(),0);
 }finally{f.dispose();}
});

test('moving to a second video resets its bar and disconnects the previous player',()=>{
 const first=fixture();first.player.load(10);first.player.advance(8);assert.equal(first.ratio(),0.8);
 const lateTick=first.player.history.get('timeUpdate')![0],lateLoad=first.player.history.get('sourceLoad')![0];
 first.dispose();assert.equal(first.player.count(),0);
 const second=fixture('video-2',1);try{
  assert.equal(second.previous(),1);assert.equal(second.ratio(),0);
  lateTick({currentTime:10});lateLoad({duration:10});assert.equal(first.ratio(),0.8,'Queued callbacks cannot update an unmounted bar');assert.equal(second.ratio(),0);
  second.player.load(20);second.player.advance(5);assert.equal(second.ratio(),0.25);
  second.player.emit('playToEnd');assert.equal(second.next(),1);
 }finally{second.dispose();}
 const returned=fixture();try{assert.equal(returned.ratio(),0);assert.equal(returned.player.currentTime,0);}finally{returned.dispose();}
});

test('holding or opening the story menu pauses both playback and its progress',()=>{
 const f=fixture();try{
  f.player.load(20);f.player.advance(5);assert.equal(f.ratio(),0.25);
  f.render({paused:true});assert.equal(f.player.playing,false);f.player.advance(10);assert.equal(f.ratio(),0.25);
  f.render({paused:false});assert.equal(f.player.playing,true);f.player.advance(10);assert.equal(f.ratio(),0.5);
  f.menu();assert.equal(f.player.playing,false);f.player.advance(15);assert.equal(f.ratio(),0.5);
  f.menu();assert.equal(f.player.playing,true);f.player.advance(15);assert.equal(f.ratio(),0.75);
  assert.equal(f.player.count(),3,'Renders do not accumulate subscriptions');
 }finally{f.dispose();}
});

test('photo timing still pauses and resumes, then the following video starts empty',()=>{
 const photo=fixture('photo-1');try{
  photo.render({autoAdvanceMs:5000});assert.equal(photo.animations[0].duration,5000);
  photo.animations[0].value.setValue(0.75);photo.render({paused:true});
  assert.equal(photo.animations[0].stopped,true);assert.equal(photo.next(),0);
  photo.render({paused:false});assert.equal(photo.animations[1].duration,1250);
  photo.animations[1].callback!({finished:true});assert.equal(photo.next(),1);
 }finally{photo.dispose();}
 const video=fixture('video-after-photo',1);try{
  assert.equal(video.previous(),1);assert.equal(video.ratio(),0);assert.equal(video.animations.length,0);
  video.player.load(8);video.player.advance(2);assert.equal(video.ratio(),0.25);
 }finally{video.dispose();}
});
