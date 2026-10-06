const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const script = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').split('<script>')[1].split('</script>')[0];
function page(saved = {}, lookupFetch = null, browser = {}) {
  const elements = new Map(), created = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id,{value:'',textContent:'',events:{},innerHTML:'',append(){},insertAdjacentHTML(){},querySelector(){return null;},add(option){(this.options ||= []).push(option);},replaceChildren(){this.options=[];},setAttribute(name,value){(this.attributes ||= {})[name]=value;},getAttribute(name){return this.attributes?.[name];},removeAttribute(name){if(this.attributes) delete this.attributes[name];},addEventListener(name,fn){const before=this.events[name];this.events[name]=(...args)=>{before?.(...args);return fn(...args);};}});
    return elements.get(id);
  };
  const requests=[];
  const context = vm.createContext({document:{documentElement:{dataset:{}},createElement:()=>{ const node=element(`#created-${created.length}`), children=new Map(); node.querySelectorAll=sel=>[node.querySelector(sel)]; node.querySelector=sel=>{if(!children.has(sel)) children.set(sel,element(`#child-${created.length}-${sel}`)); return children.get(sel);}; created.push(node); return node; },querySelector:element,querySelectorAll:()=>[]}, localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v}, Image:class {}, Option:class {constructor(text,value){this.text=text;this.value=value;}}, URL, Audio:class {}, setTimeout, clearTimeout, fetch:async(url,options)=>{
    requests.push({url,options});
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
