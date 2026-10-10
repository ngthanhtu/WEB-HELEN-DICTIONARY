(function(root){
  'use strict';
  const KEY='helen-topic-progress-v1',validId=id=>typeof id==='string' && /^[a-z]+$/.test(id);
  function validate(pack,id){
    if(pack?.version!==1 || pack.id!==id || !validId(id) || !Array.isArray(pack.entries) || pack.entries.length!==200)throw Error('Bộ từ chưa đầy đủ. Hãy cập nhật app rồi thử lại.');
    const seen=new Set();
    for(const entry of pack.entries){if(typeof entry.word!=='string' || !entry.word.trim() || entry.word.length>100 || /[<>\x00-\x1f]/.test(entry.word) || seen.has(entry.word) || !['noun','verb','adjective','adverb'].includes(entry.pos) || typeof entry.definition!=='string' || !entry.definition.trim() || entry.definition.length>600 || !Array.isArray(entry.examples) || entry.examples.some(x=>typeof x!=='string' || x.length>600) || !Array.isArray(entry.synonyms) || entry.synonyms.some(x=>typeof x!=='string') || !['Princeton WordNet','Helen editorial'].includes(entry.source))throw Error('Dữ liệu bộ từ chưa hợp lệ. Hãy cập nhật app rồi thử lại.');seen.add(entry.word);}
    return pack;
  }
  const result=entry=>({word:entry.word,entries:[{word:entry.word,source:entry.source,meanings:[{pos:entry.pos,senses:[{definition:entry.definition,examples:entry.examples,synonyms:entry.synonyms,relationSource:entry.source}]}]}]});
  function lesson(pack,index){if(!Number.isInteger(index) || index<0 || index>=10)throw Error('Nhóm từ không hợp lệ.');return pack.entries.slice(index*20,index*20+20);}
  function sanitize(value){const lessons={};if(value?.version===1 && value.lessons && typeof value.lessons==='object')for(const [key,v] of Object.entries(value.lessons).slice(0,200)){if(/^[a-z]+:[0-9]$/.test(key) && v && Number.isInteger(v.total) && v.total>=3 && v.total<=20 && Number.isInteger(v.correct) && v.correct>=0 && v.correct<=v.total && Number.isFinite(v.at) && v.at>0)lessons[key]={total:v.total,correct:v.correct,at:v.at};}return {version:1,lessons};}
  function read(storage){try{return sanitize(JSON.parse(storage?.getItem(KEY)||'{}'));}catch{return sanitize(null);}}
  function completed(value,{id,index,total,correct},now=Date.now()){if(!validId(id) || !Number.isInteger(index) || index<0 || index>9)throw Error('Nhóm từ không hợp lệ.');return sanitize({version:1,lessons:{...sanitize(value).lessons,[`${id}:${index}`]:{total,correct,at:now}}});}
  function merge(a,b){const lessons={...sanitize(a).lessons};for(const [key,v] of Object.entries(sanitize(b).lessons))if(!lessons[key] || v.at>lessons[key].at)lessons[key]=v;return sanitize({version:1,lessons});}
  const api={KEY,validate,result,lesson,sanitize,read,completed,merge};root.HelenTopicsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
