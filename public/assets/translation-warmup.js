(function(root,factory){
  'use strict';
  if(typeof module==='object' && module.exports)module.exports=factory;
  else root.HelenTranslationWarmup=factory({translate:(...args)=>root.tr(...args),target:()=>root.document.querySelector('#target')?.value || 'vi',online:()=>root.navigator.onLine!==false,Observer:root.IntersectionObserver});
})(typeof globalThis==='undefined'?this:globalThis,function({translate,target,online=()=>true,Observer,delay=80,batchSize=4}={}){
  const waiting=new Map(),visible=new Map(),attempted=new Set();let timer,active=0;
  const key=(texts,to,context)=>JSON.stringify([texts,to,context]);
  function prepare(texts,context={}){
    const to=target();if(to==='en' || !online() || !texts.length)return;
    const id=key(texts,to,context);if(attempted.has(id))return;
    attempted.add(id);if(attempted.size>500)attempted.delete(attempted.values().next().value);
    waiting.set(id,{texts,to,context});schedule();
  }
  function schedule(){if(active<2 && !timer && waiting.size)timer=setTimeout(flush,delay);}
  async function flush(){
    timer=null;if(active>=2)return;
    if(!online()){waiting.clear();return;}
    const first=waiting.values().next().value;if(!first)return;
    active++;const texts=[];
    for(const [id,item] of waiting){
      if(item.to!==target()){waiting.delete(id);continue;}
      if(item.to!==first.to || JSON.stringify(item.context)!==JSON.stringify(first.context))continue;
      if(texts.length && texts.length+item.texts.length>batchSize)break;
      waiting.delete(id);texts.push(...item.texts);
      if(texts.length>=batchSize)break;
    }
    schedule();
    try{if(texts.length)await translate([...new Set(texts)],'en',first.to,first.context);}
    catch{/* A click retries normally. Background failures never replace a valid translation. */}
    finally{active--;schedule();}
  }
  const observer=Observer?new Observer(entries=>{
    for(const entry of entries){const info=visible.get(entry.target);if(!info)continue;info.shown=entry.isIntersecting;if(info.shown)prepare(info.texts,info.context);}
    for(const [element] of visible)if(element.isConnected===false){observer.unobserve(element);visible.delete(element);}
  },{rootMargin:'40px'}):null;
  function observe(element,texts,context={}){
    if(!element)return;
    const info={texts,context,shown:false};visible.set(element,info);observer?.observe(element);
    for(const event of ['pointerenter','focus','touchstart'])element.addEventListener?.(event,()=>prepare(texts,context),{passive:true});
  }
  function refresh(){
    for(const [element,info] of visible){if(element.isConnected===false){observer?.unobserve(element);visible.delete(element);}else if(info.shown)prepare(info.texts,info.context);}
  }
  return {observe,prepare,refresh};
});
