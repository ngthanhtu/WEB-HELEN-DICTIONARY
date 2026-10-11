const {test}=require('node:test'),assert=require('node:assert/strict');
const create=require('../public/assets/practical-audio');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const sound=()=>new Response(new Uint8Array([1,2,3,4]),{headers:{'Content-Type':'audio/mpeg'}});
function fixture(options={}){
  const created=[],revoked=[],requests=[],saved=[],states=[];let instance,serial=0;
  class AudioMock{
    constructor(){instance=this;created.push(this);this.calls=[];this.playImpl=()=>Promise.resolve();}
    setAttribute(){}removeAttribute(){this.src='';}load(){this.calls.push('load');}pause(){this.calls.push('pause');}
    play(){this.calls.push('play');return this.playImpl();}
  }
  const URL={createObjectURL:blob=>{const url=`blob:clip-${++serial}`;created.push({url,blob});return url;},revokeObjectURL:url=>revoked.push(url)};
  const pronunciation={request:async(...args)=>{requests.push(args);return sound();}};
  const offlineAudio={get:async()=>null,save:async(...args)=>{saved.push(args);return true;}};
  const api=create({AudioCtor:AudioMock,URL,pronunciation,offlineAudio,...options});
  return {api,created,revoked,requests,saved,states,get audio(){return instance;},play:(text='Hello!',extra={})=>api.play(text,{voiceId:'cuteVoice',onState:state=>states.push(state),...extra})};
}
test('gesture unlock starts one silent Blob WAV synchronously without contacting a provider and reuses its Audio element',async()=>{
  const f=fixture(),job=f.api.unlock();assert.equal(f.audio.calls.at(-1),'play');assert.equal(f.created[1].blob.type,'audio/wav');assert.equal(f.requests.length,0);assert.equal(f.created.filter(item=>item.calls).length,1);assert.equal(await job,true);
  const speech=f.play();await tick();assert.equal(f.created.filter(item=>item.calls).length,1);f.audio.onplaying();f.audio.onended();assert.equal((await speech).state,'idle');f.api.destroy();assert.ok(f.revoked.includes('blob:clip-1'));
});
test('voice state follows actual media playing and ending, not the asynchronous play promise alone',async()=>{
  const f=fixture(),job=f.play();assert.equal(f.states[0].state,'loading');await tick();assert.equal(f.states.length,1);let finished=false;job.then(()=>finished=true);await tick();assert.equal(finished,false);
  f.audio.onplaying();assert.equal(f.states.at(-1).state,'speaking');f.audio.onended();assert.deepEqual(await job,{state:'idle'});assert.equal(f.states.at(-1).state,'idle');assert.ok(f.revoked.includes('blob:clip-1'));assert.equal(f.saved[0][1],'cuteVoice');
});
test('cached exact text and selected voice plays offline without requesting pronunciation or a provider',async()=>{
  const lookups=[],f=fixture({offlineAudio:{get:async(text,voice)=>{lookups.push([text,voice]);return sound();},save:()=>assert.fail('cached clip must not be saved again')}}),job=f.play('Good morning!',{voiceId:'Jessica'});
  await tick();assert.deepEqual(lookups,[['Good morning!','Jessica']]);assert.equal(f.requests.length,0);f.audio.onplaying();f.audio.onended();await job;
});
test('Safari autoplay rejection is actionable, makes one attempt, and never silently switches voices',async()=>{
  const f=fixture();f.audio.playImpl=()=>Promise.reject(Object.assign(Error('denied'),{name:'NotAllowedError'}));const outcome=await f.play();assert.equal(outcome.state,'blocked');assert.match(outcome.message,/Bấm nút nghe/);assert.equal(f.states.at(-1).state,'blocked');assert.equal(f.audio.calls.filter(call=>call==='play').length,1);assert.equal(f.requests.length,1);assert.equal(f.requests[0][1],'cuteVoice');assert.ok(f.revoked.includes('blob:clip-1'));
});
test('cancelled provider work cannot play after a newer reply; cancellation settles promptly and aborts the request',async()=>{
  let finishFirst,firstSignal;const f=fixture({pronunciation:{request:(_text,_voice,{signal})=>{firstSignal=signal;return new Promise(resolve=>finishFirst=resolve);}}}),old=f.play('First reply');await tick();f.api.stop();assert.deepEqual(await old,{state:'cancelled'});assert.equal(firstSignal.aborted,true);
  const fresh=f.play('New reply',{method:'device'});assert.equal((await fresh).state,'error');finishFirst(sound());await tick();assert.equal(f.audio.calls.filter(call=>call==='play').length,0);assert.equal(f.created.filter(item=>item.url).length,0);
});
test('stop revokes playing audio and stale media callbacks cannot alter the next conversation state',async()=>{
  const f=fixture(),first=f.play('First');await tick();const onEnd=f.audio.onended;f.audio.onplaying();f.api.stop();assert.equal((await first).state,'cancelled');assert.ok(f.revoked.includes('blob:clip-1'));assert.equal(f.audio.onended,null);const next=f.play('Second');await tick();onEnd();assert.equal(f.states.at(-1).state,'loading');f.audio.onplaying();f.audio.onended();assert.equal((await next).state,'idle');
});
test('late silent unlock resolution cannot pause a subsequent assistant reply',async()=>{
  const f=fixture();let resolveUnlock;f.audio.playImpl=()=>new Promise(resolve=>resolveUnlock=resolve);const unlocked=f.api.unlock();f.audio.playImpl=()=>Promise.resolve();const reply=f.play();await tick();const pauses=f.audio.calls.filter(call=>call==='pause').length;resolveUnlock();await unlocked;assert.equal(f.audio.calls.filter(call=>call==='pause').length,pauses);f.audio.onended();await reply;
});
test('device speech chooses an English friendly voice independently of dictionary preferences and waits for actual end',async()=>{
  let utterance;const calls=[],samantha={voiceURI:'Samantha',name:'Samantha',lang:'en-US',localService:true},other={voiceURI:'old-dictionary-voice',name:'Old voice',lang:'en-GB',localService:true};const synthesis={getVoices:()=>[other,samantha],resume:()=>calls.push('resume'),speak:value=>{utterance=value;calls.push('speak');},cancel(){utterance?.onerror?.({error:'canceled'});}};
  const f=fixture({synthesis,Utterance:class{constructor(text){this.text=text;}}}),job=f.play('Have a nice day.',{method:'device'});assert.equal(calls.at(-1),'speak');assert.equal(utterance.voice,samantha);assert.equal(utterance.volume,1);assert.equal(f.requests.length,0);assert.equal(f.api.listDeviceVoices().length,2);
  utterance.onstart();assert.equal(f.states.at(-1).state,'speaking');let done=false;job.then(()=>done=true);await tick();assert.equal(done,false);utterance.onend();assert.equal((await job).state,'idle');
  const second=f.play('Again',{method:'device',deviceVoiceId:other.voiceURI});assert.equal(utterance.voice,other);f.api.stop();assert.equal((await second).state,'cancelled');
});
test('an unavailable explicit device voice or absent Audio API fails clearly without substituting a provider voice',async()=>{
  const f=fixture({synthesis:{getVoices:()=>[],speak(){assert.fail('unavailable voice must not speak');}},Utterance:class{}});assert.match((await f.play('Hello',{method:'device',deviceVoiceId:'missing'})).message,/chọn lại giọng/);assert.equal(f.requests.length,0);
  const absent=create({});assert.equal(absent.available,false);assert.equal(await absent.unlock(),false);assert.equal((await absent.play('Hello',{voiceId:'Jessica'})).state,'error');absent.destroy();
});
test('quota denial reports the backend explanation without playback, fallback or repeated attempts',async()=>{
  let requests=0;const f=fixture({pronunciation:{request:async()=>{requests++;return new Response(JSON.stringify({error:'Đã hết hạn mức giọng đọc hôm nay.'}),{status:429,headers:{'Content-Type':'application/json'}});}}});const result=await f.play();assert.equal(result.state,'error');assert.match(result.message,/hạn mức/);assert.equal(requests,1);assert.equal(f.audio.calls.filter(call=>call==='play').length,0);
});

test('opted-in quota fallback reads the same reply with the device voice, announces the switch, and makes no second provider request',async()=>{
 for(const code of ['VOICE_QUOTA','USAGE_LIMIT']){
  let utterance,switched=0,calls=0;
  const f=fixture({pronunciation:{request:async()=>{calls++;return Response.json({error:'Quota used',code},{status:429});}},synthesis:{getVoices:()=>[{voiceURI:'Samantha',name:'Samantha',lang:'en-US',localService:true}],speak:value=>utterance=value,resume(){},cancel(){}},Utterance:class{constructor(text){this.text=text;}}});
  const job=f.play('The same reply.',{fallbackOnQuota:true,onQuota:()=>switched++});await tick();
  assert.equal(switched,1);assert.equal(calls,1);assert.equal(utterance.text,'The same reply.');assert.equal(utterance.voice.name,'Samantha');assert.match(f.states.at(-1).message,/hết quota/);
  utterance.onstart();assert.equal(f.states.at(-1).method,'device');utterance.onend();assert.equal((await job).state,'idle');assert.equal(f.audio.calls.filter(call=>call==='play').length,0);
 }
});
test('fallback never hides authentication, proof, unavailable voice, rate limit or general provider failures',async()=>{
 for(const [status,code] of [[401,'VOICE_AUTH'],[403,'PRONUNCIATION_REQUIRED'],[403,'VOICE_ACCESS'],[429,undefined],[503,'SERVICE']]){
  const f=fixture({pronunciation:{request:async()=>Response.json({error:'Failure',code},{status})},synthesis:{speak:()=>assert.fail('must not substitute a voice')},Utterance:class{}});
  assert.equal((await f.play('Hello',{fallbackOnQuota:true,onQuota:()=>assert.fail('not a quota failure')})).state,'error');
 }
});
test('cached selected-voice audio remains first choice with fallback enabled and no quota lookup',async()=>{
 const f=fixture({offlineAudio:{get:async()=>sound()},synthesis:{speak:()=>assert.fail('cached voice must remain selected')},Utterance:class{}}),job=f.play('Cached',{fallbackOnQuota:true});await tick();assert.equal(f.requests.length,0);f.audio.onplaying();f.audio.onended();assert.equal((await job).state,'idle');
});
test('gesture-unlocked Web Audio plays the same AI clip automatically when Safari blocks delayed media playback',async()=>{
 let context,source;const calls=[];
 class Context{constructor(){context=this;this.state='suspended';this.destination={};}resume(){calls.push('resume');this.state='running';return Promise.resolve();}decodeAudioData(bytes){assert.ok(bytes.byteLength);return Promise.resolve({duration:1});}createBufferSource(){source={connect(destination){assert.equal(destination,context.destination);},start(){calls.push('start');},stop(){calls.push('stop');}};return source;}close(){calls.push('close');return Promise.resolve();}}
 const f=fixture({AudioContextCtor:Context});const warm=f.api.unlock();assert.equal(calls[0],'resume');await warm;
 f.audio.playImpl=()=>Promise.reject(new DOMException('Gesture expired','NotAllowedError'));
 const job=f.play('A real automatic reply.');await tick();await tick();assert.equal(f.states.at(-1).state,'speaking');assert.equal(f.requests.length,1);assert.equal(calls.at(-1),'start');source.onended();assert.equal((await job).state,'idle');f.api.destroy();assert.ok(calls.includes('close'));
});
test('cancel during Web Audio decode cannot start a late reply',async()=>{
 let decode,started=0;
 class Context{constructor(){this.state='running';}resume(){return Promise.resolve();}decodeAudioData(){return new Promise(resolve=>decode=resolve);}createBufferSource(){return {connect(){},start(){started++;},stop(){}};}close(){}}
 const f=fixture({AudioContextCtor:Context});await f.api.unlock();f.audio.playImpl=()=>Promise.reject(new DOMException('blocked','NotAllowedError'));const job=f.play('Late reply');await tick();f.api.stop();assert.equal((await job).state,'cancelled');decode({duration:1});await tick();assert.equal(started,0);f.api.destroy();
});
