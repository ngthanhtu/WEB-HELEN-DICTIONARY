const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const script = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').split('<script>')[1].split('</script>')[0];
function page(saved = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{value:'',textContent:'',events:{},innerHTML:'',append(){},add(){},replaceChildren(){},setAttribute(){},removeAttribute(){},addEventListener(name,fn){this.events[name]=fn;}});
    return elements.get(id);
  };
  const requests=[];
  const context = vm.createContext({document:{querySelector:element,querySelectorAll:()=>[]}, localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v}, Image:class {}, Option:class {}, URL, Audio:class {}, fetch:async(url,options)=>{
    requests.push({url,options});
    if(url.includes('/api/voices')) return {ok:true,json:async()=>({in_use:'Rachel',voices:[{name:'Rachel',voice_id:'Rachel',category:'premade'},{name:'Sarah',voice_id:'Sarah',category:'premade'}]})};
    if(url.includes('/api/tts')) return {ok:false};
    const body=JSON.parse(options.body); return {ok:true,json:async()=>({translations:[`${body.to}:hello`]})};
  }});
  vm.runInContext(script,context);
  return {context,element,requests,saved};
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
