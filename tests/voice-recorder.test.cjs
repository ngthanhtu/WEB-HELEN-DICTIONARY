const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../public/assets/voice-recorder.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function browser({permission,upload,status,configured=true,online=true,secure=true,hasRecorder=true,level}={}) {
  let clock=0,starts=0,stops=0;const calls=[],timeouts=new Map(),intervals=new Map(),listeners={};let id=0;
  const stream={getTracks:()=>[{stop(){stops++;}}]};
  const mp4=new Blob([Buffer.from([0,0,0,24]),Buffer.from('ftypM4A '),Buffer.alloc(36)],{type:'audio/mp4'});
  class Recorder {
    static isTypeSupported(type){return type==='audio/mp4';}
    constructor(actualStream,options){assert.equal(actualStream,stream);this.mimeType=options.mimeType;this.state='inactive';}
    start(){starts++;this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable?.({data:mp4});this.onstop?.();}
  }
  class Context {
    resume(){return Promise.resolve();} close(){return Promise.resolve();}
    createMediaStreamSource(){return {connect(){}};}
    createAnalyser(){return {fftSize:512,getByteTimeDomainData(bytes){bytes.fill(level?.() || 128);}};}
  }
  const doc={hidden:false,addEventListener(name,fn){listeners[name]=fn;}};
  const context={console,Blob,btoa,Uint8Array,AbortController,CustomEvent,isSecureContext:secure,
    navigator:{onLine:online,mediaDevices:{getUserMedia(options){calls.push({permission:options});return permission ? permission(stream) : Promise.resolve(stream);}}},
    MediaRecorder:hasRecorder ? Recorder : undefined,AudioContext:level ? Context : undefined,performance:{now:()=>clock},document:doc,
    addEventListener(name,fn){listeners[name]=fn;},
    dispatchEvent(event){listeners[event.type]?.(event);return true;},
    setTimeout(fn,ms){timeouts.set(++id,{fn,ms});return id;},clearTimeout(timer){timeouts.delete(timer);},
    setInterval(fn,ms){intervals.set(++id,{fn,ms});return id;},clearInterval(timer){intervals.delete(timer);},
    async fetch(url,options={}){calls.push({url,options});if(url.endsWith('/status')) return status ? status(url,options) : Response.json({configured});return upload ? upload(url,options) : Response.json({text:'intermediate',language:'en'});}
  };
  vm.runInNewContext(source,context);
  return {api:context.HelenVoiceRecorder,calls,doc,listeners,timeouts,intervals,navigator:context.navigator,get starts(){return starts;},get stops(){return stops;},set clock(value){clock=value;},runTimer(ms){const entry=[...timeouts.values()].find(item=>item.ms===ms);assert.ok(entry,`Missing timer ${ms}`);entry.fn();}};
}

test('iOS capture starts inside the tap, selects MP4 and releases microphone after early stop',async()=>{
  const b=browser();await b.api.ready;const states=[];
  const pending=b.api.start({language:'en-US',onState:state=>states.push(state)});
  assert.ok(b.calls.find(item=>item.permission),'Permission request must happen synchronously');
  await tick();assert.equal(b.starts,1);assert.equal(b.api.state,'recording');
  b.clock=1000;assert.equal(b.api.stop(),true);
  const result=await pending;
  assert.equal(result.text,'intermediate');assert.equal(b.api.isActive(),false);assert.ok(b.stops>=1);
  assert.deepEqual(states.map(item=>item.state),['requesting','recording','transcribing']);
  assert.match(states[0].message,/gửi Gemini/);
  const body=JSON.parse(b.calls.find(item=>item.url==='/api/speech').options.body);
  assert.equal(body.mimeType,'audio/mp4');assert.equal(body.language,'en-US');assert.equal(body.durationMs,1000);assert.ok(body.audio.length);
});

test('canceling while permission is pending cannot start a stale recorder',async()=>{
  let allow;const b=browser({permission:stream=>new Promise(resolve=>{allow=()=>resolve(stream);})});await b.api.ready;
  const pending=b.api.start();const rejected=assert.rejects(pending,{name:'AbortError'});
  b.api.cancel();allow();await rejected;await tick();
  assert.equal(b.starts,0);assert.equal(b.stops,1);assert.equal(b.calls.filter(item=>item.url==='/api/speech').length,0);
});

test('permission denial and unsupported/offline configurations offer concise fallback messages',async()=>{
  const denied=browser({permission:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))});await denied.api.ready;
  await assert.rejects(denied.api.start(),error=>error.code==='SPEECH_PERMISSION' && /Safari/.test(error.message));
  for(const opts of [{configured:false},{hasRecorder:false},{secure:false}]) {const b=browser(opts);await b.api.ready;assert.equal(b.api.available(),false);await assert.rejects(b.api.start(),error=>error.code==='SPEECH_UNAVAILABLE');}
  const offline=browser({online:false});await offline.api.ready;await assert.rejects(offline.api.start(),error=>error.code==='SPEECH_CONNECTION' && /ngoại tuyến/.test(error.message));
});

test('upload cancellation/backgrounding stops tracks and ignores late transcripts',async()=>{
  let respond;const b=browser({upload:()=>new Promise(resolve=>{respond=()=>resolve(Response.json({text:'late result',language:'en'}));})});await b.api.ready;
  const pending=b.api.start();const rejected=assert.rejects(pending,{name:'AbortError'});await tick();b.clock=1000;b.api.stop();await tick();
  assert.equal(b.api.state,'transcribing');b.doc.hidden=true;b.listeners.visibilitychange();await rejected;
  respond();await tick();assert.equal(b.api.isActive(),false);assert.ok(b.stops>=1);
});

test('max recording duration submits and provider timeout ends loading cleanly',async()=>{
  const b=browser({upload:()=>new Promise(()=>{})});await b.api.ready;
  const pending=b.api.start();const rejected=assert.rejects(pending,error=>error.code==='SPEECH_TIMEOUT');await tick();
  b.clock=10000;b.runTimer(10000);await tick();assert.equal(b.api.state,'transcribing');
  b.runTimer(7500);await rejected;assert.equal(b.api.isActive(),false);assert.ok(b.stops>=1);
});

test('silence detection ends recording after a spoken word without waiting ten seconds',async()=>{
  let amplitude=144;const b=browser({level:()=>amplitude});await b.api.ready;
  const pending=b.api.start();await tick();const check=[...b.intervals.values()][0].fn;
  b.clock=100;check();b.clock=200;check();amplitude=128;b.clock=1250;check();
  const result=await pending;assert.equal(result.text,'intermediate');assert.equal(b.api.isActive(),false);
});

test('a recording with no captured voice stops without an unnecessary AI request',async()=>{
  const b=browser({level:()=>128});await b.api.ready;
  const pending=b.api.start();const rejected=assert.rejects(pending,error=>error.code==='SPEECH_NO_VOICE');await tick();
  b.clock=6100;[...b.intervals.values()][0].fn();await rejected;
  assert.equal(b.calls.filter(item=>item.url==='/api/speech').length,0);assert.ok(b.stops>=1);
});

test('a cold status failure retries on reconnect and coalesces concurrent refreshes',async()=>{
  let attempts=0,respond;const b=browser({status:()=>{
    attempts++;if(attempts===1) return Promise.reject(new Error('Sleeping service'));
    return new Promise(resolve=>{respond=()=>resolve(Response.json({configured:true}));});
  }});
  await b.api.ready;assert.equal(b.api.available(),false);let events=0;
  b.listeners['helen:speech-ready']=event=>{events++;assert.equal(event.detail.configured,true);};
  b.listeners.online();const first=b.api.refresh(),second=b.api.refresh();
  assert.equal(first,second);assert.equal(attempts,2);respond();
  assert.equal(await first,true);assert.equal(b.api.available(),true);assert.equal(events,1);assert.equal(b.starts,0);
});

test('offline status makes no requests and resume retries a failed capability check',async()=>{
  let attempts=0;const b=browser({online:false,status:()=>{attempts++;return Response.json({configured:true});}});
  await b.api.ready;await b.api.refresh();assert.equal(attempts,0);
  b.navigator.onLine=true;b.doc.hidden=false;b.listeners.visibilitychange();await b.api.refresh();
  assert.equal(attempts,1);assert.equal(b.api.available(),true);assert.equal(b.starts,0);
});

test('transient status errors retain confirmed capability while server disable removes it',async()=>{
  let mode='ok';const b=browser({status:()=>mode==='error' ? Promise.reject(new Error('Offline')) : mode==='busy' ? new Response('Busy',{status:503}) : Response.json({configured:mode!=='disabled'})});
  await b.api.ready;assert.equal(b.api.available(),true);
  mode='error';await b.api.refresh();assert.equal(b.api.available(),true);
  mode='busy';await b.api.refresh();assert.equal(b.api.available(),true);
  mode='disabled';await b.api.refresh();assert.equal(b.api.available(),false);
});

test('a very short audible word is enough to end after the quiet interval',async()=>{
  let amplitude=144;const b=browser({level:()=>amplitude});await b.api.ready;
  const pending=b.api.start();await tick();const check=[...b.intervals.values()][0].fn;
  b.clock=100;check();amplitude=128;b.clock=1100;check();
  assert.equal((await pending).text,'intermediate');assert.equal(b.api.isActive(),false);
});
