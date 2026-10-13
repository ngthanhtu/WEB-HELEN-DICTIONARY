const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase}=require('../lib/database'),{createUsagePolicy}=require('../lib/usage-policy');
const {createPracticalService}=require('../lib/practical-ai');
const core=require('../public/assets/practical-core');
const env={MYSQL_HOST:'127.0.0.1',MYSQL_USER:'test',MYSQL_DATABASE:'test',MYSQL_SSL:'false'};
const disconnected=()=>Object.assign(Error('private database endpoint details'),{code:'ECONNRESET'});
function fixture({fault,permanent=false,rollbackFails=false,starting,otherTables,acquiring}={}){
 const ledger=new Map(),stats={acquired:0,commits:0,rollbacks:0,destroyed:0,released:0},calls=[];
 let failed=false,generalFailed=false;
 const maybe=phase=>{if(phase===fault && (!failed || permanent)){failed=true;throw disconnected();}};
 const db=createDatabase(env,{
  createPool:()=>({end:async()=>{},getConnection:async()=>({release(){},destroy(){},execute:async sql=>{
   if(starting && sql.startsWith('CREATE'))await starting;
   if(otherTables && sql.startsWith('CREATE') && !sql.includes('helen_usage_budget'))await otherTables;
   if(generalFailed && sql.startsWith('SELECT CAST'))throw disconnected();return [[]];
  }})}),
  createAIPool:()=>({end:async()=>{},getConnection:async()=>{
   stats.acquired++;if(acquiring)await acquiring;maybe('acquire');let snapshot;
   return {release(){stats.released++;},destroy(){stats.destroyed++;},
    async beginTransaction(){maybe('begin');snapshot=new Map(ledger);},
    async commit(){stats.commits++;maybe('commit');},
    async rollback(){stats.rollbacks++;if(rollbackFails)throw disconnected();ledger.clear();for(const [key,value] of snapshot)ledger.set(key,value);},
    async query(sql,params){
     const phase=sql.startsWith('INSERT')?'insert':sql.startsWith('SELECT')?'select':'update';calls.push(phase);maybe(phase);
     if(phase==='insert'){for(let i=0;i<params.length;i+=3){const key=params[i]+':'+params[i+1];if(!ledger.has(key))ledger.set(key,0);}return [{}];}
     if(phase==='select')return [Array.from({length:params.length/2},(_,i)=>({bucket:params[i*2],key_hash:params[i*2+1],units:ledger.get(params[i*2]+':'+params[i*2+1])}))];
     for(let i=0;i<params.length/5;i++){const key=params[i*3]+':'+params[i*3+1];ledger.set(key,ledger.get(key)+params[i*3+2]);}return [{affectedRows:params.length/5}];
    }};
  }})
 });
 return {db,ledger,stats,calls,failGeneral:()=>generalFailed=true};
}
const rules=()=>[{bucket:'practical-day',key:'g',units:1,limit:600,expiresAt:Date.now()+86400000},{bucket:'practical-reply-device',key:'d',units:1,limit:100,expiresAt:Date.now()+86400000}];
test('Practical status warm-up coalesces, warms only the isolated pool and does not debit a generation',async()=>{
 let queries=0,connections=0,release;const warming=new Promise(resolve=>release=resolve);
 const db=createDatabase(env,{createPool:()=>({end:async()=>{},getConnection:async()=>({release(){},execute:async()=>[[]]})}),createAIPool:()=>({end:async()=>{},getConnection:async()=>{connections++;await warming;return {release(){},query:async sql=>{assert.equal(sql,'SELECT 1');queries++;return [[{1:1}]];}};}})});
 try{await db.initialize();const first=db.warmPractical(),second=db.warmPractical();await new Promise(resolve=>setImmediate(resolve));assert.equal(connections,1);release();await Promise.all([first,second]);await db.warmPractical();assert.equal(queries,1);}finally{release();await db.close();}
});
test('a disconnected dictionary cache does not block the independent speaking quota connection for 30 seconds',async()=>{
 const f=fixture();await f.db.initialize();try{
  f.failGeneral();assert.equal(await f.db.get('dictionary-v2','intermediate'),null);assert.equal(f.db.status().connected,false);
  assert.equal(await f.db.reserveUsage(rules(),{isolatedAI:true}),true);
  assert.deepEqual([...f.ledger.values()],[1,1]);
 }finally{await f.db.close();}
});
test('a speaking turn arriving during startup waits for the same schema initialization',async()=>{
 let release;const starting=new Promise(resolve=>release=resolve),f=fixture({starting});
 const initialization=f.db.initialize();let finished=false;
 const turn=f.db.reserveUsage(rules(),{isolatedAI:true}).then(value=>{finished=true;return value;});
 try{
  await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);assert.equal(f.stats.acquired,0);
  release();assert.equal(await initialization,true);assert.equal(await turn,true);assert.deepEqual([...f.ledger.values()],[1,1]);
 }finally{release();await f.db.close();}
});
test('a stalled quota connection has one overall deadline and can never commit or debit after it expires',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let release;const acquiring=new Promise(resolve=>release=resolve),f=fixture({acquiring});await f.db.initialize();
 try{
  const failed=assert.rejects(f.db.reserveUsage(rules(),{isolatedAI:true}),{code:'USAGE_UNAVAILABLE'});
  await new Promise(resolve=>setImmediate(resolve));t.mock.timers.tick(6500);await failed;
  release();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.stats.commits,0);assert.equal(f.ledger.size,0);assert.equal(f.stats.acquired,1);assert.equal(f.stats.released,1);
 }finally{release();await f.db.close();}
});
test('stale speaking connections and rolled-back statement failures recover once and debit both budgets exactly once',async()=>{
 for(const fault of ['acquire','begin','insert','select','update']){
  const f=fixture({fault});await f.db.initialize();try{
   assert.equal(await f.db.reserveUsage(rules(),{isolatedAI:true}),true,fault);
   assert.equal(f.stats.acquired,2,fault);assert.deepEqual([...f.ledger.values()],[1,1],fault);assert.equal(f.stats.commits,1,fault);
   assert.equal(await f.db.reserveUsage(rules(),{isolatedAI:true}),true);assert.deepEqual([...f.ledger.values()],[2,2]);
  }finally{await f.db.close();}
 }
});
test('an unknown COMMIT outcome is never retried and the next request can reconnect without a global cooldown',async()=>{
 const f=fixture({fault:'commit'});await f.db.initialize();try{
  await assert.rejects(f.db.reserveUsage(rules(),{isolatedAI:true}),error=>error.code==='USAGE_UNAVAILABLE' && !error.message.includes('private'));
  assert.equal(f.stats.acquired,1);assert.equal(f.stats.commits,1);assert.equal(f.stats.destroyed,1);
  assert.equal(await f.db.reserveUsage(rules(),{isolatedAI:true}),true);
 }finally{await f.db.close();}
});
test('permanent failure, uncertain rollback and missing schema fail closed with bounded recovery',async()=>{
 for(const options of [{fault:'acquire',permanent:true},{fault:'update',rollbackFails:true}]){
  const f=fixture(options);await f.db.initialize();try{
   await assert.rejects(f.db.reserveUsage(rules(),{isolatedAI:true}),{code:'USAGE_UNAVAILABLE'});
   assert.equal(f.stats.acquired,options.permanent?2:1);assert.equal(f.stats.commits,0);assert.equal([...f.ledger.values()].some(value=>value>0),false);
  }finally{await f.db.close();}
 }
 for(const initialize of [false,true]){
  const db=createDatabase({});try{if(initialize)await db.initialize();await assert.rejects(db.reserveUsage(rules(),{isolatedAI:true}),{code:'USAGE_UNAVAILABLE'});}finally{await db.close();}
 }
});
test('confirmed speaking produces one partner reply and grounded feedback after quota reconnect; retry reuses the result',async()=>{
 const f=fixture({fault:'select'});await f.db.initialize();let generated=0;
 const policy=createUsagePolicy({database:f.db,env:{NODE_ENV:'production'}}),text='I has worked in healthcare for one year.';
 const input={scenario:'work',level:'B1',requestId:crypto.randomUUID(),history:core.context(core.fresh('work','B1')),text};
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:({device})=>policy.reserve('practical',1,device),fetchImpl:async()=>{
  generated++;return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({reply:'What did you enjoy about that work?',translation:'Bạn thích điều gì ở công việc đó?',phrase:{text:'gain experience',translation:'tích lũy kinh nghiệm'},corrections:[{original:'I has',replacement:'I have',reason:'Dùng have với I.'}],collocations:[]})}]},finishReason:'STOP'}]});
 }});
 try{
  const reply=await service.reply(input,{device:'a'.repeat(64)});assert.equal(reply.transcript,text);assert.equal(reply.improved,'I have worked in healthcare for one year.');assert.equal(reply.feedback,'Dùng have với I.');assert.ok(reply.reply);
  assert.deepEqual(await service.reply(input,{device:'a'.repeat(64)}),reply);assert.equal(generated,1);assert.deepEqual([...f.ledger.values()],[1,1]);
 }finally{await f.db.close();}
});
test('an unavailable durable quota store never reaches the AI provider or produces a fake dialogue',async()=>{
 const f=fixture({fault:'acquire',permanent:true});await f.db.initialize();let generated=0;
 const policy=createUsagePolicy({database:f.db,env:{NODE_ENV:'production'}});
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:({device})=>policy.reserve('practical',1,device),fetchImpl:async()=>{generated++;assert.fail('provider must not be called');}});
 try{
  await assert.rejects(service.reply({scenario:'coffee',level:'B1',requestId:crypto.randomUUID(),history:core.context(core.fresh()),text:'I would like a coffee.'},{device:'b'.repeat(64)}),{code:'USAGE_UNAVAILABLE'});
  assert.equal(generated,0);assert.equal(f.stats.acquired,2);assert.equal(f.ledger.size,0);
 }finally{await f.db.close();}
});

test('speaking starts after the budget table is ready while unrelated startup tables are still pending',async()=>{
 let release;const otherTables=new Promise(resolve=>release=resolve),f=fixture({otherTables});
 const initialization=f.db.initialize();try{
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.db.status().connected,false);
  assert.equal(await f.db.reserveUsage(rules(),{isolatedAI:true}),true);assert.deepEqual([...f.ledger.values()],[1,1]);
  assert.equal(f.db.status().aiQuota.connected,true);assert.equal(f.db.status().connected,false);
 }finally{release();await initialization;await f.db.close();}
});
test('a failed cold-start schema retries after five seconds rather than waiting thirty seconds',async t=>{
 let now=Date.now(),creates=0;t.mock.method(Date,'now',()=>now);
 const db=createDatabase(env,{createPool:()=>({end:async()=>{},getConnection:async()=>({release(){},destroy(){},execute:async sql=>{
  if(sql.startsWith('CREATE') && ++creates===1)throw disconnected();return [[]];
 }})})});
 try{
  assert.equal(await db.initialize(),false);now+=4999;db.status();await new Promise(resolve=>setImmediate(resolve));assert.equal(creates,1);
  now+=1;db.status();await new Promise(resolve=>setImmediate(resolve));assert.equal(db.status().connected,true);assert.ok(creates>1);
 }finally{await db.close();}
});
