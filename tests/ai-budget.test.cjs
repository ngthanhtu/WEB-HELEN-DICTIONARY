const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createDatabase}=require('../lib/database'),{createUsagePolicy}=require('../lib/usage-policy');
const env={MYSQL_HOST:'127.0.0.1',MYSQL_USER:'test',MYSQL_DATABASE:'test',MYSQL_SSL:'false'};
test('warm AI budget uses one atomic update per generation, preserves the existing daily ledger and never overspends',async()=>{
 const date=Date.UTC(2026,9,11,6),hash=key=>crypto.createHash('sha256').update(key).digest('hex'),counts=new Map([[hash('2026-10-11'),1]]),queries=[];
 const dependencies={createPool:()=>({end:async()=>{},getConnection:async()=>({release(){},destroy(){},execute:async()=>[[]]})}),createAIPool:options=>{
  assert.equal(options.connectionLimit,1);assert.equal(options.multipleStatements,false);return {end:async()=>{},getConnection:async()=>({release(){},destroy(){},query:async(sql,params)=>{
   queries.push(sql);assert.equal(params[1]=== 'ai-day' || params[0]==='ai-day',true);
   if(sql.startsWith('INSERT')){assert.ok(params[2] instanceof Date);if(!counts.has(params[1]))counts.set(params[1],0);return [{}];}
   const [units,,key,available]=params,old=counts.get(key);if(old===undefined || old>available)return [{affectedRows:0}];counts.set(key,old+units);return [{affectedRows:1}];
  }})};
 }};
 const first=createDatabase(env,dependencies);await first.initialize();
 try{
  await first.prepareAI(date);const start=queries.length;
  const accepted=await Promise.all(Array.from({length:20},()=>first.reserveAI({at:date,units:2,limit:9})));assert.equal(accepted.filter(Boolean).length,4);assert.equal(counts.get(hash('2026-10-11')),9);
  assert.equal(queries.length-start,20);assert.ok(queries.slice(start).every(sql=>sql.startsWith('UPDATE')));
  const next=date+86400000;assert.equal(await first.reserveAI({at:next,units:1,limit:9}),true);assert.equal(counts.get(hash('2026-10-12')),1);assert.equal(counts.get(hash('2026-10-11')),9);
  assert.equal(await first.reserveAI({at:next,units:0,limit:9}),false);
 }finally{await first.close();}
 const restarted=createDatabase(env,dependencies);await restarted.initialize();try{assert.equal(await restarted.reserveAI({at:date,units:1,limit:9}),false);assert.equal(counts.get(hash('2026-10-11')),9);}finally{await restarted.close();}
});
test('AI quota database errors remain fail-closed rather than allowing unmetered generation',async()=>{
 const db=createDatabase(env,{createPool:()=>({end:async()=>{},getConnection:async()=>({release(){},destroy(){},execute:async()=>[[]]})}),createAIPool:()=>({end:async()=>{},getConnection:async()=>{throw Object.assign(Error('private network error'),{code:'ECONNRESET'});}})});
 await db.initialize();try{await assert.rejects(db.reserveAI({limit:100}),error=>error.code==='USAGE_UNAVAILABLE' && !error.message.includes('private'));}finally{await db.close();}
});
test('usage policy selects the fast AI ledger and leaves dictionary/TTS quota contracts unchanged',async()=>{
 const seen=[],policy=createUsagePolicy({env:{NODE_ENV:'production',AI_DAILY_REQUEST_LIMIT:'7'},database:{reserveAI:async value=>{seen.push(value);return seen.length===1;},reserveUsage:()=>{throw Error('AI must not use the transaction path');}},now:()=>Date.UTC(2026,9,11)});
 await policy.reserve('ai',1);assert.equal(seen[0].limit,7);assert.equal(seen[0].units,1);await assert.rejects(policy.reserve('ai',1),error=>error.code==='USAGE_LIMIT');
});
