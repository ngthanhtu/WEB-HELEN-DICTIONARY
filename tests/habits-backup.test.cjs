const {test}=require('node:test'),assert=require('node:assert/strict'),habits=require('../public/assets/habit-core'),backup=require('../public/assets/backup-core'),study=require('../public/assets/study-core'),library=require('../public/assets/study-library');
function storage(){const map=new Map();return {getItem:key=>map.get(key) ?? null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
const day=value=>new Date(`${value}T12:00:00`);
test('daily goals preserve past achievements and streak grace until the next day',()=>{
  let state=habits.empty();for(const date of ['2026-10-07','2026-10-08'])for(let i=0;i<5;i++)state=habits.record(state,day(date));
  assert.equal(habits.progress(state,day('2026-10-09')).streak,2);assert.equal(habits.progress(state,day('2026-10-10')).streak,0);
  state=habits.record(state,day('2026-10-09'));state=habits.setGoal(state,20);assert.equal(habits.progress(state,day('2026-10-09')).goal,5);
  for(let i=0;i<4;i++)state=habits.record(state,day('2026-10-09'));assert.equal(habits.progress(state,day('2026-10-09')).streak,3);assert.equal(habits.progress(state,day('2026-10-10')).goal,20);
});
test('calendar arithmetic crosses year/month and daylight-saving boundaries',()=>{
  assert.equal(habits.previous('2026-01-01'),'2025-12-31');assert.equal(habits.previous('2024-03-01'),'2024-02-29');assert.equal(habits.previous('2026-03-09'),'2026-03-08');
  assert.deepEqual(habits.sanitize({version:1,days:{'2026-02-31':{count:5,goal:5}},goal:-1}),habits.empty());
});
test('backups preserve study schedule, merge sets and exclude device credentials',()=>{
  const current=storage(),incoming=storage(),card=study.card({word:'loan',entries:[{source:'Princeton WordNet',meanings:[{pos:'noun',senses:[{definition:'borrowed money',example:'She took a loan.'}]}]}]},null,100);
  for(const target of [current,incoming]){target.setItem('helen-favorites','["loan"]');study.write(target,[card]);library.write(target,library.setDeck(library.empty(),{id:'reading',name:'Reading',selected:['loan']}));}
  const reviewed=study.grade(card,'good',2000);study.write(current,[reviewed]);incoming.setItem('helen-history-device','private-token');incoming.setItem('ELEVENLABS_API_KEY','test-only');
  const exported=backup.snapshot(incoming);assert.doesNotMatch(JSON.stringify(exported),/private-token|ELEVENLABS/);
  backup.restore(current,backup.parse(JSON.stringify(exported)));assert.equal(study.read(current)[0].dueAt,reviewed.dueAt);assert.equal(study.read(current)[0].reviews,1);assert.equal(library.read(current).decks.length,1);
  backup.restore(current,exported);assert.equal(library.read(current).decks.length,1);
});
test('exports neutralize spreadsheet formulas and escape TSV/HTML fields',()=>{
  const store=storage();store.setItem('helen-favorites','["=cmd"]');study.write(store,[study.card({word:'=cmd',entries:[{source:'Princeton WordNet',meanings:[{pos:'noun',senses:[{definition:'<img src=x> & "quoted"',example:'line\nnext'}]}]}]})]);const value=backup.snapshot(store);
  assert.match(backup.csv(value),/"'=cmd"/);assert.match(backup.csv(value),/""quoted""/);assert.doesNotMatch(backup.anki(value),/<img/);assert.match(backup.anki(value),/&lt;img/);
});
test('invalid or oversized backups are rejected before modifying data',()=>{
  assert.throws(()=>backup.parse('{oops'),/JSON/);assert.throws(()=>backup.parse(JSON.stringify({version:2})),/hợp lệ/);assert.throws(()=>backup.parse(' '.repeat(backup.MAX_BYTES+1)),/5 MB/);
});
test('backup write failure rolls back the existing learning data',()=>{
  const store=storage();store.setItem('helen-favorites','["loan"]');const value=backup.snapshot(store),original=store.setItem;let fail=true;
  store.setItem=(key,text)=>{if(key===library.KEY && fail){fail=false;throw Error('quota');}original(key,text);};assert.throws(()=>backup.restore(store,value),/Bộ nhớ đầy/);assert.equal(store.getItem('helen-favorites'),'["loan"]');assert.equal(store.getItem(study.KEY),null);
});
