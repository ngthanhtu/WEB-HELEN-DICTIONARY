const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../public/assets/live-transcript.js'),'utf8');
function fixture({unsupported=false,failStart=false}={}){
 const instances=[],changes=[],states=[],timers=new Map();let id=0;
 class Recognition{constructor(){instances.push(this);}start(){if(failStart)throw Error('unavailable');this.onstart?.();}stop(){this.stopped=true;}abort(){this.aborted=true;this.onend?.();}}
 const root={webkitSpeechRecognition:unsupported?undefined:Recognition,setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}};vm.runInNewContext(source,root);
 const api=root.HelenLiveTranscript.create(),start=()=>api.start({onChange:info=>changes.push(info),onState:value=>states.push(value)});
 const result=(items,index=0)=>instances.at(-1).onresult({resultIndex:index,results:items.map(([text,final=false])=>Object.assign([{transcript:text}],{isFinal:final}))});
 return {api,start,result,instances,changes,states,timers,tick(ms){const timer=[...timers].find(([,v])=>v.ms===ms);assert.ok(timer);timers.delete(timer[0]);timer[1].fn();}};
}
test('interim words replace their slot while preserving actual errors, fillers and repeated starts',()=>{
 const f=fixture(),handle=f.start();f.result([['Um I ha']]);assert.equal(handle.text,'Um I ha');f.result([['Um I has a']]);assert.equal(handle.text,'Um I has a');
 f.result([['Um I has a job.',true],['I I work']]);f.result([['Um I has a job.',true],['I I work in fintech.']],1);
 assert.equal(handle.text,'Um I has a job. I I work in fintech.');assert.ok(f.changes.every(v=>v.provisional && v.source==='browser'));
 assert.equal(f.instances[0].continuous,true);assert.equal(f.instances[0].interimResults,true);assert.equal(f.instances[0].maxAlternatives,1);
});
test('mobile pause restarts retain previous text and do not append interim revisions twice',()=>{
 const f=fixture(),handle=f.start();f.result([['Let me think.',true],['I enjoy work']]);f.instances[0].onend();f.tick(250);assert.equal(f.instances.length,2);
 f.result([['Um I work with doctors.']]);assert.equal(handle.text,'Let me think. I enjoy work Um I work with doctors.');
 handle.stop();f.instances[1].onend();assert.equal(f.timers.size,0);assert.equal(f.instances.length,2);
});
test('stop permits a final recognition result but late results after cancel cannot replace a saved draft',()=>{
 const f=fixture(),handle=f.start();f.result([['I has']]);handle.stop();assert.ok(f.instances[0].stopped);f.result([['I has a coffee.',true]]);assert.equal(handle.text,'I has a coffee.');f.tick(1000);
 const count=f.changes.length;f.result([['late invented text']]);assert.equal(f.changes.length,count);
 const second=f.start();f.result([['My new answer']]);second.cancel();assert.equal(second.text,'My new answer');assert.ok(f.instances[1].aborted);
});
test('unavailable, denied and failed recognition are explicit and do not loop or request Gemini',()=>{
 for(const options of [{unsupported:true},{failStart:true}]){const f=fixture(options);const h=f.start();assert.equal(h.text,'');assert.equal(f.timers.size,0);assert.ok(f.states.includes(options.unsupported?'unsupported':'unavailable'));}
 for(const error of ['network','not-allowed','service-not-allowed','audio-capture']){const f=fixture();f.start();f.result([['Already saved words']]);f.instances[0].onerror({error});f.instances[0].onend();assert.equal(f.timers.size,0);assert.equal(f.changes.at(-1).text,'Already saved words');}
});
test('starting a new capture cancels old callbacks and caps the editable text at its supported length',()=>{
 const f=fixture(),first=f.start();f.result([['Old answer']]);const second=f.start(),old=f.instances[0];old.onresult({results:[[{transcript:'late old result'}]]});f.result([['word '.repeat(1300)]]);assert.equal(second.text.length,6000);assert.equal(first.text,'Old answer');assert.ok(old.aborted);
});
test('a recognizer that immediately ends repeatedly stops rather than spinning for three minutes',()=>{
 const f=fixture();f.start();for(let i=0;i<2;i++){f.instances.at(-1).onend();f.tick(250);}f.instances.at(-1).onend();assert.equal(f.instances.length,3);assert.equal(f.timers.size,0);assert.ok(f.states.includes('unavailable'));
});
