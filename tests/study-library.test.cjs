const {test}=require('node:test'),assert=require('node:assert/strict');
const lib=require('../public/assets/study-library'),core=require('../public/assets/study-core');
test('sets group words independently, reject duplicate names and leave existing favorites and schedules untouched',()=>{
  let state=lib.empty();state=lib.setDeck(state,{id:'a',name:'  IELTS   Reading ',selected:['Loan','loan',' name after ']});state=lib.setDeck(state,{id:'b',name:'Work',selected:['loan','bank']});
  assert.deepEqual(state.decks[0],{id:'a',name:'IELTS Reading',words:['loan','name after']});assert.ok(state.decks.every(d=>d.words.includes('loan')));
  assert.throws(()=>lib.setDeck(state,{id:'c',name:'ielts reading'}),/đã có/);assert.throws(()=>lib.setDeck(state,{id:'c',name:'x'.repeat(51)}),/50/);
  const empty=lib.setDeck(state,{id:'a',name:'Reading',selected:[]});assert.equal(empty.decks.length,2);assert.deepEqual(empty.decks[0].words,[]);
  for(let i=2;i<20;i++)state=lib.setDeck(state,{id:`set${i}`,name:`Set ${i}`});assert.throws(()=>lib.setDeck(state,{id:'last',name:'One more'}),/20/);
});
test('reload preserves completed and partial-session attempts while malformed records and oversized data are bounded',()=>{
  const values={'helen-favorites':'["loan"]',[core.KEY]:'old-review-progress'},storage={getItem:k=>values[k],setItem:(k,v)=>values[k]=v};
  let state=lib.setDeck(lib.empty(),{id:'a',name:'Reading',selected:['loan']});state=lib.attempt(state,{word:'Loan',correct:false,mode:'matching'},100);assert.equal(lib.write(storage,state),true);
  const reloaded=lib.read(storage);assert.equal(reloaded.attempts.length,1);assert.equal(reloaded.sessions.length,0);assert.equal(values[core.KEY],'old-review-progress');assert.equal(values['helen-favorites'],'["loan"]');
  state=lib.completed(reloaded,{mode:'matching',total:3,correct:2},200);assert.equal(lib.read({getItem:()=>JSON.stringify(state)}).sessions[0].correct,2);
  const oversized=lib.sanitize({...state,attempts:Array.from({length:900},(_,i)=>({word:'loan',correct:true,mode:'type',at:i})),sessions:Array(200).fill({mode:'review',at:1,total:6,correct:999}),difficult:['loan','Loan','',null]});assert.equal(oversized.attempts.length,500);assert.equal(oversized.sessions.length,100);assert.equal(oversized.sessions[0].correct,6);assert.deepEqual(oversized.difficult,['loan']);
  assert.deepEqual(lib.read({getItem:()=>'{bad'}),lib.empty());assert.equal(lib.write({setItem(){throw Error('full');}},state),false);
});
test('progress uses current favorite words, distinguishes attempts from review and does not change the schedule',()=>{
  let state=lib.empty();for(const [word,correct] of [['loan',false],['loan',true],['tree',true],['deleted',false]])state=lib.attempt(state,{word,correct,mode:'type'},100);
  state.difficult=['tree'];const cards=[{word:'loan',dueAt:1000,reviews:4},{word:'tree',dueAt:500,reviews:0}],before=JSON.stringify(cards),stats=lib.statistics(state,cards,['loan','tree'],600);
  assert.equal(stats.answered,3);assert.equal(stats.accuracy,67);assert.equal(stats.reviewed,1);assert.equal(stats.due,1);assert.deepEqual(stats.difficult,[{word:'loan',wrong:1},{word:'tree',wrong:0}]);assert.equal(JSON.stringify(cards),before);
});
test('starter sets resolve licensed existing dictionary records and produce immediate review and quiz data',()=>{
  const pack=require('../public/assets/offline-basics.json'),templates=require('../public/assets/study-starters.json');
  for(const template of templates.decks){const deck=template.words.map(word=>core.card(pack.entries.find(item=>item.word===word)?.result));assert.ok(deck.every(Boolean));assert.ok(core.quizPlan(deck).length>=3);assert.ok(core.matchingPlan(deck).length>=3);}
});
