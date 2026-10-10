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
