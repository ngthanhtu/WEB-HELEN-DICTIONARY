(function(root,factory){
  const core=factory();
  if(typeof module==='object' && module.exports)module.exports=core;
  else root.HelenSenses=core;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const text=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  // Definitions identify a sense across enrichment, cache refreshes and reordered groups.
  const key=(pos,definition)=>JSON.stringify([text(pos).toLowerCase(),text(definition)]);
  function choices(entry){
    return (entry?.meanings || []).flatMap((meaning,meaningIndex)=>(meaning.senses || []).flatMap((sense,senseIndex)=>{
      if(!text(sense.definition))return [];
      return [{meaningIndex,senseIndex,pos:meaning.pos || '',definition:sense.definition,
        value:key(meaning.pos,sense.definition),label:`${meaning.pos || 'sense'} · ${senseIndex+1}`,
        examples:[...new Set((sense.examples?.length?sense.examples:[sense.example]).filter(value=>text(value)))],
        source:sense.source || entry.source || 'Dictionary'}];
    }));
  }
  function resolve(entry,{senseKey,meaningIndex=0,senseIndex=0}={}){
    const list=choices(entry);
    // A missing identity must never silently select a different sense at the old index.
    return typeof senseKey==='string'?list.find(sense=>sense.value===senseKey):list.find(sense=>sense.meaningIndex===meaningIndex && sense.senseIndex===senseIndex);
  }
  return {key,choices,resolve};
});
