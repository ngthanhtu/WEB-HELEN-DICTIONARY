const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync(require('node:path').join(__dirname,'../public/assets/topics.js'),'utf8');
function page(saved={},available=true){
 const elements=new Map(),events=new Map();let stops=0,reloads=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',options:[],attributes:{},add(option){this.options.push(option);},replaceChildren(){this.options=[];},querySelector:element,querySelectorAll:()=>[],addEventListener(){},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}});return elements.get(id);};
 const document={querySelector:element,addEventListener(name,fn){events.set(name,fn);},dispatchEvent(e){events.get(e.type)?.(e);}};
 const voice=element('#voice');voice.options=[{text:'(Eng) Sarah',value:'Sarah'},{text:'(Ame) Bella',value:'Bella'}];voice.value='Sarah';
 voice.dispatchEvent=()=>{saved['helen-voice']=voice.value;document.dispatchEvent({type:'helen:voice-selected',detail:{voice:voice.value}});};
 const context=vm.createContext({document,localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v},navigator:{onLine:true},Event:class{constructor(type){this.type=type;}},Option:class{constructor(text,value){this.text=text;this.value=value;}},HelenTopicsCore:{read:()=>({lessons:{}})},HelenDeviceSpeech:{available},HelenAudio:{stop(){stops++;}},HelenPages:{current:()=> 'dictionary'},loadVoices(){reloads++;},addEventListener(){}});context.window=context;
 vm.runInContext(script,context);return {saved,element,document,get stops(){return stops;},get reloads(){return reloads;}};
}
test('Topics defaults to the selected ElevenLabs voice while device speech remains an explicit option',()=>{
 const p=page();assert.equal(p.element('#topic-audio-mode').value,'selected');assert.equal(p.element('#topic-voice').value,'Sarah');assert.equal(p.element('#topic-voice').options.length,2);
 p.element('#topic-audio-mode').value='device';p.element('#topic-audio-mode').onchange();assert.equal(p.saved['helen-topic-audio-mode-v1'],'device');assert.match(p.element('#topic-audio-note').textContent,/giọng máy/);assert.equal(p.stops,1);
 const reload=page(p.saved);assert.equal(reload.element('#topic-audio-mode').value,'device');
});
test('selecting an ElevenLabs voice from Preferences cancels device mode and persists the linked choice',()=>{
 const p=page({'helen-topic-audio-mode-v1':'device'});p.element('#voice').value='Bella';p.element('#voice').dispatchEvent();
 assert.equal(p.element('#topic-voice').value,'Bella');assert.equal(p.element('#topic-audio-mode').value,'selected');assert.equal(p.saved['helen-topic-audio-mode-v1'],'selected');assert.equal(p.stops,1);
});
test('the inline Topics voice picker uses the global voice and leaves device mode automatically',()=>{
 const p=page({'helen-topic-audio-mode-v1':'device'});p.element('#topic-voice').value='Bella';p.element('#topic-voice').onchange();
 assert.equal(p.saved['helen-voice'],'Bella');assert.equal(p.element('#voice').value,'Bella');assert.equal(p.element('#topic-audio-mode').value,'selected');
 p.element('#topic-retry-voices').onclick();assert.equal(p.reloads,1);
 p.document.dispatchEvent({type:'helen:voice-status',detail:{message:'Hết hạn mức. Giữ giọng đã chọn.'}});assert.match(p.element('#topic-audio-note').textContent,/Hết hạn mức/);
});
test('loading, empty and unsupported-device states do not invent a replacement voice',()=>{
 const p=page({'helen-topic-audio-mode-v1':'device'},false);assert.equal(p.element('#topic-audio-mode').value,'selected');assert.equal(p.element('[value="device"]').disabled,true);
 p.element('#voice').setAttribute('aria-busy','true');p.document.dispatchEvent({type:'helen:voices'});assert.equal(p.element('#topic-retry-voices').disabled,true);assert.equal(p.element('#topic-voice').getAttribute('aria-busy'),'true');
 p.element('#voice').options=[{text:'No voice available',value:''}];p.element('#voice').value='';p.document.dispatchEvent({type:'helen:voices'});assert.equal(p.element('#topic-voice').disabled,true);assert.equal(p.element('#topic-voice').value,'');
});
