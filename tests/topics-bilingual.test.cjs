const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const topics=require('../public/assets/topics-core'),study=require('../public/assets/study-core'),quiz=require('../public/assets/quiz-translation'),backup=require('../public/assets/backup-core'),{createTranslationService}=require('../lib/translation');
const manifest=require('../public/assets/topics/manifest.json');
const pack=id=>require(`../public/assets/topics/v2/${id}.json`);
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('all 4000 contextual meanings translate locally even with both providers offline',async()=>{
 let calls=0;const service=createTranslationService({apiKey:'test-only',fetchImpl:async()=>{calls++;throw Error('offline');}}),start=performance.now();
 for(const t of manifest.topics){const data=pack(t.id);topics.registerSenses(data.entries);for(const e of data.entries){assert.equal(await service.translate(e.definition,'en','vi',{kind:'definition'}),e.definitionVi);assert.equal(topics.translation(e.definition,'definition'),e.definitionVi);for(let i=0;i<e.examples.length;i++)assert.equal(await service.translate(e.examples[i],'en','vi'),e.examplesVi[i]);}}
 assert.equal(calls,0);assert.ok(performance.now()-start<1000);
});
test('new curriculum is traceable to 50 concepts and 150 selected collocations in every topic',()=>{
 const forbidden=new Set(['book','cat','dog','car','teacher','school','banana','happy']);
 for(const t of manifest.topics){const data=topics.validate(pack(t.id),t.id);assert.equal(data.entries.filter(e=>e.kind==='concept').length,50);assert.equal(data.entries.filter(e=>e.kind==='collocation').length,150);assert.ok(data.entries.every(e=>!forbidden.has(e.word)));}
 const data=pack('education');for(const word of ['digital literacy','academic achievement','learning outcomes','inclusive education','develop critical thinking','assess learning outcomes'])assert.ok(data.entries.some(e=>e.word===word),word);
 assert.ok(!data.entries.some(e=>/achivement/.test(e.word)));
});
test('saved bilingual meanings, example translations and review dates survive reload and JSON restore',async()=>{
 const a=storage(),b=storage(),e=pack('education').entries[0],card=study.grade(study.card(topics.result(e),null,1000),'good',2000);
 a.setItem('helen-favorites',JSON.stringify([e.word]));study.write(a,[card]);const next=backup.restore(b,backup.snapshot(a));assert.equal(next.study.cards[0].dueAt,card.dueAt);assert.equal(next.study.cards[0].senses[0].definitionVi,e.definitionVi);
 const q=study.question(study.read(b)[0],[],0,()=>.5,'cloze');assert.ok(q.originalVi);let calls=0;const rows=await quiz.translate(q,'vi',async()=>{calls++;throw Error('offline');});assert.equal(calls,0);assert.equal(rows[0].translation,e.definitionVi);assert.equal(rows[1].translation,e.examplesVi[0]);
});
test('new lesson results never overwrite or imply completion of archived lessons',()=>{
 const old=topics.completed(null,{id:'education',index:0,total:10,correct:8},1000),next=topics.completed(old,{id:'education',index:0,edition:2,total:10,correct:7},2000);
 assert.equal(next.lessons['education:0'].correct,8);assert.equal(next.lessons['education-v2:0'].correct,7);const a=storage(),b=storage();a.setItem(topics.KEY,JSON.stringify(next));backup.restore(b,backup.snapshot(a));assert.deepEqual(topics.read(b),next);
});
test('related action variants cannot become competing answers or duplicate matching concepts',()=>{
 for(const t of manifest.topics)for(let index=0;index<10;index++){
 const cards=topics.lesson(pack(t.id),index).map(e=>study.card(topics.result(e)));
 for(const q of study.quizPlan(cards,'',()=>.5,'choice'))for(const choice of q.choices)if(choice!==q.word)assert.notEqual(cards.find(c=>c.word===choice).senses[0].conceptId,q.conceptId);
 const pairs=study.matchingPlan(cards,()=>.5);assert.equal(new Set(pairs.map(p=>p.conceptId)).size,pairs.length);
 }
});
test('Vietnamese fields cannot silently disappear from malformed v2 packs',()=>{
 for(const field of ['definitionVi','conceptId','kind']){const p=structuredClone(pack('education'));delete p.entries[0][field];assert.throws(()=>topics.validate(p,'education'));}
 const p=structuredClone(pack('education'));p.entries[0].examplesVi=[];assert.throws(()=>topics.validate(p,'education'));
});
test('archived offline packs retain their original senses and remain valid',()=>{
 for(const t of require('../public/assets/topics/v1/manifest.json').topics){const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../public',t.url),'utf8'));assert.equal(topics.validate(p,t.id).version,1);}
});

test('local Vietnamese content never substitutes for another selected language',async()=>{
 let calls=0;const e=pack('education').entries[0],q={definition:e.definition,definitionVi:e.definitionVi};
 const rows=await quiz.translate(q,'fr',async(texts,from,to)=>{calls++;assert.equal(to,'fr');return texts.map(()=> 'Capacité à utiliser efficacement des outils numériques.');});assert.equal(calls,1);assert.equal(rows[0].translation,'Capacité à utiliser efficacement des outils numériques.');
});
