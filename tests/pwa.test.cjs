const {test}=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
const entry=(word='loan',extra={})=>({query:word,from:'en',word,enriching:false,lexicalRevision:2,collocationRevision:2,entries:[{word,meanings:[{pos:'noun',senses:[{definition:'A sum of money lent to someone.'}]}]}],...extra});
function worker(network,{quickTimers=false}={}) {
  const events={}, stores=new Map(), deadlines=[];
  const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{
    if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name), key=value=>typeof value==='string'?value:value.url;
    return {match:async request=>data.get(key(request))?.clone(),put:async(request,response)=>{data.set(key(request),response.clone());},delete:async request=>data.delete(key(request)),keys:async()=>[...data.keys()],addAll:async()=>{}};
  }};
  const context=vm.createContext({caches,fetch:network,Response,Headers,URL,URLSearchParams,AbortController,Date,console,setTimeout:(fn,ms)=>{deadlines.push(ms);return setTimeout(fn,quickTimers?5:ms);},clearTimeout,self:{location:{origin:'https://helen.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:()=>{context.activated=true;}}});
  vm.runInContext(fs.readFileSync('public/sw.js','utf8').replace('__BUILD_VERSION__','test'),context);
  const request=url=>({method:'GET',url:`https://helen.test${url}`});
  return {context,caches,events,request,deadlines,get:(url,event)=>{context.input=request(url);context.fetchEvent=event;return vm.runInContext('word(input,fetchEvent)',context);},message:async data=>{let done,reply;events.message({data,ports:[{postMessage:value=>reply=value}],waitUntil:value=>done=value,source:{url:'https://helen.test/'}});await done;return reply;}};
}
test('refresh serves fresh online HTML while keeping the previous complete app usable offline',async()=>{
  let online=true;const w=worker(async()=>{if(!online)throw Error('offline');return new Response('new page',{headers:{'Content-Type':'text/html','X-Helen-Build':'next'}});});
  const cache=await w.caches.open('helen-test-shell');await cache.put('/',new Response('installed page'));
  const navigate=()=>{let response;w.events.fetch({request:{...w.request('/'),mode:'navigate'},waitUntil(){},respondWith:promise=>response=promise});return response;};
  assert.equal(await (await navigate()).text(),'new page');assert.equal(await (await cache.match('/')).text(),'installed page');
  online=false;assert.equal(await (await navigate()).text(),'installed page');
});
test('a slow reload uses the installed page promptly without caching server errors',async()=>{
  let finish;const w=worker(()=>new Promise(resolve=>finish=resolve),{quickTimers:true});const cache=await w.caches.open('helen-test-shell');await cache.put('/',new Response('installed page'));
  let response,background;w.events.fetch({request:{...w.request('/'),mode:'navigate'},waitUntil:promise=>background=promise,respondWith:promise=>response=promise});
  assert.equal(await (await response).text(),'installed page');assert.ok(w.deadlines.includes(2200));finish(new Response('server error',{status:503}));await background;assert.equal(await (await cache.match('/')).text(),'installed page');
});
test('script and stylesheet version queries bypass stale asset caches',async()=>{
  const w=worker(async()=>new Response('new script')),cache=await w.caches.open('helen-test-shell');await cache.put('https://helen.test/assets/study.js?v=old',new Response('old script'));
  let response;w.events.fetch({request:w.request('/assets/study.js?v=new'),respondWith:value=>response=value});assert.equal(await (await response).text(),'new script');
  assert.ok(vm.runInContext("shell.includes('/assets/study.js?v=test')",w.context));
  assert.ok(vm.runInContext("shell.includes('/assets/sense-core.js?v=test')",w.context));
  assert.ok(vm.runInContext("shell.includes('/assets/offline-audio.js?v=test')",w.context));
  assert.ok(vm.runInContext("shell.includes('/assets/quiz-sounds.js?v=test')",w.context));
  assert.ok(vm.runInContext("shell.includes('/assets/quiz-translation.js?v=test')",w.context));
});
test('saved words open offline, are isolated by source language and never cache failures',async()=>{
  let online=true,calls=0;
  const w=worker(async()=>{calls++;if(!online)throw Error('offline');return Response.json(entry());});
  assert.equal((await w.get('/api/lookup?word=loan&from=en')).status,200);
  online=false;const saved=await w.get('/api/lookup?word=loan&from=en');assert.equal(saved.headers.get('X-Helen-Cache'),'saved');assert.equal((await saved.json()).word,'loan');assert.equal(calls,1);
  const unknown=await w.get('/api/lookup?word=loan&from=vi');assert.equal(unknown.status,503);
  online=true;assert.equal((await w.get('/api/lookup?word=loan&from=vi')).status,200);assert.equal(calls,3);
});
test('expired words fall back on provider HTTP errors and stay saved until an online refresh succeeds',async()=>{
  let response=Response.json(entry('old'));
  const w=worker(async()=>{if(response instanceof Error)throw response;return response.clone();});
  const cache=await w.caches.open('helen-words-v1'), key='https://helen.test/api/lookup?word=old&from=en';
  await cache.put(key,new Response(JSON.stringify(entry('old')),{headers:{'X-Helen-Saved-At':'1','Content-Type':'application/json'}}));
  response=new Error('offline');assert.equal((await (await w.get('/api/lookup?word=old')).json()).word,'old');
  response=Response.json({error:'provider failed'},{status:502});const fallback=await w.get('/api/lookup?word=old');assert.equal(fallback.status,200);assert.equal(fallback.headers.get('X-Helen-Cache'),'saved');assert.equal((await (await cache.match(key)).json()).word,'old');
  response=Response.json(entry('updated'));assert.equal((await (await w.get('/api/lookup?word=old')).json()).word,'updated');
});
test('a slow refresh opens the saved word promptly and refreshes its cache in the background',async()=>{
  let finish, signal;const w=worker((request,options)=>{signal=options.signal;return new Promise(resolve=>finish=resolve);},{quickTimers:true});
  const cache=await w.caches.open('helen-words-v1'), key='https://helen.test/api/lookup?word=old&from=en';
  await cache.put(key,new Response(JSON.stringify(entry('old')),{headers:{'X-Helen-Saved-At':'1'}}));
  let background;const saved=await w.get('/api/lookup?word=old',{waitUntil:value=>background=value});
  assert.equal((await saved.json()).word,'old');assert.ok(w.deadlines.includes(2400));assert.equal(signal.aborted,false);
  finish(Response.json(entry('refreshed')));await background;assert.equal((await (await cache.match(key)).json()).word,'refreshed');
});
test('an uncached slow lookup stops waiting within its deadline and gives a short retry message',async()=>{
  let signal;const w=worker((request,options)=>{signal=options.signal;return new Promise(()=>{});},{quickTimers:true});
  const response=await w.get('/api/lookup?word=unknown');assert.equal(response.status,503);assert.equal(signal.aborted,true);assert.ok(w.deadlines.includes(6500));assert.match((await response.json()).error,/Kết nối chậm/);
});
test('a first lookup handed over by the page is saved before service worker control',async()=>{
  const w=worker(async()=>{throw Error('offline');});
  const reply=await w.message({type:'SAVE_LOOKUP',url:'/api/lookup?word=Loan&from=en',result:entry()});assert.equal(reply.saved,true);
  const saved=await w.get('/api/lookup?word=loan');assert.equal((await saved.json()).word,'loan');
  const inventory=await w.message({type:'OFFLINE_WORDS'});assert.equal(inventory.words.length,1);assert.equal(inventory.words[0].from,'en');
});
test('detailed entries upgrade the fast result without duplicate keys or partial overwrites',async()=>{
  const w=worker(async()=>Response.json(entry('loan',{enriching:true})));
  await w.get('/api/lookup?word=loan&from=en');
  const full=entry('loan');full.entries[0].meanings[0].senses[0].examples=['The bank approved a loan.'];
  await w.message({type:'SAVE_LOOKUP',url:'/api/lookup?word=loan&from=en&details=1',result:full});
  await w.message({type:'SAVE_LOOKUP',url:'/api/lookup?word=loan&from=en',result:entry('loan',{enriching:true})});
  const data=await (await w.get('/api/lookup?word=loan&from=en&details=1')).json();assert.equal(data.enriching,false);assert.deepEqual(data.entries[0].meanings[0].senses[0].examples,['The bank approved a loan.']);
  assert.equal((await (await w.caches.open('helen-words-v1')).keys()).length,1);
});
test('saved partial entries stop pending enrichment and cached reads do not renew their age',async()=>{
  let online=true;const w=worker(async()=>{if(!online)throw Error('offline');const data=entry('loan',{enriching:true});data.entries[0].meanings[0].relationsPending=true;data.entries[0].collocations={teaching:[],corpus:[],pending:true};return Response.json(data);});
  await w.get('/api/lookup?word=loan');online=false;
  const saved=await (await w.get('/api/lookup?word=loan&details=1')).json();assert.equal(saved.enriching,false);assert.equal(saved.offlinePartial,true);assert.equal(saved.entries[0].meanings[0].relationsPending,false);assert.equal(saved.entries[0].collocations.pending,false);
  const cache=await w.caches.open('helen-words-v1'), key='https://helen.test/api/lookup?word=loan&from=en', before=(await cache.match(key)).headers.get('X-Helen-Saved-At');
  assert.equal((await w.message({type:'SAVE_LOOKUP',url:'/api/lookup?word=loan',result:saved})).saved,false);
  assert.equal((await cache.match(key)).headers.get('X-Helen-Saved-At'),before);
});
test('runtime word cache is bounded and never captures voice, AI, credentials or POST requests',async()=>{
  const w=worker(async()=>Response.json(entry()));
  for(let i=0;i<105;i++)await w.get(`/api/lookup?word=word${i}`);
  assert.equal((await (await w.caches.open('helen-words-v1')).keys()).length,100);
  for(const path of ['/api/voices','/api/tts?voice=Sarah','/api/context/status','/healthz']) {
    let intercepted=false;w.events.fetch({request:w.request(path),respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false,path);
    w.events.fetch({request:{...w.request(path),mode:'navigate'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false,`navigation ${path}`);
  }
  let intercepted=false;w.events.fetch({request:{...w.request('/api/context'),method:'POST'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
});
test('failed or malformed page lookups cannot contaminate the offline inventory',async()=>{
  const w=worker(async()=>Response.json({error:'failed'},{status:502}));
  await w.get('/api/lookup?word=bad');await w.message({type:'SAVE_LOOKUP',url:'/api/lookup?word=bad',result:{word:'bad',error:'failed'}});
  assert.equal((await w.message({type:'OFFLINE_WORDS'})).words.length,0);
});
test('optional offline pack needs a valid bounded pack and preserves personal saved lookups',async()=>{
  const w=worker(async()=>{throw Error('offline');});
  await w.message({type:'SAVE_LOOKUP',url:'/api/lookup?word=loan',result:entry('loan')});
  const pack={version:1,entries:[{word:'loan',gloss:'khoản vay',result:entry('loan')},{word:'happy',gloss:'vui vẻ',result:entry('happy')}]};
  const outcome=await w.message({type:'SAVE_OFFLINE_PACK',pack});assert.equal(outcome.added,1);assert.equal(outcome.skipped,1);
  const happy=await (await w.get('/api/lookup?word=happy')).json();assert.equal(happy.offlineGloss,'vui vẻ');assert.equal(happy.offlinePack,true);
  for(let i=0;i<98;i++)await w.message({type:'SAVE_LOOKUP',url:`/api/lookup?word=word${i}`,result:entry(`word${i}`)});
  const full=await w.message({type:'SAVE_OFFLINE_PACK',pack:{version:1,entries:[{word:'new',gloss:'mới',result:entry('new')}]}});assert.equal(full.added,0);assert.equal(full.skipped,1);assert.equal((await w.message({type:'OFFLINE_WORDS'})).words.length,100);
  assert.equal((await (await w.get('/api/lookup?word=loan')).json()).word,'loan');
});
test('app updates consolidate old lookup keys while preserving saved words',async()=>{
  const w=worker(async()=>Response.json(entry()));
  for(const name of ['helen-old-shell','helen-old-files','helen-test-shell','helen-words-v1','helen-audio-v1','unrelated-cache'])await w.caches.open(name);
  const audio=await w.caches.open('helen-audio-v1');await audio.put('https://helen.test/__helen_audio__?text=loan&voice=Sarah',new Response('saved clip'));
  const words=await w.caches.open('helen-words-v1');await words.put('https://helen.test/api/lookup?word=loan',Response.json(entry('loan',{enriching:true})));await words.put('https://helen.test/api/lookup?word=loan&details=1',Response.json(entry('loan')));
  let done;w.events.activate({waitUntil:promise=>done=promise});await done;
  assert.deepEqual((await w.caches.keys()).sort(),['helen-audio-v1','helen-test-shell','helen-words-v1','unrelated-cache']);assert.equal((await words.keys()).length,1);assert.equal((await (await w.get('/api/lookup?word=loan')).json()).enriching,false);
  assert.equal(await (await audio.match('https://helen.test/__helen_audio__?text=loan&voice=Sarah')).text(),'saved clip');
  await w.message({type:'ACTIVATE_UPDATE'});assert.equal(w.context.activated,true);
});
test('new lexical revision refreshes old empty relation lists while preserving their offline fallback',async()=>{
  let online=true,calls=0;
  const fresh=entry('drawback');fresh.entries[0].meanings[0].senses[0].synonyms=['hindrance'];
  const w=worker(async()=>{calls++;if(!online)throw Error('offline');return Response.json(fresh);});
  const cache=await w.caches.open('helen-words-v1'),key='https://helen.test/api/lookup?word=drawback&from=en';
  await cache.put(key,new Response(JSON.stringify(entry('drawback',{lexicalRevision:1})),{headers:{'X-Helen-Saved-At':String(Date.now())}}));
  assert.deepEqual((await (await w.get('/api/lookup?word=drawback')).json()).entries[0].meanings[0].senses[0].synonyms,['hindrance']);assert.equal(calls,1);
  online=false;assert.deepEqual((await (await w.get('/api/lookup?word=drawback')).json()).entries[0].meanings[0].senses[0].synonyms,['hindrance']);assert.equal(calls,1);
});
