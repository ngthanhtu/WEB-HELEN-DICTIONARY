const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const script = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').split('<script>')[1].split('</script>')[0];
function page(saved = {}) {
  const elements = new Map(), created = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id,{value:'',textContent:'',events:{},innerHTML:'',append(){},insertAdjacentHTML(){},querySelector(){return null;},add(){},replaceChildren(){},setAttribute(){},removeAttribute(){},addEventListener(name,fn){this.events[name]=fn;}});
    return elements.get(id);
  };
  const requests=[];
  const context = vm.createContext({document:{documentElement:{dataset:{}},createElement:()=>{ const node=element(`#created-${created.length}`), children=new Map(); node.querySelectorAll=sel=>[node.querySelector(sel)]; node.querySelector=sel=>{if(!children.has(sel)) children.set(sel,element(`#child-${created.length}-${sel}`)); return children.get(sel);}; created.push(node); return node; },querySelector:element,querySelectorAll:()=>[]}, localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v}, Image:class {}, Option:class {}, URL, Audio:class {}, fetch:async(url,options)=>{
    requests.push({url,options});
    if(url.includes('/api/voices')) return {ok:true,json:async()=>({in_use:'Rachel',voices:[{name:'Rachel',voice_id:'Rachel',category:'premade'},{name:'Sarah',voice_id:'Sarah',category:'premade'}]})};
    if(url.includes('/api/lookup')) { const query = new URL(url, 'http://test').searchParams; return {ok:true,json:async()=>({query:query.get('word'),word:'hello',from:query.get('from'),entries:[{word:'hello',meanings:[],source:'test'}]})}; }
    if(url.includes('/api/tts')) return {ok:false};
    const body=JSON.parse(options.body); return {ok:true,json:async()=>({translations:[`${body.to}:hello`]})};
  }});
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
