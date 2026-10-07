const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCollocationService}=require('../lib/collocation-service');
const {exampleCombinations}=require('../lib/collocations');
const good=()=>Response.json([{word:'scientific',score:100},{word:'the',score:99}]);
const meanings=[{pos:'noun',senses:[{definition:'a test',example:'We conducted a scientific experiment yesterday.',relationSource:'Princeton WordNet'}]}];
test('a cold source failure retries once and parallel requests share the same fetches',async()=>{
  let calls=0;const service=createCollocationService({get:async()=>++calls<=2?null:good()});
  const [a,b]=await Promise.all([service.lookup('experiment'),service.lookup('experiment')]);
  assert.equal(calls,4);assert.equal(a.unavailable,false);assert.deepEqual(a,b);
  assert.ok(a.corpus.some(item=>item.phrase==='experiment scientific'));
});
test('collocation cache survives a new service and opens while every provider is offline',async()=>{
  const data=new Map(),store={get:async(ns,word)=>data.has(word)?{value:data.get(word),fresh:true}:null,set:async(ns,word,value)=>data.set(word,value)};
  const first=createCollocationService({store,get:async()=>good()});
  const before=await first.lookup('discovery');assert.ok(before.corpus.length);
  let calls=0;const restarted=createCollocationService({store,get:async()=>{calls++;return null;}});
  assert.deepEqual(await restarted.lookup('discovery'),{...before,stale:false});assert.equal(calls,0);
});
test('stale good results remain usable and cannot be overwritten by an outage',async()=>{
  let clock=1,offline=false;const written=[];
  const service=createCollocationService({now:()=>clock,get:async()=>offline?null:good(),store:{get:async()=>null,set:async(...args)=>written.push(args)}});
  const original=await service.lookup('discovery');clock+=8*86400000;offline=true;
  const stale=await service.lookup('discovery');assert.equal(stale.stale,true);assert.deepEqual(stale.corpus,original.corpus);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual((await service.lookup('discovery')).corpus,original.corpus);assert.equal(written.length,1);
});
test('failed empty results are not cached and the next search can recover',async()=>{
  let offline=true,calls=0;const written=[];
  const service=createCollocationService({get:async()=>{calls++;return offline?null:good();},store:{get:async()=>null,set:async(...args)=>written.push(args)}});
  assert.equal((await service.lookup('discovery')).unavailable,true);assert.equal(written.length,0);
  offline=false;assert.equal((await service.lookup('discovery')).unavailable,false);assert.equal(calls,6);assert.equal(written.length,1);
});
test('dictionary examples and curated collocations stay available when the corpus fails',async()=>{
  const service=createCollocationService({get:async()=>null});
  const result=await service.lookup('experiment',meanings);
  assert.ok(result.teaching.some(item=>item.phrase==='conduct an experiment'));
  assert.ok(result.examples.some(item=>item.phrase==='experiment yesterday' && item.example===meanings[0].senses[0].example));
  const premium=await service.lookup('premium');assert.ok(premium.teaching.some(item=>item.phrase==='premium quality'));
});
test('example combinations respect word boundaries, punctuation and stop words',()=>{
  assert.deepEqual(exampleCombinations('test',[{senses:[{example:'We protest, testing a contest.'}]}]),[]);
  assert.deepEqual(exampleCombinations('test',[{senses:[{example:'great, test; failure'}]}]),[]);
  const result=exampleCombinations('test',[{senses:[{example:'A scientific test detects errors.'}]}]);
  assert.deepEqual(result.map(item=>item.phrase),['scientific test','test detects']);
});
test('slow response bodies have a total deadline, not an unbounded post-header wait',async()=>{
  const service=createCollocationService({get:async()=>({ok:true,json:()=>new Promise(()=>{})})});
  const start=Date.now(),result=await service.lookup('experiment');
  assert.equal(result.unavailable,true);assert.ok(result.teaching.length);
  assert.ok(Date.now()-start<3000);
});
test('real MySQL persists corpus combinations across service and connection restart',{skip:process.env.HELEN_MYSQL_TEST!=='1'},async()=>{
  const {createDatabase}=require('../lib/database');
  const first=createDatabase(),second=createDatabase();
  try {
    assert.equal(await first.initialize(),true);
    const before=await createCollocationService({store:first,get:async()=>good()}).lookup('persistentcollocation');
    for(let i=0;i<20 && !await first.get('collocations-v2','persistentcollocation',1000);i++)await new Promise(resolve=>setTimeout(resolve,50));
    await first.close();assert.equal(await second.initialize(),true);
    const after=await createCollocationService({store:second,get:async()=>{throw Error('provider unavailable after restart');}}).lookup('persistentcollocation');
    assert.deepEqual(after.corpus,before.corpus);assert.equal(after.unavailable,false);
  } finally {await first.close();await second.close();}
});
