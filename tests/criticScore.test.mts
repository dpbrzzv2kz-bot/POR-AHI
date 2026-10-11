import {test} from 'node:test';
import assert from 'node:assert/strict';
import {criticProfile,criticLevels,wilsonLowerBound,MIN_REACTIONS} from '../lib/criticScore.ts';

test('below the minimum there is no measured level, only progress and what is missing',()=>{
 const none=criticProfile(0,0);
 assert.equal(none.measured,false);assert.equal(none.level.key,'nuevo');assert.equal(none.progress,0);assert.match(none.hint,/Te faltan 20 reacciones/);
 const almost=criticProfile(19,0);
 assert.equal(almost.level.key,'nuevo');assert.match(almost.hint,/Te faltan 1 reacción para/);
 assert.equal(criticProfile(10,5).progress,.75);
});
test('a perfect streak of a few votes never outranks a large agreed record',()=>{
 assert.ok(wilsonLowerBound(3,3)<wilsonLowerBound(80,100));
 assert.ok(wilsonLowerBound(20,20)<.9);
 assert.equal(wilsonLowerBound(0,0),0);
 assert.ok(wilsonLowerBound(0,50)<=.01);
});
test('levels need both agreement and enough reactions',()=>{
 assert.equal(criticProfile(20,0).level.key,'consistente');
 assert.equal(criticProfile(8,12).level.key,'desarrollo');
 assert.equal(criticProfile(38,2).level.key,'confiable');assert.equal(criticProfile(19,1).level.key,'consistente');
 assert.equal(criticProfile(60,0).level.key,'confiable');
 assert.equal(criticProfile(100,0).level.key,'referencia');
 assert.equal(criticProfile(98,2).level.key,'referencia');
 assert.equal(criticProfile(60,40).level.key,'consistente');
});
test('rank follows the level list and the best level has no next step',()=>{
 for(const [likes,tomatoes] of [[0,0],[5,15],[20,0],[60,0],[200,0]]){
  const profile=criticProfile(likes,tomatoes);
  assert.equal(criticLevels[profile.rank-1].key,profile.level.key);
 }
 const top=criticProfile(300,0);
 assert.equal(top.next,null);assert.equal(top.progress,1);
});
test('tomatoes alone are not a verdict: disagreement lowers the level but never below the measured floor',()=>{
 const harsh=criticProfile(2,40);
 assert.equal(harsh.measured,true);assert.equal(harsh.level.key,'desarrollo');
 assert.match(harsh.hint,/coincida contigo/);
});
test('invalid counters never invent reactions',()=>{
 for(const value of [-3,NaN,Infinity,'20',null,undefined])assert.equal(criticProfile(value,0).total,0);
 assert.equal(criticProfile(10.9,9.9).total,19);
 assert.ok(MIN_REACTIONS>0);
});
