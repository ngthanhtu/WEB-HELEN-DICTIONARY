const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createPracticalService}=require('../lib/practical-ai'),core=require('../public/assets/practical-core');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const input=()=>({scenario:'work',level:'B1',requestId:crypto.randomUUID(),history:core.context(core.fresh('work')),text:'I work in a hospital.'});
const good=()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({reply:'What have you learned from your work?',translation:'Bạn đã học được gì từ công việc?',feedback:'Hãy bổ sung ví dụ.',phrase:{text:'gain experience',translation:'tích lũy kinh nghiệm'},corrections:[],collocations:[]})}]},finishReason:'STOP'}]});
const bad=status=>Response.json({error:{code:status,message:'PRIVATE_PROVIDER_DETAIL',status:status===429?'RESOURCE_EXHAUSTED':'UNAVAILABLE'}},{status});
test('provider timeout header is independent of the local watchdog; diagnostics reveal no input or credentials',async()=>{
 const service=createPracticalService({apiKey:'test-only',fetchImpl:async(_url,options)=>{assert.equal(new Headers(options.headers).get('X-Server-Timeout'),'60');throw Object.assign(Error('PRIVATE_PROVIDER_DETAIL'),{cause:{code:'UND_ERR_CONNECT_TIMEOUT',message:'PRIVATE_PROVIDER_DETAIL'},name:'TypeError'});}});
 await assert.rejects(service.reply(input()),{code:'PRACTICAL_SERVICE'});const status=service.diagnostics();assert.equal(status.lastFailure.network,'UND_ERR_CONNECT_TIMEOUT');assert.ok(!JSON.stringify(status).includes('PRIVATE_PROVIDER_DETAIL'));assert.ok(!JSON.stringify(status).includes('test-only'));
 const misconfigured=createPracticalService({apiKey:'test-only',model:'PRIVATE_CONFIG_VALUE'});assert.equal(misconfigured.diagnostics().model,null);
});
test('preparing a concrete Lite model applies minimal thinking without spending generations or overriding an explicit model',async()=>{
 let listed=0,generated=0,reserved=0;
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:()=>reserved++,fetchImpl:async(url,options)=>{
  if(!String(url).includes('generateContent')){listed++;return Response.json({models:[{name:'models/gemini-2.5-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/gemini-flash-lite-latest',supportedGenerationMethods:['generateContent']}]});}
  generated++;const body=JSON.parse(options.body);assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);assert.ok(!String(url).includes('flash-lite-latest'));return good();
 }});
 await Promise.all([service.prepare(),service.prepare()]);assert.equal(service.model,'gemini-2.5-flash-lite');assert.equal(listed,1);assert.equal(reserved,0);await service.reply(input());assert.equal(generated,1);assert.equal(reserved,1);
 const explicit=createPracticalService({apiKey:'test-only',model:'gemini-custom',fetchImpl:()=>assert.fail('must not list models')});await explicit.prepare();assert.equal(explicit.model,'gemini-custom');
});
test('SDK timeout/abort is classified accurately without exposing upstream details',async()=>{
 for(const name of ['TimeoutError','AbortError']){const service=createPracticalService({apiKey:'test-only',fetchImpl:async()=>{throw Object.assign(Error('PRIVATE_PROVIDER_DETAIL'),{name});}});await assert.rejects(service.reply(input()),e=>e.code==='PRACTICAL_TIMEOUT' && e.status===504 && !e.message.includes('PRIVATE'));}
});
test('an explicitly overloaded latest Lite model fails over once to an available Lite with independent quota reservation',async()=>{
 const models=['gemini-3.5-flash-lite','gemini-3.1-flash-lite'],used=[];let reservations=0;
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:()=>reservations++,fetchImpl:async(url)=>{
  if(!String(url).includes('generateContent'))return Response.json({models:models.map(name=>({name:'models/'+name,supportedGenerationMethods:['generateContent']}))});
  used.push(String(url));return used.length===1?bad(503):good();
 }});
 await service.prepare();assert.equal(service.model,models[0]);const response=await service.reply(input());assert.ok(response.reply);assert.equal(used.length,2);assert.equal(reservations,2);assert.ok(used[0].includes(models[0]));assert.ok(used[1].includes(models[1]));assert.equal(service.model,models[1]);
});
test('shared long-turn budgets leave upload and response time on the client and bound every stage',()=>{
 for(const [value,serverMs] of [[{text:'Hello'},10000],[{text:'word '.repeat(443)},18000],[{stage:'transcribe',durationMs:175000},30000],[{stage:'transcribe',durationMs:20000},12000],[{stage:'assess'},20000]]){
  const budget=core.requestBudget(value);assert.equal(budget.serverMs,serverMs);assert.equal(budget.clientMs,serverMs+5000);assert.ok(budget.clientMs<=35000);
 }
});
test('a long answer still returns coaching after the old seven-second cutoff',async t=>{
 let release,signal,calls=0;const service=createPracticalService({apiKey:'test-only',fetchImpl:async(_url,options)=>{calls++;signal=options.signal;return new Promise(resolve=>release=resolve);}});
 t.mock.timers.enable({apis:['setTimeout']});
 const value={...input(),text:'I have learned useful skills. '.repeat(89).trim()},pending=service.reply(value);
 while(!release)await tick();t.mock.timers.tick(8000);await tick();assert.equal(signal.aborted,false);release(good());
 assert.equal((await pending).transcript,value.text);assert.equal(calls,1);
});
test('one temporary overload retries once, reserves both calls, then reuses completed feedback',async()=>{
 let calls=0,quota=0;const timing={},value=input();const service=createPracticalService({apiKey:'test-only',beforeGenerate:async()=>quota++,fetchImpl:async()=>++calls===1?bad(503):good()});
 const reply=await service.reply(value,{timing});assert.ok(reply.reply);assert.equal(calls,2);assert.equal(quota,2);assert.ok(timing.backoffMs>=450);
 assert.deepEqual(await service.reply(value),reply);assert.equal(calls,2);
});
test('persistent provider overload stops after two attempts with a safe actionable error',async()=>{
 let calls=0;const service=createPracticalService({apiKey:'test-only',fetchImpl:async()=>{calls++;return bad(503);}});
 await assert.rejects(service.reply(input()),e=>e.code==='PRACTICAL_BUSY' && e.status===503 && !e.message.includes('PRIVATE'));assert.equal(calls,2);
});
test('provider quota, authentication and unknown network failures never trigger automatic retry',async()=>{
 for(const status of [429,401,403,'network']){
  let calls=0;const service=createPracticalService({apiKey:'test-only',fetchImpl:async()=>{calls++;if(status==='network')throw Error('PRIVATE_NETWORK');return bad(status);}});
  await assert.rejects(service.reply(input()),e=>e.code===(status===429?'PRACTICAL_QUOTA':'PRACTICAL_SERVICE') && !e.message.includes('PRIVATE'));assert.equal(calls,1);
 }
});
test('a retry shares the original total deadline and its late response cannot become success',async t=>{
 let calls=0,signal,release;const service=createPracticalService({apiKey:'test-only',timeoutMs:5000,fetchImpl:async(_url,options)=>{calls++;if(calls===1)return bad(503);signal=options.signal;return new Promise(resolve=>release=resolve);}});
 t.mock.timers.enable({apis:['setTimeout']});const pending=service.reply(input()),rejected=assert.rejects(pending,{code:'PRACTICAL_TIMEOUT'});
 for(let i=0;i<10;i++)await tick();t.mock.timers.tick(500);while(!release)await tick();t.mock.timers.tick(4500);await rejected;
 assert.equal(signal.aborted,true);assert.equal(calls,2);release(good());await tick();
});
test('truncated and invalid model output are not mislabeled as network overload or returned as feedback',async()=>{
 for(const [response,code] of [[{candidates:[{content:{parts:[{text:'{"reply":"unfinished'}]},finishReason:'MAX_TOKENS'}]},'PRACTICAL_OUTPUT_LIMIT'],[{candidates:[{content:{parts:[{text:'invalid json'}]},finishReason:'STOP'}]},'PRACTICAL_OUTPUT']]){
  let calls=0;const service=createPracticalService({apiKey:'test-only',fetchImpl:async()=>{calls++;return Response.json(response);}});
  await assert.rejects(service.reply(input()),{code});assert.equal(calls,1);
 }
});
