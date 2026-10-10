// Published editorial senses and translations qualify locally, without provider calls.
const fs=require('node:fs'),path=require('node:path'),manifest=require('../public/assets/topics/manifest.json');
const entries=new Map(),translations=new Map(),rawEntries=new Map();
for(const topic of manifest.topics){
  const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../public',topic.url),'utf8'));
  for(const entry of pack.entries){
    rawEntries.set(entry.word,entry);
    if(entry.definitionVi)translations.set(`definition|${entry.definition}`,entry.definitionVi);
    entry.examples?.forEach((text,i)=>{if(entry.examplesVi?.[i])translations.set(`sentence|${text}`,entry.examplesVi[i]);});
    const combinations=entry.kind==='concept'?pack.entries.filter(e=>e.kind==='collocation' && e.conceptId===entry.conceptId):[];
    entries.set(entry.word,{word:entry.word,source:entry.source,topicEdition:pack.version,...(entry.definitionVi?{topicGloss:entry.definitionVi}:{}),
      meanings:[{pos:entry.pos,senses:[{definition:entry.definition,examples:entry.examples,relationSource:entry.source,...(entry.definitionVi?{definitionVi:entry.definitionVi,conceptId:entry.conceptId}:{}),...(entry.examplesVi?{examplesVi:entry.examplesVi}:{})}]}],
      collocations:{teaching:combinations.map(e=>({pattern:'verb + noun phrase',phrase:e.word,example:'',source:'Helen editorial'})),corpus:[],examples:entry.examples || [],pending:false,unavailable:false}});
  }
}
// Older downloaded words and examples still qualify for pronunciation.
for(const t of require('../public/assets/topics/v1/manifest.json').topics){const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../public',t.url),'utf8'));for(const e of pack.entries)if(!entries.has(e.word))entries.set(e.word,{word:e.word,source:e.source,topicEdition:1,meanings:[{pos:e.pos,senses:[{definition:e.definition,examples:e.examples,relationSource:e.source}]}]});}
function topicTranslation(text,kind,definition){
  if(kind==='headword'){const entry=rawEntries.get(text.toLowerCase());return entry && entry.definition===definition?entry.definitionVi:undefined;}
  return translations.get(`${kind==='definition'?'definition':'sentence'}|${text}`);
}
module.exports={topicEntry:word=>entries.get(word),topicTranslation};
