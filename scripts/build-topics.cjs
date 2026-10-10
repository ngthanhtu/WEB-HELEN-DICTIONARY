// Original bilingual curriculum. Explicitly curated combinations, never a Cartesian product.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),curriculum=require('../data/topic-curriculum.json'),actions=require('../data/topics-ielts/actions.json'),overrides=require('../data/topics-ielts/overrides.json');
const examples=new Map(fs.readFileSync(path.join(root,'data/topics-ielts/examples.txt'),'utf8').split('\n').filter(s=>s && !s.startsWith('#')).map(s=>{const [id,word,en,vi]=s.split('|');return [`${id}:${word}`,{en,vi}];}));
const cap=s=>s[0].toUpperCase()+s.slice(1),lower=s=>s[0].toLowerCase()+s.slice(1);
function entriesFor(id){
  const rows=fs.readFileSync(path.join(root,`data/topics-ielts/${id}.txt`),'utf8').split('\n').map(s=>s.trim()).filter(s=>s && !s.startsWith('#'));
  assert.equal(rows.length,50,`${id}: exactly 50 distinct concepts required`);
  return rows.flatMap((line,i)=>{
    const parts=line.split('|');assert.equal(parts.length,4,`${id}:${i+1}: four editorial fields required`);
    const [raw,definition,vi,verbs]=parts,word=raw.toLowerCase(),conceptId=`helen:ielts-v2:${id}:${word}`;
    const common={examples:[],synonyms:[],source:'Helen editorial',conceptId};
    const base={...common,word,pos:'noun',kind:'concept',definition:cap(definition)+'.',definitionVi:cap(vi)+'.',senseId:conceptId};
    const example=examples.get(`${id}:${word}`);if(example){base.examples=[example.en];base.examplesVi=[example.vi];}
    const chosen=verbs.split(',');assert.equal(new Set(chosen).size,3,`${word}: three different approved actions required`);
    return [base,...chosen.map(verb=>{
      assert.ok(actions[verb],`${word}: missing action translation ${verb}`);
      return {...common,word:`${verb} ${word}`,pos:'verb',kind:'collocation',definition:`${cap(verb)} ${definition}.`,definitionVi:`${actions[verb]} ${lower(vi)}.`,senseId:`${conceptId}:${verb}`,...(overrides[`${verb} ${word}`] || {})};
    })];
  });
}
function build(){
  const manifest={version:2,totalWords:4000,totalConcepts:1000,lessonSize:20,levelAim:'IELTS 6.5+',selectionNote:'Helen biên soạn cho mục tiêu IELTS 6.5+: 50 khái niệm và 150 collocations hành động mỗi chủ đề. Đây là định hướng luyện tập, không phải danh sách chính thức, thống kê tần suất hoặc cam kết điểm thi.',licenseUrl:'/assets/licenses/wordnet.txt',topics:[]},used=new Set(),output=path.join(root,'public/assets/topics/v2');fs.mkdirSync(output,{recursive:true});
  for(const topic of curriculum.topics){
    const entries=entriesFor(topic.id);for(const e of entries){assert.ok(!used.has(e.word),`Duplicate learning unit: ${e.word}`);used.add(e.word);}
    const {domains,keywords,...metadata}=topic,pack={version:2,id:topic.id,levelAim:manifest.levelAim,entries},json=JSON.stringify(pack)+'\n';
    fs.writeFileSync(path.join(output,`${topic.id}.json`),json);manifest.topics.push({...metadata,levelAim:manifest.levelAim,conceptCount:50,collocationCount:150,wordCount:200,lessonCount:10,url:`/assets/topics/v2/${topic.id}.json`,bytes:Buffer.byteLength(json)});
  }
  assert.equal(used.size,4000);for(const word of Object.keys(overrides))assert.ok(used.has(word),`Unused editorial override: ${word}`);fs.writeFileSync(path.join(root,'public/assets/topics/manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Built 20 bilingual topics: 1,000 concepts + 3,000 approved action collocations. No provider calls.');
}
if(require.main===module)build();module.exports={entriesFor,build};
