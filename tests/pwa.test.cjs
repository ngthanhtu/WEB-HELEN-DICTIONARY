const {test}=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
function worker(network) {
  const events={}, stores=new Map();
  const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{
    if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name), key=value=>typeof value==='string'?value:value.url;
    return {match:async request=>data.get(key(request))?.clone(),put:async(request,response)=>{data.set(key(request),response.clone());},delete:async request=>data.delete(key(request)),keys:async()=>[...data.keys()],addAll:async()=>{}};
  }};
  const context=vm.createContext({caches,fetch:network,Response,Headers,URL,Date,console,self:{location:{origin:'https://helen.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:()=>{context.activated=true;}}});
  vm.runInContext(fs.readFileSync('public/sw.js','utf8').replace('__BUILD_VERSION__','test'),context);
  const request=url=>({method:'GET',url:`https://helen.test${url}`});
  return {context,caches,events,request,get:url=>{context.input=request(url);return vm.runInContext('word(input)',context);}};
}
test('saved words open offline, are isolated by source language and never cache failures',async()=>{
  let online=true,calls=0;
  const w=worker(async()=>{calls++;if(!online)throw Error('offline');return Response.json({word:'loan',entries:[{meaning:'a sum of money'}]});});
  assert.equal((await w.get('/api/lookup?word=loan&from=en')).status,200);
  online=false;const saved=await w.get('/api/lookup?word=loan&from=en');assert.equal(saved.headers.get('X-Helen-Cache'),'saved');assert.equal((await saved.json()).word,'loan');assert.equal(calls,1);
  const unknown=await w.get('/api/lookup?word=loan&from=vi');assert.equal(unknown.status,503);
  online=true;assert.equal((await w.get('/api/lookup?word=loan&from=vi')).status,200);assert.equal(calls,3);
});
test('expired words refresh online and remain available offline without replacing entries with errors',async()=>{
  let response=Response.json({word:'old'});
  const w=worker(async()=>{if(response instanceof Error)throw response;return response.clone();});
  const cache=await w.caches.open('helen-words-v1'), req=w.request('/api/lookup?word=old');
  await cache.put(req,new Response('{"word":"old"}',{headers:{'X-Helen-Saved-At':'1','Content-Type':'application/json'}}));
  response=new Error('offline');assert.equal((await (await w.get('/api/lookup?word=old')).json()).word,'old');
  response=Response.json({error:'provider failed'},{status:502});assert.equal((await w.get('/api/lookup?word=old')).status,502);assert.equal((await (await cache.match(req)).json()).word,'old');
  response=Response.json({word:'updated'});assert.equal((await (await w.get('/api/lookup?word=old')).json()).word,'updated');
});
test('runtime word cache is bounded and never captures voice, AI, credentials or POST requests',async()=>{
  const w=worker(async()=>Response.json({word:'test'}));
  for(let i=0;i<105;i++)await w.get(`/api/lookup?word=word${i}`);
  assert.equal((await (await w.caches.open('helen-words-v1')).keys()).length,100);
  for(const path of ['/api/voices','/api/tts?voice=Sarah','/api/context/status','/healthz','/assets/appearance.json']) {
    let intercepted=false;w.events.fetch({request:w.request(path),respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false,path);
  }
  let intercepted=false;w.events.fetch({request:{...w.request('/api/context'),method:'POST'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
});
test('app updates remove old shell assets while preserving saved words',async()=>{
  const w=worker(async()=>Response.json({word:'test'}));
  for(const name of ['helen-old-shell','helen-old-files','helen-test-shell','helen-words-v1','unrelated-cache'])await w.caches.open(name);
  let done;w.events.activate({waitUntil:promise=>done=promise});await done;
  assert.deepEqual((await w.caches.keys()).sort(),['helen-test-shell','helen-words-v1','unrelated-cache']);
  w.events.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.context.activated,true);
});
