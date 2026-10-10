// Whole-curriculum source, bilingual coverage, payload and learning checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const core=require('../public/assets/topics-core'),study=require('../public/assets/study-core'),{entriesFor}=require('./build-topics.cjs'),manifest=require('../public/assets/topics/manifest.json');
assert.equal(manifest.version,2);assert.equal(manifest.topics.length,20);assert.equal(manifest.totalWords,4000);assert.equal(manifest.totalConcepts,1000);
const seen=new Set(),report={topics:0,concepts:0,collocations:0,bilingual:0,lessons:0,withExamples:0,maxGzipBytes:0};
for(const t of manifest.topics){
 const data=fs.readFileSync(path.join(__dirname,'../public',t.url)),pack=core.validate(JSON.parse(data),t.id);assert.equal(t.url,`/assets/topics/v2/${t.id}.json`);assert.deepEqual(pack.entries,entriesFor(t.id));assert.equal(pack.entries.filter(e=>e.kind==='concept').length,50);assert.equal(pack.entries.filter(e=>e.kind==='collocation').length,150);assert.equal(t.bytes,data.length);
 const compressed=zlib.gzipSync(data).length;assert.ok(compressed<25000,`${t.id}: gzip payload too large`);report.maxGzipBytes=Math.max(report.maxGzipBytes,compressed);
 for(const e of pack.entries){assert.ok(!seen.has(e.word),e.word);seen.add(e.word);assert.equal(e.word,e.word.trim().toLowerCase());assert.ok(e.definitionVi!==e.definition);assert.match(e.definitionVi,/[à-ỹđĐ]/u);assert.ok(e.definition.length<=450);assert.ok(!/<|>|TODO|placeholder/i.test(e.definition+e.definitionVi));assert.equal(e.source,'Helen editorial');report[e.kind==='concept'?'concepts':'collocations']++;report.bilingual++;if(e.examples.length){report.withExamples++;assert.equal(e.examplesVi.length,e.examples.length);}}
 for(let i=0;i<10;i++){
  const cards=core.lesson(pack,i).map(e=>study.card(core.result(e)));assert.equal(cards.length,20);assert.ok(cards.every(Boolean));
  for(const style of ['choice','mixed','type']){const questions=study.quizPlan(cards,'',()=>.5,style);assert.ok(questions.length>=3);assert.ok(questions.every(q=>q.definitionVi));for(const q of questions)if(q.choices)for(const word of q.choices)if(word!==q.word)assert.notEqual(cards.find(c=>c.word===word)?.senses[0].conceptId,q.conceptId);}
  const pairs=study.matchingPlan(cards,()=>.5);assert.ok(pairs.length>=3);assert.equal(new Set(pairs.map(p=>p.conceptId)).size,pairs.length);report.lessons++;
 }report.topics++;
}
assert.equal(seen.size,4000);assert.equal(report.bilingual,4000);assert.equal(report.lessons,200);console.log(JSON.stringify(report,null,2));console.log('All source records and local learning paths checked. This is not official band certification or an exam-frequency study.');
