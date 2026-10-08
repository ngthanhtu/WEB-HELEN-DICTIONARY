const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const script = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').split('<script>')[1].split('</script>')[0];
function page(saved = {}, lookupFetch = null, browser = {}, actionFetch = null) {
  const elements = new Map(), created = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id,{value:'',textContent:'',events:{},innerHTML:'',append(){},insertAdjacentHTML(){},querySelector(){return null;},add(option){(this.options ||= []).push(option);},replaceChildren(){this.options=[];},setAttribute(name,value){(this.attributes ||= {})[name]=value;},getAttribute(name){return this.attributes?.[name];},removeAttribute(name){if(this.attributes) delete this.attributes[name];},addEventListener(name,fn){const before=this.events[name];this.events[name]=(...args)=>{before?.(...args);return fn(...args);};}});
    return elements.get(id);
  };
  const requests=[];
  const context = vm.createContext({HelenSenses:require('../public/assets/sense-core'),document:{documentElement:{dataset:{}},createElement:()=>{ const node=element(`#created-${created.length}`), children=new Map(); node.querySelectorAll=sel=>[node.querySelector(sel)]; node.querySelector=sel=>{if(!children.has(sel)) children.set(sel,element(`#child-${created.length}-${sel}`)); return children.get(sel);}; created.push(node); return node; },querySelector:element,querySelectorAll:()=>[]}, localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v}, Image:class {}, Option:class {constructor(text,value){this.text=text;this.value=value;}}, URL, Audio:class {}, setTimeout, clearTimeout, fetch:async(url,options)=>{
    requests.push({url,options});
    if(actionFetch) {const reply=actionFetch(url,options);if(reply!==undefined) return reply;}
    if(url.includes('/api/context/status')) return {ok:true,json:async()=>({configured:false})};
    if(url.includes('/api/voices')) return {ok:true,json:async()=>({in_use:'Rachel',voices:[{name:'Rachel',voice_id:'Rachel',category:'premade',dialect:'Ame'},{name:'Sarah',voice_id:'Sarah',category:'premade',dialect:'Eng'}]})};
    if(url.includes('/api/spelling')) return {ok:true,json:async()=>({word:new URL(url,'http://test').searchParams.get('word'),suggestions:['experience','experiment']})};
    if(url.includes('/api/lookup')) { if(lookupFetch) return lookupFetch(url); const query = new URL(url, 'http://test').searchParams; if(query.get('word')==='experimence') return {ok:false,status:404,json:async()=>({word:'experimence',suggestions:['experience','experiment']})}; return {ok:true,json:async()=>({query:query.get('word'),word:'hello',from:query.get('from'),entries:[{word:'hello',meanings:[],source:'test'}]})}; }
    if(url.includes('/api/tts')) return {ok:false};
    const body=JSON.parse(options.body); return {ok:true,json:async()=>({translations:[`${body.to}:hello`]})};
  },...browser});
  vm.runInContext(script,context);
  return {context,element,requests,saved,created};
}
test('selected voice survives a reload and TTS failure',async()=>{
  const p=page(); await vm.runInContext('loadVoices()',p.context);
  p.element('#voice').value='Sarah'; p.element('#voice').events.change();
  const reloaded=page(p.saved); await vm.runInContext('loadVoices()',reloaded.context);
  assert.equal(reloaded.element('#voice').value,'Sarah');
  await vm.runInContext("speak('hello', document.querySelector('#button'))",reloaded.context);
  assert.ok(reloaded.requests.some(r=>r.url.includes('voice=Sarah')));
  assert.equal(reloaded.saved['helen-voice'],'Sarah');
  assert.match(reloaded.element('#voice-status').textContent,/selection has been kept/);
});
test('changing target requests and displays the selected language immediately',async()=>{
  const p=page();
  vm.runInContext("lastResult = {word:'hello'}",p.context);
  p.element('#target').value='ja'; p.element('#target').events.change();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(p.element('#word-translation').textContent,'日本語: ja:hello');
  assert.equal(p.saved['helen-target'],'ja');
  assert.equal(JSON.parse(p.requests.find(r=>r.url.includes('/api/translate')).options.body).to,'ja');
});
test('the headword summary sends common senses from noun, verb and adjective groups',async()=>{
  const p=page();
  vm.runInContext("lastResult={word:'draft',entries:[{meanings:[{pos:'noun',senses:[{definition:'a preliminary text'},{definition:'a current of air'}]},{pos:'verb',senses:[{definition:'write a preliminary text'}]},{pos:'adjective',senses:[{definition:'preliminary'}]}]}]}",p.context);
  await vm.runInContext('updateWordTranslation()',p.context);
  const body=JSON.parse(p.requests.find(request=>request.url.includes('/api/translate')).options.body);
  assert.deepEqual(body.senses.map(sense=>sense.pos),['noun','noun','verb','adjective']);
  assert.equal(body.senses[1].definition,'a current of air');
});
test('saved translations survive reload, separate languages and stay usable offline',async()=>{
  const p=page();assert.deepEqual(Array.from(await vm.runInContext("tr(['hello'],'en','vi')",p.context)),['vi:hello']);
  const reloaded=page(p.saved,null,{},url=>url.includes('/api/translate')?Promise.reject(new Error('offline')):undefined);
  assert.deepEqual(Array.from(await vm.runInContext("tr(['hello'],'en','vi')",reloaded.context)),['vi:hello']);
  assert.equal(reloaded.requests.filter(request=>request.url.includes('/api/translate')).length,0);
  await assert.rejects(vm.runInContext("tr(['hello'],'en','ja')",reloaded.context),/offline/);
});
test('online semantic glosses replace old literal headword cache while offline access is retained',async()=>{
  const oldKey=JSON.stringify([['name after'],'en','vi','headword','to name in honour of']);
  const saved={'helen-translations':JSON.stringify([{key:oldKey,at:Date.now(),values:['tên sau']}])};
  const p=page({...saved});
  assert.deepEqual(Array.from(await vm.runInContext("tr(['name after'],'en','vi',{kind:'headword',definition:'to name in honour of'})",p.context)),['vi:hello']);
  assert.equal(p.requests.filter(request=>request.url.includes('/api/translate')).length,1);
  const offlinePage=page({...saved},null,{navigator:{onLine:false}});
  assert.deepEqual(Array.from(await vm.runInContext("tr(['name after'],'en','vi',{kind:'headword',definition:'to name in honour of'})",offlinePage.context)),['tên sau']);
});
test('slow mobile requests cancel, retain POST data and report a retryable deadline',async()=>{
  const p=page({},null,{AbortController,setTimeout:(fn,ms)=>setTimeout(fn,ms===7500?20:ms)},(url,options)=>url==='/slow'?new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')))):undefined);
  await assert.rejects(vm.runInContext("apiFetch('/slow',{method:'POST',body:'kept'})",p.context),/7,5 giây/);
  const request=p.requests.find(request=>request.url==='/slow');assert.equal(request.options.method,'POST');assert.equal(request.options.body,'kept');assert.equal(request.options.signal.aborted,true);
});

test('theme switch applies both themes and keeps the selection after reload',()=>{
  const p=page();
  assert.equal(vm.runInContext('document.documentElement.dataset.theme',p.context),'light');
  p.element('#theme-toggle').checked=true; p.element('#theme-toggle').events.change();
  const reloaded=page(p.saved);
  assert.equal(vm.runInContext('document.documentElement.dataset.theme',reloaded.context),'dark');
  assert.equal(reloaded.element('#theme-toggle').checked,true);
  reloaded.element('#theme-toggle').checked=false; reloaded.element('#theme-toggle').events.change();
  assert.equal(reloaded.saved['helen-theme'],'light');
});

test('restores the search text and source language and fetches results after reload',async()=>{
  const p=page();
  p.element('#q').value='xin chào'; p.element('#q').events.input();
  p.element('#from').value='vi'; p.element('#from').events.change();
  const reloaded=page(p.saved);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reloaded.element('#q').value,'xin chào');
  assert.equal(reloaded.element('#from').value,'vi');
  const request=reloaded.requests.find(r=>r.url.includes('/api/lookup'));
  const params=new URL(request.url,'http://test').searchParams;
  assert.equal(params.get('word'),'xin chào'); assert.equal(params.get('from'),'vi');
  assert.equal(vm.runInContext('lastResult.word',reloaded.context),'hello');
});

test('every definition has a working speaker independent of example speakers',async()=>{
  const p=page();
  const definitions=['The surroundings of a particular item of interest.', 'The software or hardware on a computer system.'];
  const example='That program uses the Microsoft Windows environment.';
  const data={from:'en',query:'environment',word:'environment',entries:[{word:'environment',source:'test',meanings:[{pos:'noun',synonyms:[],senses:[{definition:definitions[0],example:''},{definition:definitions[1],example}]}]}]};
  vm.runInContext(`render(${JSON.stringify(data)}, false)`,p.context);
  const rows=p.created.filter(n=>n.className==='sense');
  assert.equal(rows.length,2);
  for(let i=0;i<rows.length;i++){
    assert.match(rows[i].innerHTML,/Hear definition/);
    await rows[i].querySelector('.definition-say').onclick({currentTarget:p.element('#test-button')});
    const request=p.requests.filter(r=>r.url.includes('/api/tts')).at(-1);
    assert.equal(new URL(request.url,'http://test').searchParams.get('text'),definitions[i]);
  }
  await rows[1].querySelector('.ex .example-say').onclick({currentTarget:p.element('#test-button')});
  assert.equal(new URL(p.requests.filter(r=>r.url.includes('/api/tts')).at(-1).url,'http://test').searchParams.get('text'),example);
});


test('spelling suggestions rerun lookup in English and failures do not enter history',async()=>{
  const p=page(); p.element('#q').value='experimence';
  await vm.runInContext('searchWord()',p.context);
  assert.match(p.element('#out').innerHTML,/experimence/);
  assert.equal(p.saved['helen-history'],undefined);
  const suggestion=p.created.find(node=>node.className==='word-link' && node.textContent==='experiment');
  assert.ok(suggestion); suggestion.onclick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(p.element('#q').value,'experiment'); assert.equal(p.element('#from').value,'en');
  const params=new URL(p.requests.filter(r=>r.url.includes('/api/lookup')).at(-1).url,'http://test').searchParams;
  assert.equal(params.get('word'),'experiment');
  assert.equal(vm.runInContext('lastResult.query',p.context),'experiment');
});
test('favorites persist, open a saved lookup and can be removed without deleting history',async()=>{
  const p=page(); vm.runInContext("toggleFavorite('experiment', document.querySelector('#test-star'))",p.context);
  const reloaded=page(p.saved);
  assert.deepEqual(JSON.parse(reloaded.saved['helen-favorites']),['experiment']);
  const saved=reloaded.created.find(node=>node.className==='word-link' && node.textContent==='experiment');
  saved.onclick(); await new Promise(resolve=>setImmediate(resolve));
  assert.ok(reloaded.requests.some(request=>request.url.includes('word=experiment')));
  vm.runInContext("toggleFavorite('experiment', document.querySelector('#test-star'))",reloaded.context);
  assert.deepEqual(JSON.parse(reloaded.saved['helen-favorites']),[]);
  assert.deepEqual(JSON.parse(reloaded.saved['helen-history']),['hello']);
});
test('history is deduplicated, bounded and can be cleared without removing favorites',()=>{
  const p=page({'helen-favorites':'["experiment"]'});
  vm.runInContext("for(let i=0;i<45;i++) addHistory('word'+i); addHistory('word40')",p.context);
  const history=JSON.parse(p.saved['helen-history']);
  assert.equal(history.length,40); assert.equal(history[0],'word40'); assert.equal(history.filter(word=>word==='word40').length,1);
  p.element('#clear-history').events.click();
  assert.deepEqual(JSON.parse(p.saved['helen-history']),[]);
  assert.deepEqual(JSON.parse(p.saved['helen-favorites']),['experiment']);
});
test('invalid saved lists are ignored and voice labels keep the exact selected voice ID',async()=>{
  const p=page({'helen-favorites':'bad json','helen-history':'{"word":"experiment"}','helen-voice':'Sarah'});
  assert.equal(vm.runInContext('favorites.length + history.length',p.context),0);
  await vm.runInContext('loadVoices()',p.context);
  assert.match(p.element('#voice').options[0].text,/^\(Ame\)/);
  assert.match(p.element('#voice').options[1].text,/^\(Eng\)/);
  assert.equal(p.element('#voice').value,'Sarah');
});

test('collocation and teaching example speakers use the selected voice and full texts',async()=>{
  const p=page({'helen-voice':'Sarah'});
  const phrase='conduct an experiment', example='The students conducted an experiment to test their prediction.';
  const data={from:'en',query:'experiment',word:'experiment',entries:[{word:'experiment',meanings:[],collocations:{teaching:[{pattern:'verb + noun',phrase,example}],corpus:[]}}]};
  vm.runInContext(`render(${JSON.stringify(data)}, false)`,p.context);
  const line=p.created.find(node=>node.innerHTML.includes('Hear collocation example'));
  assert.ok(line);
  for(const [selector,text] of [['button',phrase],['.collocation-example-say',example]]){
    await line.querySelector(selector).onclick({currentTarget:p.element('#test-button')});
    const params=new URL(p.requests.filter(r=>r.url.includes('/api/tts')).at(-1).url,'http://test').searchParams;
    assert.equal(params.get('text'),text); assert.equal(params.get('voice'),'Sarah');
  }
});


test('shows spelling links before the slow lookup ends and ignores its stale response after a click',async()=>{
  let finishSlow;
  const slow=new Promise(resolve=>finishSlow=resolve);
  const p=page({},url=>url.includes('word=experimence')?slow:{ok:true,json:async()=>({query:'experience',word:'experience',from:'en',entries:[{word:'experience',meanings:[],source:'test'}]})});
  p.element('#q').value='experimence';
  const oldLookup=vm.runInContext('searchWord()',p.context);
  await new Promise(resolve=>setTimeout(resolve,550));
  assert.match(p.element('#out').innerHTML,/Đang kiểm tra/);
  const suggestion=p.created.find(node=>node.className==='word-link' && node.textContent==='experience');
  assert.ok(suggestion);
  suggestion.onclick(); await new Promise(resolve=>setImmediate(resolve));
  finishSlow({ok:false,status:404,json:async()=>({word:'experimence',suggestions:['experiment']})});
  await oldLookup;
  assert.equal(vm.runInContext('lastResult.word',p.context),'experience');
  assert.ok(!p.element('#out').innerHTML.includes('Không tìm thấy từ khớp'));
});


test('voice search waits for a final transcript and uses the chosen input language',async()=>{
  let recognizer;
  class Recognition {constructor(){recognizer=this;}start(){this.onstart();}stop(){this.onend();}abort(){this.onend();}}
  const p=page({},null,{SpeechRecognition:Recognition,isSecureContext:true});
  p.element('#from').value='vi';p.element('#mic').events.click();
  assert.equal(recognizer.lang,'vi-VN');assert.equal(p.element('#mic').getAttribute('aria-pressed'),'true');
  recognizer.onresult({resultIndex:0,results:[Object.assign([{transcript:'xin chào'}],{isFinal:false})]});
  assert.ok(!p.requests.some(request=>request.url.includes('/api/lookup')));
  recognizer.onresult({resultIndex:0,results:[Object.assign([{transcript:'xin chào.'}],{isFinal:true})]});
  await new Promise(resolve=>setImmediate(resolve));recognizer.onend();
  assert.equal(p.element('#q').value,'xin chào');assert.equal(p.saved['helen-query'],'xin chào');
  const request=p.requests.find(request=>request.url.includes('/api/lookup'));
  assert.equal(new URL(request.url,'http://test').searchParams.get('from'),'vi');
  assert.equal(p.element('#mic').getAttribute('aria-pressed'),'false');
});
test('voice search handles permission errors and ignores canceled results after typing',()=>{
  let recognizer;
  class Recognition {constructor(){recognizer=this;}start(){}abort(){this.onend();}}
  const p=page({},null,{webkitSpeechRecognition:Recognition,isSecureContext:true});
  p.element('#mic').events.click();recognizer.onerror({error:'not-allowed'});
  assert.match(p.element('#speech-status').textContent,/cấp quyền micro/);
  p.element('#mic').events.click();p.element('#q').value='loan';p.element('#q').events.input();
  recognizer.onresult({results:[Object.assign([{transcript:'wrong'}],{isFinal:true})]});
  assert.equal(p.element('#q').value,'loan');assert.equal(p.saved['helen-query'],'loan');
  assert.ok(!p.requests.some(request=>request.url.includes('/api/lookup')));
});
function savedLesson(definition='Money lent temporarily.') {
  return {word:'loan',pos:'noun',definition,language:'vi',title:'A bank loan',provider:'Gemini',usageNote:'Khoản vay cần được hoàn trả.',videoPrompt:'Animate a bank loan.',scenario:{text:'Anna requests a loan.',translation:'Anna xin một khoản vay.'},dialogue:Array.from({length:4},(_,i)=>({speaker:i%2?'Mark':'Anna',text:i?'Please repay it.':'I need a loan.',translation:i?'Hãy hoàn trả khoản vay.':'Tôi cần một khoản vay.'}))};
}
test('AI contexts restore instantly after reload and never cross a different sense or language',async()=>{
  const data=savedLesson(), p=page({'helen-ai-contexts':JSON.stringify([{at:Date.now(),data}])});
  await new Promise(resolve=>setImmediate(resolve));
  vm.runInContext(`createAISection({word:'loan',meanings:[{pos:'noun',senses:[{definition:${JSON.stringify(data.definition)}},{definition:'A borrowed object.'}]}]})`,p.context);
  const panel=p.created.find(node=>node.className==='ai-study'), button=panel.querySelector('.ai-generate'), select=panel.querySelector('.ai-sense');
  assert.equal(button.textContent,'View saved context');assert.equal(button.disabled,false);
  await button.onclick();assert.ok(!p.requests.some(request=>request.url.endsWith('/api/context')));
  p.element('#target').value='ja';p.element('#target').events.change();assert.equal(button.textContent,'Generate context');
  p.element('#target').value='vi';select.value=JSON.stringify(['noun','A borrowed object.']);select.events.change();assert.equal(button.textContent,'Generate context');
  select.value=JSON.stringify(['noun',data.definition]);select.events.change();assert.equal(button.textContent,'View saved context');
});
test('expired or malformed AI cache entries are ignored and failures are never persisted',()=>{
  const saved=[{at:Date.now()-86400001,data:savedLesson()},{at:Date.now(),data:{...savedLesson(),dialogue:[]}},{at:Date.now()+60000,data:savedLesson()}];
  assert.equal(vm.runInContext('aiLessons.size',page({'helen-ai-contexts':JSON.stringify(saved)}).context),0);
  const p=page({'helen-ai-contexts':'invalid JSON'});
  vm.runInContext("aiLessons.set('failure',{error:'Offline'});aiLessons.set('pending',{busy:true});persistAILessons()",p.context);
  assert.deepEqual(JSON.parse(p.saved['helen-ai-contexts']),[]);
});
const bankEntry={word:'bank',source:'Test dictionary',meanings:[{pos:'noun',senses:[{definition:'A financial institution.',example:'The bank approved my loan.'},{definition:'Sloping land beside a river.',example:'We sat on the river bank.'}]}]};
const bankKey=JSON.stringify(['noun','Sloping land beside a river.']);
test('each sense keeps its own examples and direct practice opens the matching AI selection without generating',()=>{
  const p=page();vm.runInContext(`render(${JSON.stringify({word:'bank',from:'en',entries:[bankEntry]})},false)`,p.context);
  const rows=p.created.filter(node=>node.className==='sense'), actions=p.created.filter(node=>node.className==='sense-actions'), guide=p.created.find(node=>node.className==='sense-guide foldout');
  assert.match(guide.innerHTML,/Compare senses · 2 meanings/);
  assert.match(rows[0].innerHTML,/approved my loan/);assert.doesNotMatch(rows[0].innerHTML,/river bank/);
  assert.match(rows[1].innerHTML,/river bank/);assert.doesNotMatch(rows[1].innerHTML,/approved my loan/);
  actions[1].querySelector('button').onclick();
  const panel=p.created.find(node=>node.className==='ai-study');
  assert.equal(panel.querySelector('.ai-sense').value,bankKey);assert.match(panel.querySelector('.ai-selected-sense').innerHTML,/river bank/);
  assert.equal(rows[1].getAttribute('data-practicing'),'true');assert.equal(rows[0].getAttribute('data-practicing'),'false');
  assert.equal(p.created.find(node=>node.className==='extra-card').open,true);
  assert.equal(p.requests.filter(request=>request.url.endsWith('/api/context')).length,0);
});
test('sense choice survives reordered enrichment and reload, with old words and translations preserved',()=>{
  const saved={'helen-favorites':'["bank"]','helen-study-v1':'existing-progress'};const p=page(saved);
  vm.runInContext(`createAISection(${JSON.stringify(bankEntry)});aiPanels.get('bank').choose(${JSON.stringify(bankKey)})`,p.context);
  const reordered={...bankEntry,meanings:[{pos:'noun',senses:[...bankEntry.meanings[0].senses].reverse()}]};
  const reload=page({...p.saved});vm.runInContext(`createAISection(${JSON.stringify(reordered)})`,reload.context);
  const panel=reload.created.find(node=>node.className==='ai-study');assert.equal(panel.querySelector('.ai-sense').value,bankKey);
  assert.match(panel.querySelector('.ai-selected-sense').innerHTML,/Selected sense · noun · 1/);
  assert.equal(reload.saved['helen-study-v1'],'existing-progress');assert.equal(reload.saved['helen-favorites'],'["bank"]');
});
test('changing sense during AI generation keeps the late result under its original meaning',async()=>{
  let finish;const waiting=new Promise(resolve=>finish=resolve);
  const p=page({},null,{},url=>url.endsWith('/api/context')?waiting:undefined);
  vm.runInContext(`aiConfigured=true;createAISection(${JSON.stringify(bankEntry)});aiPanels.get('bank').choose(${JSON.stringify(bankKey)})`,p.context);
  const panel=p.created.find(node=>node.className==='ai-study'), pending=panel.querySelector('.ai-generate').onclick();
  const request=JSON.parse(p.requests.find(request=>request.url.endsWith('/api/context')).options.body);assert.equal(request.senseKey,bankKey);assert.equal(request.senseIndex,1);
  vm.runInContext(`aiPanels.get('bank').choose(${JSON.stringify(JSON.stringify(['noun','A financial institution.']))})`,p.context);
  const data={...savedLesson('Sloping land beside a river.'),word:'bank',examples:[{text:'We sit on the bank.',translation:'Chúng tôi ngồi trên bờ sông.'},{text:'Trees grow on the bank.',translation:'Cây mọc trên bờ sông.'}]};
  finish({ok:true,json:async()=>data});await pending;
  assert.equal(panel.querySelector('.ai-generate').textContent,'Generate context');assert.match(panel.querySelector('.ai-selected-sense').innerHTML,/financial institution/);
  vm.runInContext(`aiPanels.get('bank').choose(${JSON.stringify(bankKey)})`,p.context);assert.equal(panel.querySelector('.ai-generate').textContent,'View saved context');
  assert.ok(p.created.some(node=>node.innerHTML.includes('Examples in context · AI')));assert.equal(JSON.parse(p.saved['helen-ai-contexts'])[0].data.definition,data.definition);
});
test('mismatched AI responses are rejected and corrupted new example caches do not break old saved lessons',async()=>{
  const p=page({},null,{},url=>url.endsWith('/api/context')?{ok:true,json:async()=>savedLesson()}:undefined);
  await new Promise(resolve=>setImmediate(resolve));
  vm.runInContext(`aiConfigured=true;createAISection(${JSON.stringify(bankEntry)})`,p.context);
  const panel=p.created.find(node=>node.className==='ai-study');await panel.querySelector('.ai-generate').onclick();
  assert.match(panel.querySelector('.ai-status').textContent,/không khớp nghĩa/);assert.equal(p.saved['helen-ai-contexts'],undefined);
  const old=savedLesson(),bad={...old,examples:[{text:'Bad'}]};const cached=page({'helen-ai-contexts':JSON.stringify([{at:Date.now(),data:old},{at:Date.now(),data:bad}])});
  assert.equal(vm.runInContext('aiLessons.size',cached.context),1);
});
test('audio loading is animated while pending and cleaned up after an error without changing voice',async()=>{
  let complete;
  const p=page({'helen-voice':'Sarah'},null,{},url=>url.includes('/api/tts')?new Promise(resolve=>complete=resolve):undefined);
  await new Promise(resolve=>setImmediate(resolve));
  const button=p.element('#test-speaker');button.innerHTML='🔊';
  const waiting=vm.runInContext("speak('loan',document.querySelector('#test-speaker'))",p.context);
  assert.match(button.innerHTML,/wheel-and-hamster/);assert.equal(button.disabled,true);assert.equal(p.element('#audio-status').hidden,false);
  complete({ok:false,status:503,json:async()=>({error:'Voice offline.'})});await waiting;
  assert.equal(button.innerHTML,'🔊');assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-busy'),undefined);
  assert.equal(p.element('#audio-status').hidden,true);assert.equal(p.saved['helen-voice'],'Sarah');
});

test('simultaneous translations share a request and a failed result remains retryable',async()=>{
  let finish,count=0;
  const p=page({},null,{},url=>url.includes('/api/translate')?(count++,new Promise(resolve=>finish=resolve)):undefined);
  const first=vm.runInContext("tr(['Intermediate level.'],'en','vi')",p.context);
  const second=vm.runInContext("tr(['Intermediate level.'],'en','vi')",p.context);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(count,1);
  finish({ok:false,status:429,json:async()=>({error:'Dịch nghĩa tạm hết hạn mức. Hãy thử lại sau.',code:'TRANSLATION_QUOTA'})});
  const failed=await Promise.allSettled([first,second]);assert.ok(failed.every(item=>item.status==='rejected'));
  assert.equal(vm.runInContext('translationJobs.size + translations.size',p.context),0);
  const retry=vm.runInContext("tr(['Intermediate level.'],'en','vi')",p.context);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(count,2);
  finish({ok:true,json:async()=>({translations:['Trình độ trung cấp.']})});
  assert.deepEqual(Array.from(await retry),['Trình độ trung cấp.']);
});

test('definition eyes show the actual service error, clear loading and succeed on the next tap',async()=>{
  const definition='Lying between two extremes.';let attempts=0;
  const p=page({},null,{},(url,options)=>{
    if(!url.includes('/api/translate') || JSON.parse(options.body).texts[0]!==definition)return;
    attempts++;
    return attempts===1?{ok:false,status:429,json:async()=>({error:'Dịch nghĩa tạm hết hạn mức. Hãy thử lại sau.'})}:{ok:true,json:async()=>({translations:['Nằm giữa hai cực.']})};
  });
  vm.runInContext(`render(${JSON.stringify({word:'intermediate',from:'en',entries:[{word:'intermediate',meanings:[{pos:'adjective',senses:[{definition}]}]}]})},false)`,p.context);
  const row=p.created.find(node=>node.className==='sense'), eye=row.querySelector('.eye'), box=row.querySelector('.tr');
  await eye.onclick();assert.match(box.textContent,/hết hạn mức/);assert.equal(eye.disabled,false);assert.equal(eye.getAttribute('aria-busy'),undefined);assert.equal(eye.getAttribute('aria-pressed'),undefined);
  await eye.onclick();assert.equal(box.textContent,'Nằm giữa hai cực.');assert.equal(eye.getAttribute('aria-pressed'),'true');assert.equal(attempts,2);
});

test('a pending definition error cannot reopen a translation after changing the target language',async()=>{
  const definition='Around the middle.';let finish;
  const p=page({},null,{},(url,options)=>url.includes('/api/translate') && JSON.parse(options.body).texts[0]===definition?new Promise(resolve=>finish=resolve):undefined);
  vm.runInContext(`render(${JSON.stringify({word:'intermediate',from:'en',entries:[{word:'intermediate',meanings:[{pos:'adjective',senses:[{definition}]}]}]})},false)`,p.context);
  const row=p.created.find(node=>node.className==='sense'), eye=row.querySelector('.eye'), box=row.querySelector('.tr');
  const pending=eye.onclick();p.element('#target').value='fr';p.element('#target').events.change();
  finish({ok:false,status:503,json:async()=>({error:'Old-language error'})});await pending;
  assert.equal(box.hidden,true);assert.ok(!box.textContent.includes('Old-language error'));assert.equal(eye.disabled,false);
});

test('expired saved translations still open offline and an unsaved sentence gives an immediate message',async()=>{
  const key=JSON.stringify([['An intermediate stage.'],'en','vi','','']);
  const p=page({'helen-translations':JSON.stringify([{key,at:Date.now()-172800000,values:['Một giai đoạn trung gian.']}])},null,{navigator:{onLine:false}});
  assert.deepEqual(Array.from(await vm.runInContext("tr(['An intermediate stage.'],'en','vi',{kind:'definition'})",p.context)),['Một giai đoạn trung gian.']);
  await assert.rejects(vm.runInContext("tr(['A new sentence.'],'en','vi')",p.context),/chưa được lưu/);
  assert.equal(p.requests.filter(request=>request.url.includes('/api/translate')).length,0);
  assert.match(p.element('#voice-status').textContent,/Ngoại tuyến/);
});

test('the offline pack Vietnamese headword gloss never calls a translation provider',async()=>{
  const p=page({},null,{navigator:{onLine:false}});
  vm.runInContext("lastResult={word:'intermediate',offlineGloss:'trung gian; trung cấp'}",p.context);
  assert.deepEqual(Array.from(await vm.runInContext("tr(['intermediate'],'en','vi',{kind:'headword'})",p.context)),['trung gian; trung cấp']);
  assert.equal(p.requests.filter(request=>request.url.includes('/api/translate')).length,0);
});

test('archived AI contexts remain readable offline while new contexts require a connection',async()=>{
  const data=savedLesson();
  const p=page({'helen-ai-contexts':JSON.stringify([{at:Date.now()-172800000,data}])},null,{navigator:{onLine:false}});
  await new Promise(resolve=>setImmediate(resolve));
  vm.runInContext(`createAISection({word:'loan',meanings:[{pos:'noun',senses:[{definition:${JSON.stringify(data.definition)}}]}]})`,p.context);
  const panel=p.created.find(node=>node.className==='ai-study'), button=panel.querySelector('.ai-generate');
  assert.equal(button.textContent,'View saved context');assert.equal(button.disabled,false);await button.onclick();
  assert.equal(p.requests.filter(request=>request.url.endsWith('/api/context')).length,0);
  p.element('#target').value='fr';p.element('#target').events.change();
  assert.equal(button.disabled,true);assert.match(panel.querySelector('.ai-status').textContent,/chưa được lưu/);
});

test('saved partial lookups refresh their extra information online and stay quiet offline',async()=>{
  for(const onLine of [true,false]) {
    const p=page({},url=>({ok:true,json:async()=>({word:'intermediate',from:'en',query:'intermediate',offlinePartial:!url.includes('details=1'),enriching:false,entries:[{word:'intermediate',meanings:[{pos:'adjective',senses:[{definition:'Around the middle.'}]}]}]})}),{navigator:{onLine}});
    p.element('#q').value='intermediate';await vm.runInContext('searchWord()',p.context);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(p.requests.filter(request=>request.url.includes('details=1')).length,onLine?1:0);
  }
});

test('background metadata cannot discard a definition translation that is still loading',async()=>{
  const definition='Receive something temporarily.';let finishDetails,finishTranslation,translations=0;
  const result={query:'borrow',word:'borrow',from:'en',entries:[{word:'borrow',meanings:[{pos:'verb',senses:[{definition}]}]}]};
  const p=page({},url=>url.includes('details=1')?new Promise(resolve=>finishDetails=resolve):{ok:true,json:async()=>({...result,enriching:true})},{},(url,options)=>{
    if(url.includes('/api/translate') && JSON.parse(options.body).texts[0]===definition) {translations++;return new Promise(resolve=>finishTranslation=resolve);}
  });
  p.context.document.querySelectorAll=selector=>{
    if(selector!=='.eye')return [];
    const row=p.created.filter(node=>node.className==='sense').at(-1);if(!row)return [];
    const eye=row.querySelector('.eye');eye.parentElement=row;return [eye];
  };
  p.element('#q').value='borrow';await vm.runInContext('searchWord()',p.context);
  const original=p.context.document.querySelectorAll('.eye')[0], pending=original.onclick();
  finishDetails({ok:true,json:async()=>({...result,enriching:false})});await new Promise(resolve=>setImmediate(resolve));
  const updated=p.context.document.querySelectorAll('.eye')[0];assert.notEqual(updated,original);assert.equal(updated.getAttribute('aria-busy'),'true');assert.equal(translations,1);
  finishTranslation({ok:true,json:async()=>({translations:['Nhận một thứ trong thời gian ngắn.']})});await pending;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(updated.getAttribute('aria-pressed'),'true');assert.equal(updated.parentElement.querySelector('.tr').textContent,'Nhận một thứ trong thời gian ngắn.');assert.equal(updated.disabled,false);
});
