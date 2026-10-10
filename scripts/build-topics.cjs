// Reproducible, offline build. Never calls a paid API or scrapes a dictionary.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),curriculum=require('../data/topic-curriculum.json'),originals=require('../data/topic-originals.json');
const directory=require('wordnet-db').path,files=['noun','verb','adj','adv'].map(pos=>({pos,index:fs.readFileSync(path.join(directory,`index.${pos}`),'utf8'),data:fs.readFileSync(path.join(directory,`data.${pos}`))}));
for(const file of files)file.lines=new Map(file.index.split('\n').filter(line=>line && line[0]!==' ').map(line=>[line.split(' ',1)[0],line]));
const names={noun:'noun',verb:'verb',adj:'adjective',adv:'adverb'};
const editorial=new Map();let section='';for(const row of fs.readFileSync(path.join(root,'data/topic-senses.txt'),'utf8').split('\n')){if(row.startsWith('[')){section=row.slice(1,-1);continue;}if(!row || row.startsWith('#'))continue;const [word,pos,definition,example]=row.split('|');editorial.set(`${section}:${word}`,{pos,definition,examples:example?[example]:[],synonyms:[],source:'Helen editorial',senseId:`helen:${section}:${word}`});}
function senses(word){
  if(originals[word])return [{...originals[word],examples:[],synonyms:[],source:'Helen editorial',senseId:`helen:${word}`}];
  const results=[];
  for(const file of files){const row=file.lines.get(word.replace(/ /g,'_'));if(!row)continue;
    const f=row.trim().split(/\s+/),offsets=f.slice(6+Number(f[3]),6+Number(f[3])+Number(f[2]));
    offsets.forEach((offset,rank)=>{const end=file.data.indexOf(10,Number(offset)),line=file.data.toString('utf8',Number(offset),end),[record,gloss]=line.split(' | ');if(!gloss)return;
      const fields=record.split(/\s+/),n=parseInt(fields[3],16),raw=fields.slice(4,4+n*2).filter((_,i)=>i%2===0).map(w=>w.replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,'')),lemmas=raw.map(w=>w.toLowerCase());
      // A common noun must not inherit a proper-name sense (Barber, Atlas, etc.).
      if(file.pos==='noun' && !raw.includes(word) && !raw.some(w=>/^[A-Z]{2,5}$/.test(w) && w.toLowerCase()===word))return;
      results.push({pos:names[file.pos],definition:gloss.split('; "')[0].trim(),examples:[...gloss.matchAll(/"([^"]+)"/g)].map(m=>m[1]),synonyms:lemmas.filter(w=>w!==word),source:'Princeton WordNet',senseId:`wn:${file.pos}:${offset}`,domain:Number(fields[1]),rank});
    });
  }return results;
}
// Explicit decisions for polysemy; the selected definition is displayed, not a headword-only translation.
const overrides={
 'education:term':['noun','academic'], 'education:mark':['noun','grade'], 'education:discipline':['noun','branch'],
 'work:post':['noun','job'], 'work:position':['noun','job'], 'work:leave':['noun','absent'], 'work:shift':['noun','work'],
 'business:capital':['noun','wealth'], 'business:stock':['noun','merchandise'], 'business:margin':['noun','profit'], 'business:branch':['noun','division'], 'business:interest':['noun','borrowing'],
 'money:bank':['noun','financial'], 'money:note':['noun','money'], 'money:loan':['noun','money'], 'money:premium':['noun','payment'], 'money:bond':['noun','certificate'], 'money:share':['noun','stock'], 'money:security':['noun','investment'], 'money:principal':['noun','debt'], 'money:charge':['noun','price'],
 'travel:reservation':['noun','reserved'], 'travel:customs':['noun','duties'], 'travel:season':['noun','year'],
 'transport:coach':['noun','passengers'], 'transport:boot':['noun','compartment'], 'transport:hood':['noun','engine'], 'transport:train':['noun','railroad'], 'transport:terminal':['noun','station'], 'transport:carrier':['noun','transport'],
 'housing:flat':['noun','rooms'], 'housing:study':['noun','room'], 'housing:tap':['noun','water'], 'housing:blind':['noun','window'], 'housing:block':['noun','buildings'],
 'health:ward':['noun','hospital'], 'health:patient':['noun','care'], 'health:operation':['noun','medical'], 'health:strain':['noun','injury'],
 'environment:spring':['noun','season'], 'environment:current':['noun','flow'],
 'science:mean':['noun','average'], 'science:cell':['noun','structural'], 'science:base':['noun','compound'], 'science:solution':['noun','mixture'], 'science:significance':['noun','statistical'],
 'technology:mouse':['noun','device'], 'technology:memory':['noun','computer'], 'technology:virus':['noun','program'], 'technology:worm':['noun','program'], 'technology:port':['noun','computer'], 'technology:terminal':['noun','keyboard'], 'technology:string':['noun','characters'], 'technology:window':['noun','computer'], 'technology:cloud':['noun','computing'],
 'communication:medium':['noun','communication'], 'communication:press':['noun','newspapers'], 'communication:channel':['noun','television'],
 'society:sentence':['noun','punishment'], 'society:party':['noun','political'], 'society:appeal':['noun','court'],
 'relationships:date':['noun','meeting'], 'relationships:bond':['noun','connection'],
 'food:course':['noun','meal'], 'food:starter':['noun','food'], 'food:stock':['noun','broth'], 'food:roll':['noun','bread'], 'food:spirit':['noun','distilled'],
 'culture:play':['noun','dramatic'], 'culture:act':['noun','subdivision'], 'culture:cast':['noun','actors'], 'culture:organ':['noun','instrument'], 'culture:verse':['noun','poetry'],
 'shopping:change':['noun','coins'], 'shopping:check':['noun','bank'], 'shopping:trainer':['noun','shoe'],
 'sports:draw':['noun','score'], 'sports:tie':['noun','score'], 'sports:course':['noun','sports'], 'sports:club':['noun','golf'], 'sports:stroke':['noun','sport'], 'sports:pool':['noun','table'],
 'agriculture:pen':['noun','enclosure'], 'agriculture:combine':['noun','harvester'], 'agriculture:produce':['noun','fruit'], 'agriculture:yield':['noun','production'],
 'personal:content':['adjective','satisfied'], 'personal:reserved':['adjective','reticent'], 'personal:gift':['noun','ability']
};
function select(word,topic,pos){const specific=editorial.get(`${topic.id}:${word}`);if(specific)return specific;let list=senses(word);if(!list.length)return null;const override=overrides[`${topic.id}:${word}`];
  if(override){const sense=list.find(s=>s.pos===override[0] && s.definition.toLowerCase().includes(override[1]));if(sense)return sense;}
  if(pos && list.some(s=>s.pos===pos))list=list.filter(s=>s.pos===pos);
  const keywords=topic.keywords.split(' ');
  return list.filter(s=>s.pos===list[0].pos).map((s,i)=>({s,score:-(s.rank || 0)*1.4-i*.04+(topic.domains.includes(s.domain)?2:0)+Math.min(6,keywords.filter(w=>new RegExp(`\\b${w}\\b`,'i').test(s.definition)).length*2)})).sort((a,b)=>b.score-a.score)[0].s;
}
const chunks=fs.readFileSync(path.join(root,'data/topic-vocabulary.txt'),'utf8').split(/\[([^\]]+)\]\n/),used=new Set(),output=path.join(root,'public/assets/topics/v1');fs.mkdirSync(output,{recursive:true});
// Authored candidate blocks place action words and descriptors in explicit ranges.
const grammar={education:['learn','academic','preschool'],work:['employ','responsible','labor'],business:['implement','commercial','monopoly'],money:['afford','monetary','currency exchange'],travel:['escort','scenic','all-inclusive'],transport:['ride','fast','commuter train'],housing:['accommodate','spacious','habitation'],health:['diagnose','sanitary','diagnose'],environment:['protect','organic','protect'],science:['classify','qualitative',null],technology:['download','digital','download'],communication:['communicate','fluent','slander'],society:['enforce','civil','civil rights'],relationships:['nurture','responsible','offspring'],food:['roast','sweet','roast'],culture:['perform','artistic',null],shopping:['purchase','cheap','consumable'],sports:['compete','competitive',null],agriculture:['cultivate','fertile','infertile'],personal:[null,'confident',null]};
const verbStops={health:'disability',environment:'legislation',technology:'cache',shopping:'clothing',agriculture:'resource'};
const priority={food:['nutrition','nutrient','protein','carbohydrate','fat','fiber','fibre','vitamin','mineral','calorie','diet','appetite','hunger','thirst','flavor','aroma'],agriculture:['mining','mine','miner','quarry','ore','metal','refinery','refine','smelt','furnace','iron','copper','zinc','tin']};
const manifest={version:1,totalWords:4000,lessonSize:20,selectionNote:curriculum.selectionNote,licenseUrl:'/assets/licenses/wordnet.txt',topics:[]};
for(const topic of curriculum.topics){const block=chunks[chunks.indexOf(topic.id)+1];if(!block)throw Error(`Missing ${topic.id}`);
  const words=block.trim().split('|').map(w=>w.trim().toLowerCase()),[verb,adj,stop]=grammar[topic.id],v=verb?words.indexOf(verb):-1,a=adj?words.indexOf(adj):-1,end=stop?words.indexOf(stop):words.length,verbEnd=verbStops[topic.id]?words.indexOf(verbStops[topic.id]):a>v?a:words.length;
  if((verb && v<0)||(adj && a<0)||(stop && end<0)||(verbStops[topic.id] && verbEnd<0))throw Error(`Invalid grammar markers: ${topic.id}`);
  const candidates=[...new Set(words.filter(w=>w && !used.has(w)))].map(word=>{const i=words.indexOf(word),pos=i>=a && a>=0 && i<end?'adjective':v>=0 && i>=v && i<verbEnd?'verb':null;return {word,sense:select(word,topic,pos)};}).filter(x=>x.sense && x.sense.definition.length<=600);
  // Keep everyday foundations, while reserving room for actions and descriptive language.
  const selected=candidates.filter(x=>(priority[topic.id]||[]).includes(x.word));for(const item of candidates.slice(0,140))if(!selected.includes(item))selected.push(item);for(const pos of ['verb','adjective'])for(const item of candidates.filter(x=>x.sense.pos===pos).slice(0,30))if(!selected.includes(item))selected.push(item);
  for(const item of candidates)if(selected.length<200 && !selected.includes(item))selected.push(item);
  if(selected.length<200)throw Error(`${topic.id}: only ${selected.length} distinct entries; add editorial candidates`);
  const entries=selected.slice(0,200).map(({word,sense})=>{used.add(word);const {domain,rank,...meaning}=sense;return {word,...meaning};});
  const {domains,keywords,...metadata}=topic,data={version:1,id:topic.id,licenseUrl:manifest.licenseUrl,entries};
  const json=JSON.stringify(data);fs.writeFileSync(path.join(output,`${topic.id}.json`),json+'\n');
  manifest.topics.push({...metadata,wordCount:entries.length,lessonCount:10,url:`/assets/topics/v1/${topic.id}.json`,bytes:Buffer.byteLength(json)});
}
if(used.size!==4000)throw Error('Headwords must be globally unique');
fs.writeFileSync(path.join(root,'public/assets/topics/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Built ${manifest.topics.length} topics, ${used.size} distinct headwords. No network requests.`);
module.exports={senses,select};
