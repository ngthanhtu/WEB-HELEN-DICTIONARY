(function(root){
  'use strict';
  const DAY=86400000,KEY='helen-study-v1';
  const clean=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  const answer=value=>clean(value).toLowerCase().replace(/[’‘]/g,"'");
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function wordPattern(word){return new RegExp(`(^|[^a-zA-Z0-9])(${escape(word).replace(/ /g,'\\s+')})(?=$|[^a-zA-Z0-9])`,'gi');}
  function cloze(word,example){
    if(!word || !example)return null;
    let count=0;const text=example.replace(wordPattern(word),(_,prefix)=>{count++;return `${prefix}____`;});
    return count?text:null;
  }
  function senses(result){
    const found=[],seen=new Set();
    for(const entry of Array.isArray(result?.entries)?result.entries:[])for(const meaning of Array.isArray(entry?.meanings)?entry.meanings:[])for(const sense of Array.isArray(meaning?.senses)?meaning.senses:[]){
      if(!sense || typeof sense!=='object')continue;
      const definition=clean(sense.definition),pos=clean(meaning.pos);
      if(!definition || definition.length>600 || !pos || seen.has(`${pos}|${answer(definition)}`))continue;
      seen.add(`${pos}|${answer(definition)}`);
      const examples=[sense.example,...(Array.isArray(sense.examples)?sense.examples:[])].map(clean).filter(v=>v && v.length<=600);
      found.push({pos,definition,examples:[...new Set(examples)].slice(0,2),synonyms:(Array.isArray(sense.synonyms)?sense.synonyms:[]).map(answer).filter(Boolean).slice(0,30),source:clean(sense.relationSource || entry.source)});
    }
    // Round-robin keeps all parts of speech represented, rather than only the first noun group.
    const groups=new Map();for(const sense of found){if(!groups.has(sense.pos))groups.set(sense.pos,[]);groups.get(sense.pos).push(sense);}
    const selected=[];for(let i=0;selected.length<16;i++){let added=false;for(const group of groups.values())if(group[i]){selected.push(group[i]);added=true;if(selected.length===16)break;}if(!added)break;}
    return selected;
  }
  function card(result,previous,now=Date.now()){
    const word=answer(result?.word),items=senses(result);
    if(!word || word.length>100 || !items.length)return null;
    return {word,senses:items,addedAt:now,dueAt:now,interval:0,ease:2.5,reviews:0,lapses:0,lastReviewedAt:null,...schedule(previous),updatedAt:now};
  }
  function schedule(value){
    if(!value || typeof value!=='object')return {};
    const output={};
    for(const [key,min,max] of [['addedAt',0,8640000000000000],['dueAt',0,8640000000000000],['lastReviewedAt',0,8640000000000000],['interval',0,365],['ease',1.3,3],['reviews',0,100000],['lapses',0,100000]])if(Number.isFinite(value[key]) && value[key]>=min && value[key]<=max)output[key]=value[key];
    return output;
  }
  function grade(value,rating,now=Date.now()){
    if(!['again','hard','good'].includes(rating))throw Error('Invalid review rating');
    const current={interval:0,ease:2.5,reviews:0,lapses:0,...schedule(value)};
    let interval=current.interval,ease=current.ease;
    if(rating==='again'){interval=0;ease=Math.max(1.3,ease-.2);}
    else if(rating==='hard'){interval=interval?Math.max(1,Math.round(interval*1.2)):1;ease=Math.max(1.3,ease-.15);}
    else interval=interval===0?1:interval===1?3:Math.max(interval+1,Math.round(interval*ease));
    interval=Math.min(365,interval);
    return {...value,...current,interval,ease,dueAt:now+(rating==='again'?10*60000:interval*DAY),lastReviewedAt:now,reviews:current.reviews+1,lapses:current.lapses+(rating==='again'?1:0)};
  }
  const due=(cards,now=Date.now())=>cards.filter(item=>item.dueAt<=now).sort((a,b)=>a.dueAt-b.dueAt || a.word.localeCompare(b.word));
  function quizSense(item){return item.senses.find(sense=>!cloze(item.word,sense.definition));}
  function quizCards(deck){const seen=new Set();return deck.filter(item=>item && quizSense(item) && !seen.has(item.word) && seen.add(item.word));}
  function quizPlan(deck,currentWord='',random=Math.random,mode='mixed'){
    const eligible=quizCards(deck);if(eligible.length<3)return [];
    const items=[...eligible];for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}
    const current=answer(currentWord);if(items[0]?.word===current){const index=items.findIndex(item=>item.word!==current);[items[0],items[index]]=[items[index],items[0]];}
    return items.map((item,index)=>question(item,eligible,index,random,mode)).filter(Boolean).slice(0,10);
  }
  function question(item,deck,index=0,random=Math.random,mode='mixed'){
    const eligible=item.senses.filter(sense=>!cloze(item.word,sense.definition));
    const contextual=eligible.filter(sense=>sense.examples.some(example=>cloze(item.word,example)));
    if(mode==='cloze' && !contextual.length)return null;
    const pool=(mode==='cloze' || mode==='mixed' && index%2===1) && contextual.length?contextual:eligible;
    const sense=pool[Math.floor(random()*Math.min(pool.length,3))];if(!sense)return null;
    const example=sense.examples.find(value=>cloze(item.word,value));
    if(example && (mode==='cloze' || mode==='mixed' && index%2===1))return {type:'cloze',word:item.word,pos:sense.pos,prompt:cloze(item.word,example),definition:sense.definition,original:example,source:sense.source};
    const distractors=deck.filter(other=>other.word!==item.word && other.senses.some(s=>s.pos===sense.pos) && !item.senses.some(s=>s.synonyms.includes(other.word)) && !other.senses.some(s=>answer(s.definition)===answer(sense.definition) || s.synonyms.includes(item.word))).map(other=>other.word);
    const shuffle=values=>{const list=[...new Set(values)];for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
    const choices=shuffle(distractors).slice(0,3);
    const accepted=[item.word,...(!example?deck.filter(other=>other.senses.some(s=>s.pos===sense.pos && (sense.synonyms.includes(other.word) || answer(s.definition)===answer(sense.definition)))).map(other=>other.word):[])];
    return {type:mode!=='type' && choices.length>=2?'choice':'type',word:item.word,pos:sense.pos,prompt:sense.definition,definition:sense.definition,context:example?cloze(item.word,example):null,original:example || null,source:sense.source,accepted:[...new Set(accepted)],choices:choices.length>=2?shuffle([item.word,...choices]):[]};
  }
  function matchingPlan(deck,random=Math.random){
    const candidates=[...quizCards(deck)];for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    const selected=[];
    for(const item of candidates){
      const sense=item.senses.find(s=>!cloze(item.word,s.definition) && !selected.some(pair=>answer(pair.definition)===answer(s.definition) || s.synonyms.includes(pair.word) || pair.synonyms.includes(item.word) || pair.card.senses.some(other=>answer(other.definition)===answer(s.definition))));
      if(!sense || selected.some(pair=>item.senses.some(s=>s.synonyms.includes(pair.word) || answer(s.definition)===answer(pair.definition))))continue;
      selected.push({word:item.word,pos:sense.pos,definition:sense.definition,original:sense.examples[0] || null,source:sense.source,synonyms:sense.synonyms,card:item});
      if(selected.length===6)break;
    }
    return selected.length>=3?selected.map(({card,synonyms,...pair})=>pair):[];
  }
  function read(storage){
    try {const value=JSON.parse(storage.getItem(KEY)||'{}');if(value.version!==1 || !Array.isArray(value.cards))return [];
      const seen=new Set();return value.cards.slice(0,100).flatMap(item=>{const prepared=card({word:item?.word,entries:[{source:'',meanings:Array.isArray(item?.senses)?item.senses.map(s=>({pos:s?.pos,senses:[{...s,relationSource:s?.source}]})):[]}]},item);if(!prepared || seen.has(prepared.word))return [];seen.add(prepared.word);return [prepared];});
    }catch{return [];}
  }
  function write(storage,cards){try{storage.setItem(KEY,JSON.stringify({version:1,cards:cards.slice(0,100)}));return true;}catch{return false;}}
  root.HelenStudyCore={DAY,KEY,answer,cloze,senses,card,grade,due,question,quizSense,quizCards,quizPlan,matchingPlan,read,write};
  if(typeof module!=='undefined')module.exports=root.HelenStudyCore;
})(typeof window==='undefined'?globalThis:window);
