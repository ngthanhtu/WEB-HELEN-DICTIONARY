const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../public/assets/pronunciation.js'),'utf8');
function fixture(request){const store=new Map(),context={URLSearchParams,crypto:require('node:crypto').webcrypto,localStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},apiFetch:request};context.window=context;vm.runInNewContext(source,context);return context.HelenPronunciation;}
const proof=()=>`${Math.floor(Date.now()/1000)+86400}.test.test`;
test('speech grants survive lesson restoration without another authorization call',async()=>{
  const requests=[],api=fixture(async(url,options)=>{requests.push({url,options});return new Response('audio');});
  api.register({word:'loan',pronunciation:[{text:'We need a loan.',proof:proof(),word:'loan'}]});
  await api.request('We need a loan.','Sarah',{word:'loan'});assert.equal(requests.length,1);assert.match(requests[0].url,/voice=Sarah/);assert.match(requests[0].options.headers['X-Helen-Device'],/^[a-f0-9]{64}$/);
});
test('preparing published topic grants batches words without generating audio and a click reuses the proof',async()=>{
  const calls=[],api=fixture(async(url,options)=>{calls.push(url);if(url.includes('/api/pronunciation')){const body=JSON.parse(options.body);return Response.json({pronunciation:body.words.map(word=>({text:word,word,proof:proof()}))});}return new Response('audio');});
  await api.prepareWords(['education','learning','education']);assert.equal(calls.length,1);assert.ok(!calls[0].includes('/api/tts'));
  await api.prepareWords(['education']);assert.equal(calls.length,1);
  await api.request('education','Sarah',{word:'education'});assert.equal(calls.length,2);assert.match(calls[1],/voice=Sarah/);
});
test('rotated-key proof retries authorization once, preserves voice and sends exact lesson sense',async()=>{
  let attempts=0;const requests=[],api=fixture(async(url,options)=>{requests.push({url,options});
    if(url.includes('/api/pronunciation'))return Response.json({word:'loan',text:'We need a loan.',proof:proof()});
    attempts++;return attempts===1?Response.json({code:'PRONUNCIATION_REQUIRED'},{status:403}):new Response('audio');
  });
  api.register({pronunciation:[{text:'We need a loan.',proof:proof(),word:'loan'}]});
  const context={pos:'noun',definition:'borrowed money',language:'vi'};assert.equal((await api.request('We need a loan.','Sarah',{word:'loan',context})).ok,true);
  assert.equal(attempts,2);assert.deepEqual(JSON.parse(requests.find(item=>item.url.includes('/api/pronunciation')).options.body).context,context);
  assert.ok(requests.filter(item=>item.url.includes('/api/tts')).every(item=>new URL(item.url,'https://test').searchParams.get('voice')==='Sarah'));
});
