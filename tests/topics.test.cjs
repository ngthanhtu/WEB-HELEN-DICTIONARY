const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const topics=require('../public/assets/topics-core'),study=require('../public/assets/study-core'),backup=require('../public/assets/backup-core'),manifest=require('../public/assets/topics/manifest.json');
const pack=id=>JSON.parse(fs.readFileSync(path.join(__dirname,`../public/assets/topics/v1/${id}.json`),'utf8'));
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('published curriculum has exactly 20 topics, 200 words each and 4000 unique headwords',()=>{
  assert.equal(manifest.topics.length,20);const seen=new Set();for(const item of manifest.topics){const data=topics.validate(pack(item.id),item.id);assert.equal(item.wordCount,200);assert.equal(item.lessonCount,10);assert.equal(item.prompts.length,2);assert.ok(item.bytes<75000);for(const entry of data.entries){assert.ok(!seen.has(entry.word),entry.word);seen.add(entry.word);}}assert.equal(seen.size,4000);
});
test('every lesson prepares locally for meaning, typed and matching practice without API requests',()=>{
  const start=performance.now();for(const item of manifest.topics)for(let i=0;i<10;i++){const cards=topics.lesson(pack(item.id),i).map(e=>study.card(topics.result(e)));assert.equal(cards.length,20);for(const mode of ['choice','mixed','type'])assert.ok(study.quizPlan(cards,'',()=>.5,mode).length>=3,`${item.id}:${i}:${mode}`);assert.ok(study.matchingPlan(cards,()=>.5).length>=3);}assert.ok(performance.now()-start<5000);
});
test('contextual senses keep money, computer and sport meanings distinct',()=>{
  const entry=(id,word)=>pack(id).entries.find(e=>e.word===word);
  assert.match(entry('money','bank').definition,/financial/);assert.match(entry('money','loan').definition,/money/);assert.match(entry('technology','memory').definition,/computer/);assert.match(entry('sports','match').definition,/sports contest/);assert.equal(entry('shopping','scarf').pos,'noun');assert.match(entry('agriculture','plant').definition,/living organism/);
});
test('incomplete, duplicate, wrong-source and malformed topic packs cannot become offline lessons',()=>{
  const good=pack('education');assert.throws(()=>topics.validate({...good,entries:good.entries.slice(1)},'education'));assert.throws(()=>topics.validate(good,'money'));
  for(const bad of [{word:'<script>'},{pos:'something'},{source:'unverified'},{definition:''},{examples:[null]}]){const data=structuredClone(good);Object.assign(data.entries[0],bad);assert.throws(()=>topics.validate(data,'education'));}
  const duplicate=structuredClone(good);duplicate.entries[1]=duplicate.entries[0];assert.throws(()=>topics.validate(duplicate,'education'));
  assert.throws(()=>topics.lesson(good,-1));assert.throws(()=>topics.lesson(good,10));assert.equal(topics.lesson(good,9).length,20);
});
test('topic completion survives reload, merges by date and does not mark unfinished or impossible results',()=>{
  const storage=store(),one=topics.completed(null,{id:'education',index:0,total:10,correct:8},1000);storage.setItem(topics.KEY,JSON.stringify(one));assert.deepEqual(topics.read(storage),one);
  const two=topics.completed(one,{id:'education',index:0,total:10,correct:6},2000);assert.deepEqual(topics.merge(two,one),two);assert.deepEqual(topics.merge(one,two),two);
  assert.deepEqual(topics.sanitize({version:1,lessons:{'education:10':{total:10,correct:3,at:1},'education:0':{total:10,correct:11,at:1}}}).lessons,{});assert.throws(()=>topics.completed(one,{id:'education',index:10,total:10,correct:9}));assert.deepEqual(topics.read({getItem(){throw Error('blocked');}}),{version:1,lessons:{}});
});
test('old backups stay compatible and new backups preserve topic progress and existing review schedules',()=>{
  const a=store(),b=store(),progress=topics.completed(null,{id:'sports',index:9,total:6,correct:5},1000);a.setItem(topics.KEY,JSON.stringify(progress));a.setItem('helen-favorites','["loan"]');const card=study.grade(study.card(topics.result(pack('money').entries.find(e=>e.word==='loan')),null,1),'good',10);study.write(a,[card]);
  const snapshot=backup.snapshot(a);backup.restore(b,snapshot);assert.deepEqual(topics.read(b),progress);assert.equal(study.read(b)[0].dueAt,card.dueAt);
  const older={...snapshot};delete older.topics;backup.restore(b,backup.parse(JSON.stringify(older)));assert.deepEqual(topics.read(b),progress);
});
