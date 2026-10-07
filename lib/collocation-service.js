const {teachingCollocations,corpusPhrases,exampleCombinations}=require('./collocations');
const REVISION=2,TTL=7*86400000;
function createCollocationService({get,store,now=Date.now}) {
  const saved=new Map(),pending=new Map();
  const valid=value=>value && value.revision===REVISION && Array.isArray(value.corpus) && value.corpus.every(item=>item && typeof item.phrase==='string' && item.source?.startsWith('Datamuse'));
  function base(word,meanings) {
    const teaching=teachingCollocations(word),known=new Set(teaching.map(item=>item.phrase.toLowerCase()));
    return {teaching,examples:exampleCombinations(word,meanings).filter(item=>!known.has(item.phrase.toLowerCase())),corpus:[],pending:false,unavailable:false,revision:REVISION};
  }
  async function remote(word) {
    const load=async(relation,budget)=>{
      let timer;
      try {return await Promise.race([(async()=>{
        const response=await get(`https://api.datamuse.com/words?${relation}=${encodeURIComponent(word)}&max=40`,{},budget);
        if(!response?.ok)return null;
        const data=await response.json();return Array.isArray(data)?data:null;
      })(),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),budget);})]);}catch{return null;}finally{clearTimeout(timer);}
    };
    let results=await Promise.all(['rel_bgb','rel_bga'].map(relation=>load(relation,1400)));
    if(results.some(value=>value===null))results=await Promise.all(results.map((value,index)=>value===null?load(['rel_bgb','rel_bga'][index],1000):value));
    return {revision:REVISION,corpus:[...corpusPhrases(word,results[0],true),...corpusPhrases(word,results[1],false)],unavailable:results.some(value=>value===null)};
  }
  function refresh(word) {
    if(pending.has(word))return pending.get(word);
    const job=(async()=>{
      let value;try{value=await remote(word);}catch{value={revision:REVISION,corpus:[],unavailable:true};}
      const previous=saved.get(word);
      // A temporary failure must never erase known-good corpus combinations.
      if(value.unavailable && previous?.value.corpus.length)return previous.value;
      if(!value.unavailable || value.corpus.length) {
        saved.set(word,{value,at:now()});if(saved.size>500)saved.delete(saved.keys().next().value);
        if(!value.unavailable)void store?.set('collocations-v2',word,value,TTL);
      }
      return value;
    })().finally(()=>pending.delete(word));
    pending.set(word,job);return job;
  }
  async function lookup(word,meanings=[]) {
    const local=base(word,meanings);
    const merge=value=>({...local,...value,corpus:value.corpus.filter(item=>!local.teaching.some(known=>known.phrase.toLowerCase()===item.phrase.toLowerCase()))});
    if(!/^[a-z]{2,48}$/.test(word))return local;
    let previous=saved.get(word);
    if(!previous) {
      const durable=await store?.get('collocations-v2',word,1000);
      if(valid(durable?.value)) {previous={value:durable.value,at:durable.fresh?now():0};saved.set(word,previous);}
    }
    if(previous) {
      if(now()-previous.at>=TTL || previous.value.unavailable)void refresh(word);
      return {...merge(previous.value),stale:now()-previous.at>=TTL};
    }
    return merge(await refresh(word));
  }
  return {lookup,base,revision:REVISION};
}
module.exports={createCollocationService};
