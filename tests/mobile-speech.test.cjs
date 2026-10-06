const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.slice(html.indexOf('const SPEECH_LANGS='),html.indexOf('\nlet aiConfigured='));

function phone({onStart=true,onStop=true,online=true,supported=true,secure=true,startError,recorder,ios=false}={}) {
  const nodes=new Map(), recognizers=[], timers=new Map(), searches=[], saved={}, documentEvents={},windowEvents={};let timerId=0;
  const node=id=>{
    if(!nodes.has(id)) nodes.set(id,{value:id==='#from'?'en':'',textContent:'',children:[],events:{},attributes:{},
      addEventListener(name,callback){this.events[name]=callback;},setAttribute(name,value){this.attributes[name]=value;},
      getAttribute(name){return this.attributes[name];},append(child){this.children.push(child);}});
    return nodes.get(id);
  };
  class Recognition {
    constructor(){recognizers.push(this);this.stops=0;this.aborts=0;}
    start(){if(startError) throw startError;if(onStart)this.onstart();}
    stop(){this.stops++;if(onStop)this.onend();}
    abort(){this.aborts++;this.onend();}
  }
  const context=vm.createContext({
    webkitSpeechRecognition:supported?Recognition:undefined,isSecureContext:secure,navigator:{onLine:online,userAgent:ios?'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari':''},HelenVoiceRecorder:recorder,
    addEventListener:(name,callback)=>windowEvents[name]=callback,
    document:{createElement:()=>node(`created-${nodes.size}`),addEventListener:(name,callback)=>documentEvents[name]=callback},
    $:node,audio:{pause(){}},remember:(key,value)=>saved[key]=value,
    searchWord:()=>searches.push({word:node('#q').value,from:node('#from').value}),
    showLoading:(element,message)=>{element.loading=true;element.textContent=message;element.children=[];},
    finishLoading:(element,message)=>{element.loading=false;element.textContent=message;element.children=[];},
    setTimeout:(callback,ms)=>{timers.set(++timerId,{callback,ms});return timerId;},clearTimeout:id=>timers.delete(id)
  });
  vm.runInContext(script,context);
  return {context,node,recognizers,timers,searches,saved,documentEvents,windowEvents,
    click:()=>node('#mic').events.click(),
    expire:()=>{const timer=[...timers.values()].at(-1);assert.ok(timer,'Expected a finite listening deadline');timer.callback();}};
}
const result=(text,isFinal=false,alternatives=[])=>Object.assign([{transcript:text},...alternatives.map(transcript=>({transcript}))],{isFinal});

test('WebKit interim-only end searches the heard word once and clears microphone loading',()=>{
  const p=phone();p.click();const mic=p.recognizers[0];
  mic.onresult({results:[result('intermediate.')]});assert.equal(p.searches.length,0);
  mic.onend();mic.onend();mic.onresult({results:[result('wrong',true)]});
  assert.deepEqual(p.searches,[{word:'intermediate',from:'en'}]);
  assert.match(p.node('#speech-status').textContent,/Nghe gần đúng/);
  assert.equal(p.node('#mic').getAttribute('aria-pressed'),'false');assert.equal(p.timers.size,0);
});

test('recognition joins final phrase segments and offers alternative words without changing language',()=>{
  const p=phone();p.node('#from').value='vi';p.click();const mic=p.recognizers[0];
  assert.equal(mic.lang,'vi-VN');assert.equal(mic.maxAlternatives,5);
  mic.onresult({resultIndex:1,results:[result('xin',true),result('chào!',true,['chào hỏi'])]});
  assert.deepEqual(p.searches,[{word:'xin chào',from:'vi'}]);
  const choice=p.node('#speech-status').children[0].children[0];assert.equal(choice.textContent,'xin chào hỏi');choice.onclick();
  assert.deepEqual(p.searches.at(-1),{word:'xin chào hỏi',from:'vi'});
  assert.equal(p.saved['helen-from'],'vi');assert.equal(p.timers.size,0);
});

test('WebKit no-speech with a partial transcript does not discard a usable word',()=>{
  const p=phone();p.click();const mic=p.recognizers[0];
  mic.onresult({results:[result('loan')]});mic.onerror({error:'no-speech'});mic.onend();
  assert.deepEqual(p.searches,[{word:'loan',from:'en'}]);assert.equal(p.node('#speech-status').loading,false);
  assert.equal(p.timers.size,0);
});

test('a normal no-speech error explains retry and permits a fresh session',()=>{
  const p=phone();p.click();p.recognizers[0].onerror({error:'no-speech'});
  assert.match(p.node('#speech-status').textContent,/Nói gần micro/);assert.equal(p.timers.size,0);
  p.click();const next=p.recognizers[1];next.onresult({results:[result('experiment',true)]});
  assert.deepEqual(p.searches,[{word:'experiment',from:'en'}]);assert.equal(p.timers.size,0);
});

test('typing cancels recognition and late old events cannot interrupt a new WebKit session',()=>{
  const p=phone();p.click();const old=p.recognizers[0];old.onresult({results:[result('old word')]});
  p.node('#q').value='typed';p.node('#q').events.input();assert.equal(old.aborts,1);
  p.click();const current=p.recognizers[1];
  old.onerror({error:'network'});old.onresult({results:[result('wrong',true)]});old.onend();
  assert.equal(p.node('#mic').getAttribute('aria-pressed'),'true');assert.equal(p.node('#q').value,'typed');
  current.onresult({results:[result('loan',true)]});assert.deepEqual(p.searches,[{word:'loan',from:'en'}]);
});

test('permission failure and a browser that never starts both leave a retryable idle microphone',()=>{
  const denied=phone({startError:Object.assign(new Error('Denied'),{name:'NotAllowedError'})});denied.click();
  assert.match(denied.node('#speech-status').textContent,/cấp quyền micro/);assert.equal(denied.timers.size,0);
  const stalled=phone({onStart:false});stalled.click();stalled.expire();
  assert.equal(stalled.node('#speech-status').loading,false);assert.match(stalled.node('#speech-status').textContent,/thử lại/);
  assert.equal(stalled.recognizers[0].aborts,1);assert.equal(stalled.timers.size,0);
});

test('stop button and listening deadline recover a draft when Safari never sends end',()=>{
  for(const stopByClick of [true,false]) {
    const p=phone({onStop:false});p.click();const mic=p.recognizers[0];mic.onresult({results:[result('environment')]});
    if(stopByClick)p.click();p.expire();
    assert.deepEqual(p.searches,[{word:'environment',from:'en'}]);assert.equal(p.node('#mic').getAttribute('aria-pressed'),'false');
    assert.equal(p.timers.size,0);
  }
});

test('WebKit nomatch recovers a heard candidate and explains an empty result',()=>{
  const p=phone();p.click();p.recognizers[0].onnomatch();assert.match(p.node('#speech-status').textContent,/Chưa nghe rõ/);
  p.click();const mic=p.recognizers[1];mic.onresult({results:[result('intermediate')]});mic.onnomatch();
  assert.deepEqual(p.searches,[{word:'intermediate',from:'en'}]);assert.equal(p.timers.size,0);
});

test('backgrounding a phone aborts recognition rather than keeping a hidden microphone open',()=>{
  const p=phone();p.click();p.context.document.hidden=true;p.documentEvents.visibilitychange();
  assert.equal(p.recognizers[0].aborts,1);assert.equal(p.timers.size,0);
  assert.equal(p.node('#mic').getAttribute('aria-pressed'),'false');
});

test('offline and unsupported browsers provide keyboard microphone guidance without claiming offline recognition',()=>{
  const offline=phone({online:false});offline.click();assert.equal(offline.recognizers.length,0);
  assert.match(offline.node('#speech-status').textContent,/Ngoại tuyến.*bàn phím/);
  const unsupported=phone({supported:false});assert.equal(unsupported.node('#mic').disabled,true);
  assert.match(unsupported.node('#speech-status').textContent,/Chrome hoặc Safari.*bàn phím/);
});

function audioRecorder() {
  let resolve,reject;
  const recorder={configured:true,ready:Promise.resolve(),starts:[],stops:0,cancels:0,
    available(){return this.configured;},
    start(options){this.starts.push(options);options.onState({state:'recording',message:'Đang nghe…'});return new Promise((ok,fail)=>{resolve=ok;reject=fail;});},
    stop(){this.stops++;this.starts.at(-1).onState({state:'transcribing',message:'Đang nhận diện…'});},
    cancel(){this.cancels++;reject(Object.assign(new Error('Canceled'),{name:'AbortError'}));},
    finish(text){resolve({text});}
  };return recorder;
}

test('iPhone Safari and standalone apps start the configured recording path directly on click',async()=>{
  const recorder=audioRecorder(),p=phone({ios:true,recorder});p.click();
  assert.equal(recorder.starts.length,1);assert.equal(p.recognizers.length,0);assert.equal(recorder.starts[0].language,'en-US');
  p.click();assert.equal(recorder.stops,1);assert.equal(p.node('#mic').getAttribute('aria-label'),'Hủy nhận diện');
  recorder.finish('intermediate.');await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(p.searches,[{word:'intermediate',from:'en'}]);assert.equal(p.node('#mic').getAttribute('aria-pressed'),'false');
});

test('typing cancels an iPhone recording and prevents its eventual upload result replacing the typed word',async()=>{
  const recorder=audioRecorder(),p=phone({ios:true,recorder});p.click();
  p.node('#q').value='loan';p.node('#q').events.input();recorder.finish('wrong');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(recorder.cancels,1);assert.equal(p.node('#q').value,'loan');assert.equal(p.searches.length,0);
  assert.equal(p.node('#mic').getAttribute('aria-pressed'),'false');
});

test('a failing native service offers recording on the next user click and never starts it automatically',async()=>{
  const recorder=audioRecorder(),p=phone({recorder});p.click();p.recognizers[0].onerror({error:'no-speech'});
  assert.equal(recorder.starts.length,0);assert.match(p.node('#speech-status').textContent,/Bấm micro lần nữa/);
  p.click();assert.equal(recorder.starts.length,1);recorder.finish('experiment');await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(p.searches,[{word:'experiment',from:'en'}]);
});

test('iPhone without a configured AI recording service keeps native WebKit speech usable',()=>{
  const recorder=audioRecorder();recorder.configured=false;const p=phone({ios:true,recorder});p.click();
  assert.equal(p.recognizers.length,1);assert.equal(recorder.starts.length,0);
  p.recognizers[0].onresult({results:[result('loan',true)]});assert.deepEqual(p.searches,[{word:'loan',from:'en'}]);
});

test('a browser without native speech enables its microphone after recording capability becomes ready',async()=>{
  const recorder=audioRecorder();let ready;recorder.configured=false;recorder.ready=new Promise(resolve=>ready=resolve);
  const p=phone({ios:true,supported:false,recorder});assert.equal(p.node('#mic').disabled,true);
  recorder.configured=true;ready();await Promise.resolve();assert.equal(p.node('#mic').disabled,false);
  p.click();recorder.finish('loan');await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(p.searches,[{word:'loan',from:'en'}]);
});

test('late recording capability after a sleeping server wakes enables the mic without starting capture',async()=>{
  const recorder=audioRecorder();recorder.configured=false;
  const p=phone({ios:true,supported:false,recorder});await Promise.resolve();assert.equal(p.node('#mic').disabled,true);
  recorder.configured=true;p.windowEvents['helen:speech-ready']();
  assert.equal(p.node('#mic').disabled,false);assert.equal(recorder.starts.length,0);
  p.click();const listening=p.node('#speech-status').textContent;
  p.windowEvents['helen:speech-ready']();assert.equal(p.node('#speech-status').textContent,listening);
  recorder.finish('loan');await new Promise(resolve=>setImmediate(resolve));
  const transcript=p.node('#speech-status').textContent;p.windowEvents['helen:speech-ready']();
  assert.equal(p.node('#speech-status').textContent,transcript);
});

test('online and phone resume refresh capabilities read-only, while active or offline capture is untouched',async()=>{
  const recorder=audioRecorder();recorder.refreshes=0;recorder.refresh=()=>{recorder.refreshes++;return Promise.resolve();};
  const p=phone({ios:true,recorder});p.windowEvents.online();p.windowEvents.pageshow();p.documentEvents.visibilitychange();
  assert.equal(recorder.refreshes,3);assert.equal(recorder.starts.length,0);
  p.click();p.windowEvents.online();p.windowEvents.pageshow();assert.equal(recorder.refreshes,3);
  p.node('#q').events.input();await Promise.resolve();p.context.navigator.onLine=false;
  p.windowEvents.online();p.documentEvents.visibilitychange();assert.equal(recorder.refreshes,3);
});
