const {test}=require('node:test'),assert=require('node:assert/strict');
const {create,KEY}=require('../public/assets/quiz-sounds');
function audio(state='running'){
  const oscillators=[],gains=[];let resumes=0,contexts=0;
  class AudioContext{
    constructor(){contexts++;this.state=state;this.currentTime=5;this.destination={};}
    async resume(){resumes++;this.state='running';}
    createOscillator(){const node={frequency:{setValueAtTime(value,time){node.hz=value;node.at=time;}},connect(){},disconnect(){node.disconnected=true;},start(at){node.startAt=at;},stop(at){node.stopAt=at;}};oscillators.push(node);return node;}
    createGain(){const changes=[],node={changes,gain:{setValueAtTime:(value,time)=>changes.push([value,time]),linearRampToValueAtTime:(value,time)=>changes.push([value,time]),exponentialRampToValueAtTime:(value,time)=>changes.push([value,time])},connect(){},disconnect(){node.disconnected=true;}};gains.push(node);return node;}
  }
  return {AudioContext,oscillators,gains,get resumes(){return resumes;},get contexts(){return contexts;}};
}
test('correct and wrong quiz answers have distinct short tones with a quiet envelope, without a network or ElevenLabs request',async()=>{
  const ctx=audio(),sounds=create({AudioContext:ctx.AudioContext});
  assert.equal(await sounds.play(true),true);assert.deepEqual(ctx.oscillators.map(node=>node.hz),[659.25,783.99,1046.50]);
  for(const gain of ctx.gains){assert.equal(gain.changes[0][0],0);assert.equal(gain.changes.at(-1)[0],0);assert.ok(gain.changes.every(([value])=>value<=.08));}
  ctx.oscillators.forEach(node=>node.onended());assert.ok(ctx.oscillators.every(node=>node.disconnected));
  assert.equal(await sounds.play(false),true);assert.deepEqual(ctx.oscillators.slice(3).map(node=>node.hz),[440,349.23]);assert.equal(ctx.contexts,1);
  assert.ok(ctx.oscillators.every(node=>node.stopAt-node.startAt<.4));
});
test('iOS suspended audio resumes from the answer interaction and muting persists across reloads',async()=>{
  const values={},storage={getItem:key=>values[key],setItem:(key,value)=>values[key]=value},ctx=audio('suspended');
  const sounds=create({AudioContext:ctx.AudioContext,storage});assert.equal(await sounds.play(true),true);assert.equal(ctx.resumes,1);
  sounds.setEnabled(false);assert.equal(values[KEY],'off');assert.equal(await sounds.play(false),false);
  assert.equal(create({AudioContext:ctx.AudioContext,storage}).enabled,false);
  sounds.setEnabled(true);assert.equal(values[KEY],'on');assert.equal(await sounds.play(false),true);
});
test('unavailable or denied audio leaves quiz usable and pending unlock cannot play after mute',async()=>{
  assert.equal(await create({AudioContext:null}).play(true),false);
  assert.equal(await create({AudioContext:class{constructor(){throw Error('blocked');}}}).play(false),false);
  let resume,created=0;class Deferred{constructor(){this.state='suspended';}resume(){return new Promise(resolve=>resume=()=>{this.state='running';resolve();});}createOscillator(){created++;}}
  const sounds=create({AudioContext:Deferred,storage:{getItem(){throw Error('private storage');},setItem(){throw Error('quota');}}});
  const pending=sounds.play(true);sounds.setEnabled(false);resume();assert.equal(await pending,false);assert.equal(created,0);
});
