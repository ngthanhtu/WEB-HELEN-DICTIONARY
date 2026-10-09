(()=>{
  'use strict';
  const KEY='helen-metrics-v1',toggle=document.getElementById('metrics-opt-in');let storage;try{storage=localStorage;}catch{}let state,controller,busy=false;
  try{state=JSON.parse(storage?.getItem(KEY) || 'null');}catch{}
  if(state?.version!==1)state={version:1,enabled:false,firstDay:null,returns:[],queue:[]};
  const save=()=>{try{storage?.setItem(KEY,JSON.stringify(state));}catch{}};
  const today=()=>window.HelenHabits.day();
  function enabled(){return state.enabled===true && navigator.doNotTrack!=='1' && navigator.globalPrivacyControl!==true;}
  function event(name){if(!enabled() || !crypto.randomUUID)return;state.queue=[...(Array.isArray(state.queue)?state.queue:[]),{id:crypto.randomUUID(),name,day:today()}].slice(-50);save();void flush();}
  async function flush(){if(!enabled() || busy || navigator.onLine===false || !state.queue.length)return;busy=true;controller=new AbortController();const batch=state.queue.slice(0,20),timer=setTimeout(()=>controller.abort(),2500);
    try{const response=await fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch}),signal:controller.signal});if(response.ok && enabled()){const sent=new Set(batch.map(item=>item.id));state.queue=state.queue.filter(item=>!sent.has(item.id));save();}}
    catch{}finally{clearTimeout(timer);busy=false;controller=null;}}
  function visit(){if(!enabled())return;const day=today();if(!state.firstDay){state.firstDay=day;save();return;}
    const elapsed=Math.round((Date.parse(day)-Date.parse(state.firstDay))/86400000);
    if([1,6].includes(elapsed) && !state.returns.includes(elapsed)){state.returns.push(elapsed);save();event(elapsed===1?'return_day2':'return_day7');}}
  toggle.checked=enabled();toggle.disabled=navigator.doNotTrack==='1' || navigator.globalPrivacyControl===true;
  toggle.onchange=()=>{state.enabled=toggle.checked;state.queue=[];state.firstDay=null;state.returns=[];controller?.abort();save();visit();};
  document.addEventListener('helen:search-completed',()=>event('lookup'));
  let lastFavorites=[];try{lastFavorites=JSON.parse(storage.getItem('helen-favorites') || '[]');}catch{}
  document.addEventListener('helen:favorites',()=>{let next=[];try{next=JSON.parse(storage.getItem('helen-favorites') || '[]');}catch{}
    if(next.some(word=>!lastFavorites.includes(word)))event('favorite');lastFavorites=next;});
  document.addEventListener('helen:session-completed',eventData=>{if(eventData.detail?.mode!=='review')event('quiz_completed');});
  window.addEventListener('online',()=>void flush());window.addEventListener('pageshow',()=>{visit();void flush();});
  window.addEventListener('storage',eventData=>{if(eventData.key===KEY){controller?.abort();try{state=JSON.parse(storage.getItem(KEY));}catch{state={version:1,enabled:false,firstDay:null,returns:[],queue:[]};}toggle.checked=enabled();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){visit();void flush();}});
  visit();void flush();
})();
