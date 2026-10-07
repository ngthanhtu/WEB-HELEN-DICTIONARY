// Structural eligibility audit over every installed WordNet record; no remote translation calls.
const fs=require('node:fs'),path=require('node:path'),study=require('../public/assets/study-core');
const directory=require('wordnet-db').path;
const all=new Set(),review=new Set(),quiz=new Set(),cloze=new Set();let senses=0,errors=0;
for(const file of ['noun','verb','adj','adv'])for(const line of fs.readFileSync(path.join(directory,`data.${file}`),'utf8').split('\n')){
  if(!/^\d{8} /.test(line))continue;
  const [record,gloss]=line.split(' | '),fields=record.trim().split(/\s+/),length=parseInt(fields[3],16),pos={noun:'noun',verb:'verb',adj:'adjective',adv:'adverb'}[file];
  const words=fields.slice(4,4+length*2).filter((_,i)=>i%2===0).map(word=>word.replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,''));
  const examples=[...(gloss || '').matchAll(/"([^"]+)"/g)].map(match=>match[1]),definition=(gloss || '').split('; "')[0].trim();senses++;
  for(const word of words){
    all.add(word);const card=study.card({word,entries:[{source:'Princeton WordNet',meanings:[{pos,senses:[{definition,examples,synonyms:words.filter(other=>other!==word)}]}]}]},null,0);
    if(!card)continue;review.add(word);const question=study.question(card,[card],0);
    if(question){quiz.add(word);if(question.word!==word.toLowerCase() || !question.prompt || study.cloze(word,question.prompt))errors++;}
    if(examples.some(example=>study.cloze(word,example)))cloze.add(word);
  }
}
console.log(JSON.stringify({dataset:'Installed Princeton WordNet',synsets:senses,headwords:all.size,reviewEligible:review.size,quizEligible:quiz.size,exactExampleEligible:cloze.size,errors,scope:'All local records checked for usable definitions and exact-answer quiz eligibility. Does not verify all translations or guarantee unambiguous semantic alternatives.'},null,2));
if(errors)process.exitCode=1;
