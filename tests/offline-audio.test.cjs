const {test}=require('node:test'),assert=require('node:assert/strict');
const createAudio=require('../public/assets/offline-audio');
function storage(){
  const stores=new Map();let full=false;
  const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{
    if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name),key=request=>typeof request==='string'?request:request.url;
    return {match:async request=>data.get(key(request))?.clone(),put:async(request,response)=>{if(full)throw Error('QuotaExceededError');data.set(key(request),response.clone());},keys:async()=>[...data.keys()],delete:async request=>data.delete(key(request))};
  }};
  return {caches,setFull:value=>full=value};
}
const recording=(length=4)=>new Response(new Uint8Array(length).fill(42),{headers:{'Content-Type':'audio/mpeg'}});
test('offline audio survives a new page, keeps exact voice and preserves case-sensitive pronunciation',async()=>{
  const {caches}=storage(),audio=createAudio({caches,origin:'https://helen.test'});
  assert.equal(await audio.save(' US ','Sarah',recording()),true);
  const reloaded=createAudio({caches,origin:'https://helen.test'});
  assert.equal((await reloaded.get('US','Sarah')).headers.get('Content-Type'),'audio/mpeg');
  assert.equal(await reloaded.get('US','Bella'),null);assert.equal(await reloaded.get('us','Sarah'),null);
  assert.equal(await reloaded.get('US',''),null);assert.equal(await reloaded.save('US','',recording()),false);
});
test('bad audio and quota failures never overwrite a playable saved response',async()=>{
  const disk=storage(),audio=createAudio({caches:disk.caches,origin:'https://helen.test'});
  await audio.save('loan','Sarah',recording(5));
  for(const bad of [Response.json({error:'quota'},{status:429}),Response.json({error:'not audio'}),recording(0),recording(1024*1024+1)])assert.equal(await audio.save('loan','Sarah',bad),false);
  disk.setFull(true);assert.equal(await audio.save('loan','Sarah',recording(8)),false);
  assert.equal((await (await audio.get('loan','Sarah')).arrayBuffer()).byteLength,5);
});
test('concurrent saves obey both clip and byte limits without deleting words or study data',async()=>{
  const {caches}=storage(),words=await caches.open('helen-words-v1');await words.put('loan',Response.json({word:'loan'}));
  const audio=createAudio({caches,origin:'https://helen.test',maxClips:2,maxBytes:10});
  await audio.save('loan','Sarah',recording(4));
  await Promise.all(['tree','brother'].map(word=>audio.save(word,'Sarah',recording(4))));
  let clips=await audio.inventory();assert.equal(clips.length,2);assert.ok(clips.reduce((sum,item)=>sum+item.bytes,0)<=10);
  assert.equal(await audio.get('loan','Sarah'),null);assert.ok(await audio.get('brother','Sarah'));
  await audio.save('loan','Sarah',recording(7));clips=await audio.inventory();assert.equal(clips.length,1);assert.equal(clips[0].text,'loan');
  assert.equal(await audio.clear(),true);assert.equal((await audio.inventory()).length,0);assert.ok(await words.match('loan'));
});
test('favorite download plans skip exact saved clips, validate words and limit each confirmed batch to ten',async()=>{
  const {caches}=storage(),audio=createAudio({caches,origin:'https://helen.test'});
  await audio.save('loan','Sarah',recording());
  const plan=await audio.plan(['loan','loan',...Array.from({length:15},(_,i)=>`word${i}`),'',null,'x'.repeat(101)],'Sarah');
  assert.equal(plan.cached,1);assert.equal(plan.remaining,15);assert.equal(plan.words.length,10);
  assert.equal((await audio.plan(['loan'],'Bella')).remaining,1);
});
test('explicit downloads request only the chosen voice and resume without recharging saved clips',async()=>{
  const {caches}=storage(),audio=createAudio({caches,origin:'https://helen.test'});let calls=[];
  const fetchAudio=async(text,voice)=>{calls.push([text,voice]);return recording();};
  const outcome=await audio.download({words:['loan','tree','loan'],voice:'Sarah',fetchAudio});
  assert.equal(outcome.saved,2);assert.equal(outcome.failed,0);assert.deepEqual(calls,[['loan','Sarah'],['tree','Sarah']]);
  calls=[];assert.equal((await audio.download({words:['loan','tree','brother'],voice:'Sarah',fetchAudio})).saved,1);assert.deepEqual(calls,[['brother','Sarah']]);
});
test('cancel, lost connection and provider rate limits stop a batch while retaining earlier clips',async()=>{
  const {caches}=storage(),audio=createAudio({caches,origin:'https://helen.test'});let calls=0;
  const result=await audio.download({words:['loan','tree','brother'],voice:'Sarah',fetchAudio:async()=>++calls===1?recording():Response.json({upstream_status:429},{status:502})});
  assert.equal(result.saved,1);assert.match(result.message,/giới hạn/);assert.equal(calls,2);assert.ok(await audio.get('loan','Sarah'));assert.equal(await audio.get('tree','Sarah'),null);
  const controller=new AbortController();const stopped=await audio.download({words:['tree'],voice:'Sarah',signal:controller.signal,fetchAudio:async()=>{controller.abort();return recording();}});
  assert.equal(stopped.cancelled,true);assert.equal(stopped.saved,0);assert.equal(await audio.get('tree','Sarah'),null);
  calls=0;const offline=await audio.download({words:['tree'],voice:'Sarah',online:()=>false,fetchAudio:()=>{calls++;}});assert.equal(calls,0);assert.match(offline.message,/Mất mạng/);
});
test('unsupported or blocked storage fails safely without pretending clips were saved',async()=>{
  const audio=createAudio({origin:'https://helen.test'});assert.equal(audio.available,false);assert.equal(await audio.get('loan','Sarah'),null);assert.equal(await audio.save('loan','Sarah',recording()),false);
  const {caches,setFull}=storage();setFull(true);const blocked=createAudio({caches,origin:'https://helen.test'});
  const outcome=await blocked.download({words:['loan'],voice:'Sarah',fetchAudio:async()=>recording()});assert.equal(outcome.saved,0);assert.match(outcome.message,/dung lượng/);
});
