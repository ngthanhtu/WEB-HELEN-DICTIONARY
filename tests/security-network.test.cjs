const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWebSecurity}=require('../lib/web-security'),{createUsagePolicy}=require('../lib/usage-policy'),{createDatabase}=require('../lib/database'),budget=require('../lib/tts-budget');
test('network identity uses resolved proxy IP, groups IPv6 /56 and never trusts client fields',()=>{
 const security=createWebSecurity({networkSecret:'test-only'}),identity=ip=>security.network({ip,headers:{'x-forwarded-for':'9.9.9.9'},body:{ip:'8.8.8.8',network:'forged'}});
 assert.match(identity('203.0.113.1'),/^[a-f0-9]{64}$/);assert.notEqual(identity('203.0.113.1'),identity('203.0.113.2'));
 assert.equal(identity('2001:db8:1234:5600::1'),identity('2001:db8:1234:56ff::2'));assert.notEqual(identity('2001:db8:1234:5600::1'),identity('2001:db8:1234:5700::1'));
 assert.equal(identity('203.0.113.1'),createWebSecurity({networkSecret:'test-only'}).network({ip:'203.0.113.1'}));
 assert.notEqual(identity('203.0.113.1'),createWebSecurity({networkSecret:'test-only-rotated'}).network({ip:'203.0.113.1'}));
});
test('durable network budgets survive policy restarts, separate stages, reset daily and debit atomically',async()=>{
 const counts=new Map(),seen=[];let now=Date.UTC(2026,9,13);
 const database={reserveUsage:async rules=>{seen.push(rules);if(rules.some(r=>(counts.get(r.bucket+r.key)||0)+r.units>r.limit))return false;for(const r of rules)counts.set(r.bucket+r.key,(counts.get(r.bucket+r.key)||0)+r.units);return true;}};
 const env={NODE_ENV:'production',PRACTICAL_IP_DAILY_REPLY_LIMIT:'2',PRACTICAL_IP_DAILY_TRANSCRIPTION_LIMIT:'1',PRACTICAL_IP_DAILY_ASSESSMENT_LIMIT:'1'},make=()=>createUsagePolicy({database,env,now:()=>now});
 await make().reserve('practical',1,'a','network');await make().reserve('practical',1,'b','network');const before=[...counts];
 await assert.rejects(make().reserve('practical',1,'c','network'),{code:'USAGE_LIMIT'});assert.deepEqual([...counts],before);
 await make().reserve('practical-speech',1,'a','network');await assert.rejects(make().reserve('practical-speech',1,'b','network'),{code:'USAGE_LIMIT'});
 await make().reserve('practical-assessment',1,'a','network');await make().reserve('practical',1,'a','another-network');
 assert.ok(seen.flat().every(r=>r.bucket.length<=24 && /^[a-f0-9]{64}$/.test(r.key)));
 now+=86400000;await make().reserve('practical',1,'a','network');
});
test('restricted database startup checks every existing table without CREATE and fails on a missing table',async()=>{
 const queries=[],pool={end:async()=>{},getConnection:async()=>({release(){},destroy(){},execute:async sql=>{queries.push(sql);return [[]];}})};
 const env={MYSQL_HOST:'127.0.0.1',MYSQL_USER:'test',MYSQL_DATABASE:'test',MYSQL_SSL:'false',DATABASE_AUTO_MIGRATE:'false'};
 const db=createDatabase(env,{createPool:()=>pool});try{assert.equal(await db.initialize(),true);const checks=queries.filter(sql=>sql.startsWith('SELECT 1 FROM'));assert.equal(checks.length,9);assert.equal(checks[0],'SELECT 1 FROM helen_usage_budget LIMIT 0');assert.ok(!queries.some(sql=>/CREATE|ALTER|DROP|GRANT/.test(sql)));}finally{await db.close();}
 const missing=createDatabase(env,{createPool:()=>({...pool,getConnection:async()=>({release(){},execute:async()=>{throw Object.assign(Error('missing'),{code:'ER_NO_SUCH_TABLE'});}})})});try{assert.equal(await missing.initialize(),false);assert.equal(missing.status().connected,false);}finally{await missing.close();}
});
test('single TTS SQL guards both device and network with bound independent counters',()=>{
 const options={at:Date.UTC(2026,9,13),units:4,device:'a'.repeat(64),network:'b'.repeat(64),limits:{ttsDay:2000,ttsMonth:9000,ttsDevice:750,ttsNetwork:1500}},p=budget.parameters(options);
 assert.equal(p.length,31);assert.equal((budget.NETWORK_SQL.match(/\?/g)||[]).length,p.length);assert.notEqual(p[5],p[9]);assert.equal(p[5],p[7]);assert.equal(p[9],p[11]);assert.equal(p[5],p[24]);assert.equal(p[9],p[28]);
 assert.equal(p[26],750);assert.equal(p[30],1500);assert.equal((budget.NETWORK_SQL.match(/JSON_EXTRACT/g)||[]).length,4);
 assert.throws(()=>budget.parameters({...options,network:'forged'}));assert.throws(()=>budget.parameters({...options,limits:{...options.limits,ttsNetwork:0}}));
});
test('database executes the atomic network TTS guard; rejected rotations do not consume other counters',async()=>{
 let row={day:'2026-10-13',month:'2026-10',dayUnits:0,monthUnits:0,devices:{}},updates=0;
 const pool={end:async()=>{},getConnection:async()=>({release(){},destroy(){},execute:async()=>[[]],query:async(sql,p)=>{
  if(sql.startsWith('SELECT id'))return [[{id:1}]];assert.equal(sql,budget.NETWORK_SQL);updates++;
  const day=p[0],month=p[2],units=p[1],device=JSON.parse(p[5].slice(2)),network=JSON.parse(p[9].slice(2)),same=row.day===day,d=same?row.dayUnits:0,m=row.month===month?row.monthUnits:0,a=same?row.devices[device]||0:0,b=same?row.devices[network]||0:0;
  if(row.day>day || row.month>month || d+units>p[19] || m+units>p[22] || a+units>p[26] || b+units>p[30])return [{affectedRows:0}];
  row={day,month,dayUnits:d+units,monthUnits:m+units,devices:{...(same?row.devices:{}),[device]:a+units,[network]:b+units}};return [{affectedRows:1}];
 }})};
 const db=createDatabase({MYSQL_HOST:'127.0.0.1',MYSQL_USER:'test',MYSQL_DATABASE:'test',MYSQL_SSL:'false'},{createPool:()=>pool});
 try{await db.initialize();await db.prepareTTS();const options={at:Date.UTC(2026,9,13),units:2,device:'a'.repeat(64),network:'b'.repeat(64),limits:{ttsDay:10,ttsMonth:20,ttsDevice:2,ttsNetwork:4}};
  const results=await Promise.all(['a','c','d'].map(char=>db.reserveTTS({...options,device:char.repeat(64)})));assert.deepEqual(results,[true,true,false]);assert.equal(row.dayUnits,4);assert.equal(row.monthUnits,4);assert.equal(Object.keys(row.devices).length,3);
  assert.equal(await db.reserveTTS({...options,at:options.at+86400000}),true);assert.equal(row.dayUnits,2);assert.equal(row.monthUnits,6);assert.equal(updates,4);
 }finally{await db.close();}
});
