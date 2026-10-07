const {test}=require('node:test'),assert=require('node:assert/strict');
const study=require('../public/assets/study-core');
const result=(word,definition,extra={})=>({word,entries:[{source:'Test dictionary',meanings:[{pos:'noun',senses:[{definition,...extra}]}]}]});
const card=(word,definition,extra)=>study.card(result(word,definition,extra),null,1000);
test('learning stores distinct senses and represents every part of speech',()=>{
  const data={word:'draft',entries:[{source:'WordNet',meanings:[{pos:'noun',senses:Array.from({length:30},(_,i)=>({definition:`Noun meaning ${i}`}))},{pos:'verb',senses:[{definition:'write a preliminary version'}]},{pos:'adjective',senses:[{definition:'preliminary'}]}]}]};
  const value=study.card(data,null,1000);assert.equal(value.senses.length,16);assert.deepEqual(value.senses.slice(0,3).map(s=>s.pos),['noun','verb','adjective']);
  assert.equal(value.dueAt,1000);assert.equal(value.reviews,0);
});
test('spaced repetition starts at one day, then three days, and grows with success',()=>{
  let value=card('loan','money borrowed');value=study.grade(value,'good',10000);assert.equal(value.interval,1);assert.equal(value.dueAt,10000+study.DAY);
  value=study.grade(value,'good',value.dueAt);assert.equal(value.interval,3);
  value=study.grade(value,'good',value.dueAt);assert.equal(value.interval,8);assert.equal(value.reviews,3);
  for(let i=0;i<25;i++)value=study.grade(value,'good',value.dueAt);assert.equal(value.interval,365);
});
test('forgotten words return in ten minutes, hard words advance cautiously, refreshed definitions keep progress',()=>{
  let value=study.grade(card('loan','borrowed money'),'good',10000);value=study.grade(value,'again',20000);
  assert.equal(value.dueAt,620000);assert.equal(value.interval,0);assert.equal(value.lapses,1);
  const refreshed=study.card(result('loan','money lent to someone'),value,25000);assert.equal(refreshed.dueAt,value.dueAt);assert.equal(refreshed.reviews,2);assert.equal(refreshed.senses[0].definition,'money lent to someone');
  const hard=study.grade(refreshed,'hard',30000);assert.equal(hard.interval,1);assert.equal(hard.dueAt,30000+study.DAY);
  assert.equal(study.due([hard],hard.dueAt-1).length,0);assert.equal(study.due([hard],hard.dueAt).length,1);
  assert.throws(()=>study.grade(hard,'wrong'),/Invalid/);
});
test('storage survives reload and rejects malformed schedules, empty definitions and duplicate words',()=>{
  const values={},storage={getItem:key=>values[key],setItem:(key,value)=>values[key]=value};
  const value=study.grade(card('loan','borrowed money'),'good',10000);assert.equal(study.write(storage,[value]),true);
  const reloaded=study.read(storage);assert.equal(reloaded[0].dueAt,value.dueAt);assert.equal(reloaded[0].reviews,1);assert.equal(reloaded[0].senses[0].source,'Test dictionary');
  values[study.KEY]=JSON.stringify({version:1,cards:[{...value,dueAt:-5,ease:1000},value,{word:'bad',senses:[]}]});
  const checked=study.read(storage);assert.equal(checked.length,1);assert.equal(checked[0].ease,2.5);assert.ok(checked[0].dueAt>=0);
  values[study.KEY]='bad json';assert.deepEqual(study.read(storage),[]);assert.equal(study.write({setItem(){throw Error('quota');}},[value]),false);
});
test('quiz excludes known synonymous and overlapping distractors and falls back to typed answers',()=>{
  const brother=card('brother','a male sibling',{synonyms:['blood brother']}),same=card('sibling','a male sibling'),synonym=card('blood brother','a male person related by family',{synonyms:['brother']}),loan=card('loan','borrowed money'),tree=card('tree','a woody plant');
  const q=study.question(brother,[brother,same,synonym,loan,tree],0,()=>.4);
  assert.equal(q.type,'choice');assert.deepEqual([...q.choices].sort(),['brother','loan','tree']);assert.ok(!q.choices.includes('sibling'));assert.ok(!q.choices.includes('blood brother'));
  assert.equal(study.question(brother,[brother,synonym],0).type,'type');
});
test('cloze replaces only exact words and phrases, masks repeated occurrences, and does not guess inflections',()=>{
  assert.equal(study.cloze('act','An actor acts actively.'),null);
  assert.equal(study.cloze('loan','The loan is a bank loan.'),'The ____ is a bank ____.');
  assert.equal(study.cloze('name after','They NAME   AFTER their grandfather.'),'They ____ their grandfather.');
  const value=card('loan','money borrowed',{example:'The bank approved a loan.'});const q=study.question(value,[value],1);
  assert.equal(q.type,'cloze');assert.equal(q.prompt,'The bank approved a ____.');assert.equal(q.original,'The bank approved a loan.');
  assert.equal(study.question(card('loan','a loan is money borrowed'),[],0),null);
});
test('preparing an entire saved deck stays small and never requires an API',()=>{
  const deck=Array.from({length:100},(_,i)=>card(`word${i}`,`Definition ${i}`));const start=performance.now();
  for(const value of deck){const question=study.question(value,deck,0);assert.ok(question);assert.ok(question.choices.includes(value.word));}
  assert.ok(performance.now()-start<1000);assert.ok(JSON.stringify(deck).length<500000);
});
