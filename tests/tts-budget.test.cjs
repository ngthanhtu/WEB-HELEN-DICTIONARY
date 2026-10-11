const {test}=require('node:test'),assert=require('node:assert/strict');
const budget=require('../lib/tts-budget'),{createDatabase}=require('../lib/database');
const device='a'.repeat(64),limits={ttsDay:10,ttsMonth:20,ttsDevice:6};
test('legacy TTS usage is preserved including opaque per-device hashes; other budgets remain separate',()=>{
 const at=Date.UTC(2026,9,11),{day,month,end}=budget.windowAt(at),key=budget.hash(`${day}:${device}`);
 const rows=[{bucket:'tts-day',key_hash:budget.hash(day),units:5},{bucket:'tts-month',key_hash:budget.hash(month),units:12},{bucket:'tts-device',key_hash:key,units:3,expires_at:new Date(end)},{bucket:'tts-device',key_hash:'b'.repeat(64),units:9,expires_at:new Date(end-86400000)},{bucket:'ai-day',key_hash:budget.hash(day),units:99}];
 const migrated=budget.legacy(rows,at);assert.deepEqual(migrated.slice(0,4),[day,month,5,12]);assert.deepEqual(JSON.parse(migrated[4]),{[key]:3});
 assert.equal(budget.parameters({at,units:2,device,limits})[5],'$.'+JSON.stringify(key));assert.throws(()=>budget.parameters({at,units:-1,device,limits}));
});
test('single SQL TTS reservation is atomic under concurrency, preserves migration and resets day/month correctly',async()=>{
 let row,updates=0,oldReads=0;const at=Date.now(),window=budget.windowAt(at),old=[{bucket:'tts-day',key_hash:budget.hash(window.day),units:2},{bucket:'tts-month',key_hash:budget.hash(window.month),units:2}];
 const pool={end:async()=>{},getConnection:async()=>({release(){},destroy(){},beginTransaction(){throw Error('no extra transaction round trip');},execute:async(sql,p)=>{
  if(sql.startsWith('SELECT id FROM helen_tts_usage'))return [row?[{id:1}]:[]];
  if(sql.startsWith('SELECT bucket,key_hash,units,expires_at')){oldReads++;return [old];}
  if(sql.startsWith('INSERT IGNORE INTO helen_tts_usage')){row ||= {day:p[0],month:p[1],dayUnits:p[2],monthUnits:p[3],devices:JSON.parse(p[4])};return [{affectedRows:1}];}
  if(sql===budget.SQL){updates++;assert.equal((sql.match(/\?/g)||[]).length,p.length);assert.equal(p.length,23);
   const day=p[0],month=p[2],units=p[1],key=JSON.parse(p[5].slice(2)),dayUnits=row.day===day?row.dayUnits:0,monthUnits=row.month===month?row.monthUnits:0,deviceUnits=row.day===day?row.devices[key]||0:0;
   if(row.day>day || row.month>month || dayUnits+units>p[15] || monthUnits+units>p[18] || deviceUnits+units>p[22])return [{affectedRows:0}];
   row={day,month,dayUnits:dayUnits+units,monthUnits:monthUnits+units,devices:{...(row.day===day?row.devices:{}),[key]:deviceUnits+units}};return [{affectedRows:1}];
  }return [[]];
 }})};
 const db=createDatabase({MYSQL_HOST:'127.0.0.1',MYSQL_USER:'test',MYSQL_DATABASE:'test',MYSQL_SSL:'false'},{createPool:()=>pool});
 try{
  assert.equal(await db.initialize(),true);await db.prepareTTS();assert.equal(oldReads,1);
  const results=await Promise.all(Array.from({length:8},()=>db.reserveTTS({at,units:2,device,limits})));assert.equal(results.filter(Boolean).length,3);assert.equal(updates,8);assert.equal(row.dayUnits,8);assert.equal(row.monthUnits,8);
  assert.equal(await db.reserveTTS({at,units:2,device:'b'.repeat(64),limits}),true);assert.equal(row.dayUnits,10);const snapshot=JSON.stringify(row);assert.equal(await db.reserveTTS({at,units:1,device:'c'.repeat(64),limits}),false);assert.equal(JSON.stringify(row),snapshot);
  const tomorrow=at+86400000;assert.equal(await db.reserveTTS({at:tomorrow,units:4,device,limits}),true);assert.equal(row.dayUnits,4);assert.equal(row.monthUnits,14);assert.equal(Object.keys(row.devices).length,1);
  assert.equal(await db.reserveTTS({at,units:1,device,limits}),false);assert.equal(row.dayUnits,4);
  const nextMonth=Date.UTC(Number(window.month.slice(0,4)),Number(window.month.slice(5)),1);assert.equal(await db.reserveTTS({at:nextMonth,units:1,device,limits}),true);assert.equal(row.dayUnits,1);assert.equal(row.monthUnits,1);assert.equal(oldReads,1);
 }finally{await db.close();}
});
test('missing or failed quota storage cannot permit cloud speech',async()=>{
 const db=createDatabase({});await assert.rejects(db.reserveTTS({at:Date.now(),units:1,device,limits}),{code:'USAGE_UNAVAILABLE'});await db.close();
});
