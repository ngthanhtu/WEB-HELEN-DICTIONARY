// Validate every published entry against its source, then exercise all 200 lessons.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const core=require('../public/assets/topics-core'),study=require('../public/assets/study-core');
const root=path.join(__dirname,'..'),manifest=require('../public/assets/topics/v1/manifest.json'),originals=require('../data/topic-originals.json'),editorial=new Map(),buffers={};
let section='';for(const line of fs.readFileSync(path.join(root,'data/topic-senses.txt'),'utf8').split('\n')){if(line.startsWith('[')){section=line.slice(1,-1);continue;}if(!line || line.startsWith('#'))continue;const [word,pos,definition,example]=line.split('|');editorial.set(`helen:${section}:${word}`,{pos,definition,examples:example?[example]:[]});}
assert.equal(manifest.version,1);assert.equal(manifest.topics.length,20);assert.equal(manifest.totalWords,4000);assert.equal(manifest.lessonSize,20);
const ids=new Set(),words=new Set(),report={topics:20,words:0,lessons:0,sourceChecked:0,wordnet:0,editorial:0,withExamples:0,clozeLessons:0,bytes:0,maxPackBytes:0};
for(const topic of manifest.topics){
  assert.ok(!ids.has(topic.id));ids.add(topic.id);assert.equal(topic.wordCount,200);assert.equal(topic.lessonCount,10);assert.equal(topic.prompts.length,2);assert.ok(topic.exams.length>0);assert.equal(topic.url,`/assets/topics/v1/${topic.id}.json`);
  const text=fs.readFileSync(path.join(root,'public',topic.url),'utf8'),pack=core.validate(JSON.parse(text),topic.id);assert.ok(Buffer.byteLength(text)<75000);report.bytes+=Buffer.byteLength(text);report.maxPackBytes=Math.max(report.maxPackBytes,Buffer.byteLength(text));
  for(const entry of pack.entries){
    assert.equal(entry.word,entry.word.trim().toLowerCase());assert.ok(!words.has(entry.word),`Duplicate ${entry.word}`);words.add(entry.word);report.words++;if(entry.examples.length)report.withExamples++;
    if(entry.source==='Helen editorial'){
      const source=editorial.get(entry.senseId) || (entry.senseId===`helen:${entry.word}`?{...originals[entry.word],examples:[]}:null);
      assert.ok(source,`Missing original source ${entry.word}`);for(const key of ['pos','definition','examples'])assert.deepEqual(entry[key],source[key],`${topic.id}:${entry.word}:${key}`);assert.deepEqual(entry.synonyms,[]);report.editorial++;
    }else{
      const parts=/^wn:(noun|verb|adj|adv):(\d{8})$/.exec(entry.senseId);assert.ok(parts,`Invalid source ${entry.word}`);const [,pos,offset]=parts;
      const buffer=buffers[pos] ||= fs.readFileSync(path.join(require('wordnet-db').path,`data.${pos}`)),end=buffer.indexOf(10,+offset),[record,gloss]=buffer.toString('utf8',+offset,end).split(' | '),fields=record.split(/\s+/),n=parseInt(fields[3],16);
      const lemmas=fields.slice(4,4+n*2).filter((_,i)=>i%2===0).map(w=>w.replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,'').toLowerCase());
      assert.ok(lemmas.includes(entry.word),`Missing lemma ${entry.word}`);assert.equal(entry.pos,{noun:'noun',verb:'verb',adj:'adjective',adv:'adverb'}[pos]);assert.equal(entry.definition,gloss.split('; "')[0].trim());assert.deepEqual(entry.examples,[...gloss.matchAll(/"([^"]+)"/g)].map(m=>m[1]));assert.deepEqual(entry.synonyms,lemmas.filter(w=>w!==entry.word));report.wordnet++;
    }report.sourceChecked++;
  }
  for(let i=0;i<10;i++){
    const cards=core.lesson(pack,i).map(e=>study.card(core.result(e)));assert.equal(cards.length,20);assert.ok(cards.every(Boolean));
    for(const style of ['choice','type','mixed'])assert.ok(study.quizPlan(cards,'',()=>.6,style).length>=3,`${topic.id}:${i}:${style}`);
    assert.ok(study.matchingPlan(cards,()=>.6).length>=3,`${topic.id}:${i}:matching`);
    if(study.quizPlan(cards,'',()=>.6,'cloze').length>=3)report.clozeLessons++;report.lessons++;
  }
}
assert.equal(report.words,4000);assert.equal(report.sourceChecked,4000);assert.equal(report.lessons,200);
console.log(JSON.stringify(report,null,2));
console.log('Structural and source checks passed; these checks do not establish exam frequency or certify every semantic choice.');
