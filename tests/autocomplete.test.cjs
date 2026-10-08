const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../public/assets/autocomplete');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function page(fetch,localWords=()=>[]){
  const node=()=>({children:[],events:{},attributes:{},value:'',hidden:true,textContent:'',
    setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
    addEventListener(name,fn){(this.events[name] ||= []).push(fn);},emit(name,event={}){for(const fn of this.events[name] || [])fn(event);},
    replaceChildren(){this.children=[];},append(value){this.children.push(value);},contains(value){return this===value || this.children.includes(value);},closest(){return form;},scrollIntoView(){}});
  const input=node(),list=node(),language=node(),status=node(),form=node();language.value='en';
  form.contains=value=>value===input || value===form;
  const doc={activeElement:input,createElement:node,events:{},addEventListener(name,fn){this.events[name]=fn;},emit(name,event){this.events[name]?.(event);}};input.ownerDocument=doc;
  const completion=create({input,list,status,language,fetch,localWords,onSelect:word=>{completion.selected=word;}});
  return {input,list,status,language,doc,form,completion};
}
test('typing opens suggestions as soon as a delayed response arrives, without an extra focus or click',async()=>{
  let resolve;const p=page(()=>new Promise(done=>resolve=done));p.input.value='name';p.input.emit('input');
  await wait(180);assert.match(p.status.textContent,/Loading/);
  resolve(Response.json({suggestions:['name','name after']}));await wait(10);
  assert.equal(p.list.hidden,false);assert.deepEqual(p.list.children.map(row=>row.textContent),['name','name after']);assert.equal(p.input.attributes['aria-expanded'],'true');
  p.completion.close();
});
test('submitted queries show suggestions while Search has focus, and choosing a suggestion closes the list',async()=>{
  const p=page(async()=>Response.json({suggestions:['name','name after']}));p.input.value='name';p.doc.activeElement=p.form;
  p.input.emit('blur');p.completion.suggest({submitted:true,immediate:true});await wait(180);
  assert.equal(p.list.hidden,false);p.list.children[1].emit('click');assert.equal(p.completion.selected,'name after');assert.equal(p.list.hidden,true);
});
test('an old response cannot replace the current query or reopen a deliberately closed list',async()=>{
  const pending=[];const p=page(()=>new Promise(resolve=>pending.push(resolve)));
  p.input.value='na';p.input.emit('input');await wait(180);
  p.input.value='ex';p.input.emit('input');await wait(180);
  pending[1](Response.json({suggestions:['experiment']}));await wait(10);
  pending[0](Response.json({suggestions:['name after']}));await wait(10);assert.equal(p.list.children[0].textContent,'experiment');
  p.completion.close();assert.equal(p.list.hidden,true);
});
test('saved words appear immediately and refocusing does not abort or duplicate a pending request',async()=>{
  let calls=0,resolve,signal;const p=page((url,options)=>{calls++;signal=options.signal;return new Promise(done=>resolve=done);},()=>['name after','experiment']);
  p.input.value='name';p.input.emit('input');assert.equal(p.list.hidden,false);assert.equal(p.list.children[0].textContent,'name after');
  await wait(180);p.input.emit('focus');await wait(180);assert.equal(calls,1);assert.equal(signal.aborted,false);
  resolve(Response.json({suggestions:['name','name after']}));await wait(10);assert.equal(p.list.children.length,2);p.completion.close();
});
test('a transient suggestion failure retries automatically and a later empty query never hides available local words',async()=>{
  let calls=0;const p=page(async()=>++calls===1?Response.json({error:'busy'},{status:503}):Response.json({suggestions:['name after']}));
  p.input.value='name';p.input.emit('input');await wait(600);assert.equal(calls,2);assert.equal(p.list.hidden,false);assert.equal(p.list.children[0].textContent,'name after');p.completion.close();
  const local=page(async()=>Response.json({suggestions:[]}),()=>['experiment']);local.input.value='exp';local.input.emit('input');await wait(180);assert.equal(local.list.hidden,false);local.completion.close();
});
test('keyboard selection, Escape, IME composition and changing language do not select stale words',async()=>{
  const p=page(async()=>Response.json({suggestions:['name','name after']}));p.input.value='name';p.input.emit('compositionstart');p.input.emit('input',{isComposing:true});await wait(180);assert.equal(p.list.hidden,false);
  p.input.emit('keydown',{key:'Enter',isComposing:true,preventDefault(){throw Error('must not interrupt composition');}});assert.equal(p.completion.selected,undefined);
  p.input.emit('compositionend');await wait(180);const event=key=>({key,preventDefault(){}});
  p.input.emit('keydown',event('ArrowDown'));assert.equal(p.input.attributes['aria-activedescendant'],'search-suggestion-0');p.input.emit('keydown',event('Enter'));assert.equal(p.completion.selected,'name');
  p.input.emit('focus');assert.equal(p.list.hidden,false);p.input.emit('keydown',event('Escape'));assert.equal(p.list.hidden,true);
  p.completion.suggest({immediate:true});p.language.value='vi';p.language.emit('change');await wait(10);assert.equal(p.list.hidden,true);
});
test('outside taps are delivered to the speaker before closing suggestions can move the page',async()=>{
  const p=page(async()=>Response.json({suggestions:['loan']}),()=>['loan']);p.input.value='loan';p.completion.suggest({submitted:true});
  let played=false;const speaker={onclick:()=>{played=true;}};
  p.doc.emit('pointerdown',{target:speaker});assert.equal(p.list.hidden,false);
  speaker.onclick();p.doc.emit('click',{target:speaker});assert.equal(played,true);assert.equal(p.list.hidden,true);
  p.completion.close();
});
test('forward typing on a composing keyboard opens suggestions without space, backspace, blur or refocus',async()=>{
  let calls=0;const p=page(async url=>{calls++;assert.match(url,/word=exper/);return Response.json({suggestions:['experiment','experience']});});
  p.input.emit('compositionstart');
  for(const value of ['e','ex','exp','expe','exper']){p.input.value=value;p.input.emit('input',{isComposing:true});await wait(30);}
  await wait(200);assert.equal(p.list.hidden,false);assert.equal(p.list.children[0].textContent,'experiment');assert.equal(calls,1);
  p.input.emit('compositionend');p.input.emit('input');await wait(180);assert.equal(calls,1);p.completion.close();
});
test('matching suggestions remain visible during forward typing and duplicate composition events keep the current request',async()=>{
  const pending=[];let calls=0;const p=page(()=>{calls++;return new Promise(resolve=>pending.push(resolve));});
  p.input.value='na';p.input.emit('input');await wait(180);pending[0](Response.json({suggestions:['name','name after','nature']}));await wait(10);
  p.input.value='name';p.input.emit('input');assert.deepEqual(p.list.children.map(row=>row.textContent),['name','name after']);
  await wait(180);p.input.emit('compositionend');p.input.emit('input');await wait(180);assert.equal(calls,2);
  pending[1](Response.json({suggestions:['name','name after','name day']}));await wait(10);assert.equal(p.list.children.length,3);
  p.input.value='name a';p.input.emit('input');assert.deepEqual(p.list.children.map(row=>row.textContent),['name after']);p.completion.close();
});
test('clicking a suggestion while composing commits the draft before searching the chosen word',async()=>{
  const p=page(async()=>Response.json({suggestions:['name after']}));p.input.value='name';p.input.emit('compositionstart');p.input.emit('input');await wait(180);
  p.input.blur=()=>{p.input.value='name';p.input.emit('compositionend');p.input.emit('blur');};
  p.list.children[0].emit('click');assert.equal(p.input.value,'name after');assert.equal(p.completion.selected,'name after');assert.equal(p.list.hidden,true);
  p.input.emit('compositionend'); // A late keyboard commit must not reopen it.
  await wait(180);assert.equal(p.list.hidden,true);p.completion.close();
});
