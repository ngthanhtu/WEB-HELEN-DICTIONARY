const {test}=require('node:test');
const assert=require('node:assert/strict');
const create=require('../public/assets/practical-audio');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const clip=()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}});

test('a slow provider is bounded, aborted, and cannot start audio after its timeout',async()=>{
  let release,signal,audio,plays=0;const states=[];
  class Audio {constructor(){audio=this;}setAttribute(){}removeAttribute(){}pause(){}load(){}play(){plays++;return Promise.resolve();}}
  const player=create({AudioCtor:Audio,requestTimeout:20,URL:{createObjectURL(){assert.fail('timed out audio must not create a clip');},revokeObjectURL(){}},
    pronunciation:{request(_text,_voice,options){signal=options.signal;return new Promise(resolve=>release=resolve);}}});
  const job=player.play('A slow reply.',{voiceId:'Jessica',onState:value=>states.push(value.state)});
  await tick();assert.equal(signal.aborted,false);
  const outcome=await job;assert.equal(outcome.state,'error');assert.match(outcome.message,/chưa sẵn sàng/);assert.equal(signal.aborted,true);
  release(clip());await tick();assert.equal(plays,0);assert.deepEqual(states,['loading','error']);assert.equal(audio.onplaying,null);player.destroy();
});

for(const phase of ['starting','playing'])test(`device ${phase} timeout retains the actionable timeout explanation when cancel fires synchronously`,async()=>{
  let utterance;const states=[];
  const synthesis={getVoices:()=>[{name:'Samantha',voiceURI:'Samantha',lang:'en-US',localService:true}],resume(){},
    speak(value){utterance=value;},cancel(){utterance?.onerror?.({error:'canceled'});}};
  const player=create({synthesis,Utterance:class{constructor(text){this.text=text;}},startTimeout:phase==='starting'?20:200,playbackTimeout:phase==='playing'?20:200});
  const job=player.play('A device reply.',{method:'device',onState:value=>states.push(value.state)});
  if(phase==='playing')utterance.onstart();
  const outcome=await job;assert.equal(outcome.state,'error');assert.match(outcome.message,/chưa sẵn sàng/);
  assert.deepEqual(states,phase==='playing'?['loading','speaking','error']:['loading','error']);player.destroy();
});

test('late callbacks from a stopped device utterance never finish or change a newer reply',async()=>{
  const utterances=[],states=[];
  const synthesis={getVoices:()=>[],resume(){},speak(value){utterances.push(value);},cancel(){utterances.at(-1)?.onerror?.({error:'canceled'});}};
  const player=create({synthesis,Utterance:class{constructor(text){this.text=text;}}});
  const first=player.play('Old reply.',{method:'device',onState:value=>states.push(['old',value.state])});
  const old=utterances[0];player.stop();assert.equal((await first).state,'cancelled');
  const second=player.play('Current reply.',{method:'device',onState:value=>states.push(['current',value.state])});
  old.onstart();old.onend();old.onerror({error:'not-allowed'});
  assert.deepEqual(states,[['old','loading'],['old','cancelled'],['current','loading']]);
  utterances[1].onstart();utterances[1].onend();assert.equal((await second).state,'idle');player.destroy();
});
