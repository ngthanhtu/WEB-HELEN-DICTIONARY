const {test}=require('node:test'),assert=require('node:assert/strict');
const create=require('../public/assets/device-speech');
function fixture(voices=[]){let utterance;const calls=[],synthesis={getVoices:()=>voices,speak:u=>{utterance=u;calls.push('speak');},cancel:()=>calls.push('cancel'),resume:()=>calls.push('resume')};return {api:create({synthesis,Utterance:class{constructor(text){this.text=text;}}}),calls,get utterance(){return utterance;}};}
test('fast device speech starts inside the click before awaiting, prefers a local English voice and never calls an API',async()=>{
  const local={lang:'en-US',localService:true},f=fixture([{lang:'en-US',localService:false},local,{lang:'vi-VN',localService:true}]);
  const start=performance.now(),job=f.api.speak('education');assert.equal(f.calls.at(-1),'speak');assert.equal(f.utterance.voice,local);assert.equal(f.utterance.text,'education');assert.equal(f.utterance.volume,1);
  f.utterance.onstart();assert.equal((await job).local,true);assert.ok(performance.now()-start<1000);f.utterance.onend();
});
test('device voice preserves available British English, cancels old playback and releases completed utterances',async()=>{
  const british={lang:'en-GB',localService:true},f=fixture([british]);let old=f.api.speak('first',{accent:'Eng'});assert.equal(f.utterance.voice,british);
  const rejected=assert.rejects(old,/dừng/),next=f.api.speak('second');await rejected;assert.ok(f.calls.includes('cancel'));f.utterance.onstart();await next;f.utterance.onend();
});
test('unavailable and rejected device speech report a clear error without silently requesting ElevenLabs',async()=>{
  const unavailable=create({});assert.equal(unavailable.available,false);await assert.rejects(unavailable.speak('loan'),/chưa hỗ trợ/);
  const f=fixture(),job=f.api.speak('loan');f.utterance.onerror({error:'not-allowed'});await assert.rejects(job,/chưa sẵn sàng/);
});
test('device voice selection respects the exact voice URI, persists and never silently substitutes an unavailable choice',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},british={voiceURI:'British-natural',lang:'en-GB',name:'Natural UK',localService:true},american={voiceURI:'American-natural',lang:'en-US',name:'Natural US',localService:true};let utterance;
 const synthesis={getVoices:()=>[american,british,{voiceURI:'Vietnamese',lang:'vi-VN'}],speak:u=>utterance=u,cancel(){},addEventListener(){}};
 const createApi=()=>create({synthesis,Utterance:class{constructor(text){this.text=text;}},storage});const api=createApi();assert.equal(api.list().length,2);assert.equal(api.select('British-natural'),true);assert.equal(values.get('helen-device-voice-v1'),'British-natural');
 const reload=createApi(),job=reload.speak('learning outcomes');assert.equal(utterance.voice,british);utterance.onstart();await job;utterance.onend();
 synthesis.getVoices=()=>[american];await assert.rejects(reload.speak('education'),/chưa có trên thiết bị/);assert.equal(reload.selected(),'British-natural');assert.equal(reload.select('unknown'),false);
 assert.equal(reload.select(''),true);const automatic=reload.speak('education');assert.equal(utterance.voice,american);utterance.onstart();await automatic;utterance.onend();
});
test('device voices arriving after page load notify selectors without changing the saved choice',()=>{
 const handlers=[],voices=[],api=create({synthesis:{getVoices:()=>voices,speak(){},addEventListener:(name,fn)=>handlers.push(fn)},Utterance:class{}});let calls=0;const off=api.subscribe(()=>calls++);assert.deepEqual(api.list(),[]);
 voices.push({voiceURI:'late-voice',lang:'en-US',name:'Late voice',localService:true});handlers.forEach(fn=>fn());assert.equal(calls,1);assert.equal(api.list()[0].id,'late-voice');off();handlers.forEach(fn=>fn());assert.equal(calls,1);
});
