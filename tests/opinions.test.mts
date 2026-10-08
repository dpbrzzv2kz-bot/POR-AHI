import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeOpinion,reviewFootprint,placeRatings,ratingLabel} from '../lib/opinions.ts';

test('an empty opinion has no ratio and no atmosphere',()=>{
 assert.deepEqual(summarizeOpinion(),{likes:0,tomatoes:0,total:0,positiveRatio:null,mood:'none'});
});
test('the five ratings go from 5 Imperdible to 1 Tomatazo and unknown values have no label',()=>{
 assert.deepEqual(placeRatings.map(item=>item.label),['Imperdible','Volvería','Pasa','Mejor nada','Tomatazo']);
 assert.equal(ratingLabel(5),'Imperdible');
 assert.equal(ratingLabel(1),'Tomatazo');
 for(const value of [0,6,2.5,null,undefined])assert.equal(ratingLabel(value),null);
});
test('atmosphere requires participation and a clear majority, never a tie',()=>{
 assert.equal(summarizeOpinion(7,0).mood,'none');
 assert.equal(summarizeOpinion(6,2).mood,'confetti');
 assert.equal(summarizeOpinion(2,6).mood,'splash');
 assert.equal(summarizeOpinion(5,3).mood,'none');
 assert.equal(summarizeOpinion(40,40).mood,'none');
});
test('invalid counters never invent votes or a negative bar width',()=>{
 for(const value of [-1,NaN,Infinity,'20',null,undefined])assert.equal(summarizeOpinion(value,0).total,0);
 assert.equal(summarizeOpinion(3.9,2.8).total,5);
 const huge=summarizeOpinion(Number.MAX_VALUE,Number.MAX_VALUE);
 assert.ok(Number.isSafeInteger(huge.total));
 assert.equal(huge.positiveRatio,.5);
});
test('a footprint requires a real date and only a known zero edit version proves it is intact',()=>{
 assert.equal(reviewFootprint(),null);
 assert.equal(reviewFootprint('not-a-date',0),null);
 const original=reviewFootprint('2026-10-03T12:00:00Z',0)!;
 assert.equal(original.intact,true);
 assert.match(original.label,/Reseña original, intacta desde/);
 for(const version of [undefined,1,2,-1]){
  const footprint=reviewFootprint('2026-10-03T12:00:00Z',version)!;
  assert.equal(footprint.intact,false);
  assert.match(footprint.label,/^Publicada el/);
 }
});
