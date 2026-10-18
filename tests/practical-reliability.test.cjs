const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createUsagePolicy}=require('../lib/usage-policy'),{createDatabase}=require('../lib/database');
const {createPracticalService}=require('../lib/practical-ai');
const errors=require('../public/assets/api-errors'),i18n=require('../public/assets/i18n');
const device='a'.repeat(64),network='b'.repeat(64);
const answer='I work in a small technology company where I help customers solve problems with their online accounts. Last year our team introduced a new training programme, and I helped explain the changes to several colleagues. At first I found it difficult to speak confidently in meetings, but I started preparing short notes and asking more questions. This helped me express my ideas more clearly. In the future I would like to lead a project because I enjoy working with different people and finding practical solutions together.';
const input=()=>({stage:'assess',scenario:'work',level:'B1',requestId:crypto.randomUUID(),turns:[{question:'Tell me about yourself.',text:answer}],interfaceLanguage:'vi',translationLanguage:'vi'});
const report=()=>({summary:'Bạn phát triển ý rõ ràng.',criteria:Object.fromEntries(['fluency','vocabulary','grammar','pronunciation'].map(key=>[key,{band:6,feedback:'Thử phát triển một ví dụ cụ thể.',quote:'I work in a small technology company'}])),nextSteps:['Luyện trả lời với một ví dụ.']});
const generated=value=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify(value)}]},finishReason:'STOP'}]});
const providerError=status=>Response.json({error:{code:status,status:status===429?'RESOURCE_EXHAUSTED':'NOT_FOUND',message:'PRIVATE_PROVIDER_DETAIL'}},{status});
function ledger(){
 const counts=new Map(),seen=[],releases=[];
 const database={reserveUsage:async(rules,{details=false}={})=>{
  seen.push(rules);const denied=rules.find(rule=>(counts.get(rule.bucket+':'+rule.key)||0)+rule.units>rule.limit);
  if(denied)return details?{accepted:false,bucket:denied.bucket,resetAt:denied.expiresAt}:false;
  for(const rule of rules)counts.set(rule.bucket+':'+rule.key,(counts.get(rule.bucket+':'+rule.key)||0)+rule.units);return true;
 },releaseAssessment:async({key,units})=>{releases.push(key);const id='practical-report-device:'+key;counts.set(id,Math.max(0,(counts.get(id)||0)-units));}};
 return {database,counts,seen,releases};
}
test('daily rejection identifies shared, network and device limits and the next reset, including 10:18 Vietnam time',async()=>{
 let now=Date.UTC(2026,9,18,3,18);
 for(const [bucket,scope] of [['practical-day','shared'],['practical-assess-ip','network'],['practical-report-device','device']]){
  const policy=createUsagePolicy({env:{NODE_ENV:'production'},now:()=>now,database:{reserveUsage:async rules=>({accepted:false,bucket,resetAt:rules[0].expiresAt})}});
  await assert.rejects(policy.reserve('practical-assessment',1,device,network),error=>{
   assert.equal(error.code,'USAGE_LIMIT');assert.equal(error.scope,scope);assert.equal(error.resetAt,'2026-10-19T00:00:00.000Z');assert.ok(!error.message.includes('07:00'));return true;
  });
 }
 const store=ledger(),policy=createUsagePolicy({env:{NODE_ENV:'production'},now:()=>now,database:store.database});
 for(let i=0;i<10;i++)await policy.reserve('practical-assessment',1,device,network);
 await assert.rejects(policy.reserve('practical-assessment',1,device,network),{scope:'device'});
 now=Date.UTC(2026,9,19);await policy.reserve('practical-assessment',1,device,network);
});
test('provider/model failures restore only the personal report allowance, once, while shared and network attempts remain charged',async()=>{
 const store=ledger(),policy=createUsagePolicy({env:{NODE_ENV:'production'},database:store.database});
 const lease=await policy.reserve('practical-assessment',1,device,network);
 await policy.reserve('practical-assessment',1,device,network,{retry:true});
 await lease.release();await lease.release();
 assert.equal(store.releases.length,1);
 const bucket=name=>[...store.counts].find(([id])=>id.startsWith(name+':'))?.[1];
 assert.equal(bucket('practical-report-device'),0);assert.equal(bucket('practical-day'),2);assert.equal(bucket('practical-assess-ip'),2);
 // Failed legacy attempts are not imported as completed reports. Cost caps
 // still use their existing buckets and cannot be reset by this migration.
 assert.ok(!store.seen.flat().some(rule=>rule.bucket==='practical-assess-device'));
});
test('eleven failed AI evaluations do not consume ten successful report slots; valid reports are charged and deduplicated across new request IDs',async()=>{
 const store=ledger(),policy=createUsagePolicy({env:{NODE_ENV:'production'},database:store.database});let calls=0,working=false;
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:({retry})=>policy.reserve('practical-assessment',1,device,network,{retry}),fetchImpl:async()=>{calls++;return working?generated(report()):providerError(429);}});
 for(let i=0;i<11;i++)await assert.rejects(service.reply(input(),{device,network}),{code:'PRACTICAL_QUOTA'});
 assert.equal(store.releases.length,11);working=true;
 const value=await service.reply(input(),{device,network});assert.equal(value.stage,'assess');assert.equal(value.overall,null);
 assert.deepEqual(await service.reply(input(),{device,network}),value);assert.equal(calls,12);assert.equal(store.releases.length,11);
 assert.equal([...store.counts].find(([key])=>key.startsWith('practical-report-device:'))[1],1);
});
test('a shared cap rejects an unused device without reaching the provider or claiming its reports were used',async()=>{
 let calls=0;const store=ledger(),policy=createUsagePolicy({env:{NODE_ENV:'production',PRACTICAL_DAILY_GENERATION_LIMIT:'1'},database:store.database});
 await policy.reserve('practical',1,'other-device',network);
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:()=>policy.reserve('practical-assessment',1,device,network),fetchImpl:()=>{calls++;return generated(report());}});
 await assert.rejects(service.reply(input(),{device,network}),{code:'USAGE_LIMIT',scope:'shared'});assert.equal(calls,0);assert.equal(store.releases.length,0);
 assert.equal(service.diagnostics().lastFailure.scope,'shared');
});
test('an unconfirmed quota result fails closed as unavailable, never as a daily allowance or unmetered generation',async()=>{
 for(const value of [undefined,null,{},0]){
  const policy=createUsagePolicy({env:{NODE_ENV:'production'},database:{reserveUsage:async()=>value}});
  await assert.rejects(policy.reserve('practical-assessment',1,device,network),{code:'USAGE_UNAVAILABLE',status:503});
 }
});
test('model discovery skips a 404 even when it is still listed, reserves one report and preserves the replacement on the next request',async()=>{
 let calls=0,leases=0,released=0;const used=[];
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:({retry})=>{if(!retry)leases++;return {release:async()=>released++};},fetchImpl:async url=>{
  if(!String(url).includes('generateContent'))return Response.json({models:['gemini-3.1-flash-lite','gemini-2.5-flash-lite'].map(name=>({name:'models/'+name,supportedGenerationMethods:['generateContent']}))});
  calls++;used.push(String(url));return String(url).includes('gemini-3.1')?providerError(404):generated(report());
 }});
 assert.equal((await service.reply(input(),{device})).stage,'assess');assert.equal(calls,2);assert.equal(leases,1);assert.equal(released,0);assert.equal(service.model,'gemini-2.5-flash-lite');
 await service.reply({...input(),turns:[{question:'Another question?',text:answer}]},{device});assert.equal(calls,3);assert.ok(used.at(-1).includes('gemini-2.5'));assert.equal(leases,2);
});
test('preparation chooses an available concrete model before charging a generation when the default is absent',async()=>{
 let calls=0;
 const service=createPracticalService({apiKey:'test-only',fetchImpl:async url=>{
  if(!String(url).includes('generateContent'))return Response.json({models:[{name:'models/gemini-2.5-flash-lite',supportedGenerationMethods:['generateContent']}]});
  calls++;assert.match(String(url),/gemini-2\.5-flash-lite/);return generated(report());
 }});await service.prepare();assert.equal(service.model,'gemini-2.5-flash-lite');await service.reply(input(),{device});assert.equal(calls,1);
});
test('permanently missing and explicitly configured models fail clearly without model or provider-quota retry loops',async()=>{
 let calls=0,lists=0;
 const service=createPracticalService({apiKey:'test-only',fetchImpl:async url=>{
  if(!String(url).includes('generateContent')){lists++;return Response.json({models:[{name:'models/gemini-3.1-flash-lite',supportedGenerationMethods:['generateContent']}]});}
  calls++;return providerError(404);
 }});
 await assert.rejects(service.reply(input(),{device}),{code:'PRACTICAL_MODEL'});await assert.rejects(service.reply(input(),{device}),{code:'PRACTICAL_MODEL'});assert.equal(calls,1);assert.equal(lists,1);
 const explicit=createPracticalService({apiKey:'test-only',model:'gemini-selected',fetchImpl:async url=>{assert.match(String(url),/generateContent/);return providerError(404);}});
 await assert.rejects(explicit.reply(input(),{device}),{code:'PRACTICAL_MODEL'});
});
test('a cached valid report remains accessible when a later request finds no available model',async()=>{
 let working=true,calls=0;
 const service=createPracticalService({apiKey:'test-only',fetchImpl:async url=>{
  if(!String(url).includes('generateContent'))return Response.json({models:[]});calls++;return working?generated(report()):providerError(404);
 }});
 const original=input(),value=await service.reply(original,{device});working=false;
 await assert.rejects(service.reply({...input(),level:'B2'},{device}),{code:'PRACTICAL_MODEL'});
 assert.deepEqual(await service.reply({...original,requestId:crypto.randomUUID()},{device}),value);assert.equal(calls,2);
});
test('a quota reservation completing after the deadline restores its personal report slot and cannot call the provider',async t=>{
 let grant,released=0,calls=0;const service=createPracticalService({apiKey:'test-only',timeoutMs:50,beforeGenerate:()=>new Promise(resolve=>grant=resolve),fetchImpl:()=>{calls++;return generated(report());}});
 t.mock.timers.enable({apis:['setTimeout']});const failed=assert.rejects(service.reply(input(),{device}),{code:'PRACTICAL_TIMEOUT'});
 while(!grant)await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(50);await failed;
 grant({release:async()=>released++});await new Promise(resolve=>setImmediate(resolve));assert.equal(released,1);assert.equal(calls,0);
});
test('database distinguishes an exhausted bucket without debiting other buckets and restores only its bound report counter',async()=>{
 let updated=0,released=0;
 const pool={end:async()=>{},getConnection:async()=>({release(){},destroy(){},beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},execute:async()=>[[]],query:async(sql,p)=>{
  if(sql.startsWith('INSERT'))return [{}];
  if(sql.startsWith('SELECT'))return [[{bucket:'practical-day',key_hash:'g',units:600},{bucket:'practical-report-device',key_hash:device,units:0}]];
  if(sql.includes('SET units=units-?')){released++;assert.deepEqual(p,[1,'practical-report-device',device,1]);return [{affectedRows:1}];}
  updated++;return [{affectedRows:2}];
 }})};
 const db=createDatabase({MYSQL_HOST:'127.0.0.1',MYSQL_USER:'test',MYSQL_DATABASE:'test',MYSQL_SSL:'false'},{createPool:()=>pool});
 try{
  await db.initialize();const rules=[{bucket:'practical-day',key:'g',units:1,limit:600,expiresAt:100},{bucket:'practical-report-device',key:device,units:1,limit:10,expiresAt:100}];
  assert.deepEqual(await db.reserveUsage(rules,{isolatedAI:true,details:true}),{accepted:false,bucket:'practical-day',resetAt:100});assert.equal(updated,0);
  await db.releaseAssessment({key:device});assert.equal(released,1);await assert.rejects(db.releaseAssessment({key:'forged'}),{code:'USAGE_UNAVAILABLE'});
 }finally{await db.close();}
});
test('quota, permissions, retired models, overload, network and malformed output have distinct localized notices without a fictional provider reset time',()=>{
 for(const locale of ['en','vi','ko','ja','zh-CN','es','fr']){
  const translate=(text,params)=>i18n.t(text,params,locale),seen=[];
  for(const code of ['PRACTICAL_AUTH','PRACTICAL_MODEL','PRACTICAL_QUOTA','PRACTICAL_BUSY','PRACTICAL_SERVICE','PRACTICAL_OUTPUT','USAGE_UNAVAILABLE']){
   const notice=errors.message({code,message:'PRIVATE_PROVIDER_DETAIL'},{locale,translate});assert.ok(!notice.includes('PRIVATE'));assert.ok(!notice.includes('07:00'));seen.push(notice);
   if(locale!=='en')assert.notEqual(notice,errors.message({code}));
  }
  assert.equal(new Set(seen).size,seen.length);
  const notice=errors.message({code:'USAGE_LIMIT',scope:'shared',resetAt:'2026-10-19T00:00:00Z'},{locale,translate,now:Date.UTC(2026,9,18,3,18)});
  assert.ok(!notice.includes('{time}'));assert.ok(notice.includes('19'));
 }
 const rate=errors.fromResponse({error:'daily quota'},{status:429});assert.match(errors.message(rate),/minute/);
 assert.match(errors.message({code:'PRACTICAL_AUTH'},{offline:true}),/offline/);
});
