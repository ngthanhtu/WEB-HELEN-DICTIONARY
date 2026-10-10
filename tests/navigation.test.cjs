const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function app(start='/study'){
  const listeners={},windowEvents={},events=[],pushes=[];
  const location=new URL(start,'https://helen.test'),names=['dictionary','study','words','history','offline','topics'];
  const element=(extra={})=>({attributes:{},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},focus(){this.focused=true;},...extra});
  const sections=names.map(name=>element({dataset:{appPage:name},heading:element(),querySelector(){return this.heading;}}));
  const links=['/','/study','/words','/history','/offline','/topics'].map(path=>element({href:new URL(path,location).href}));
  const skip=element(),study=element(),preferences={open:true},window={history:{pushState(state,unused,url){pushes.push(url);const next=new URL(url,location);location.pathname=next.pathname;location.search=next.search;location.hash=next.hash;},replaceState(state,unused,url){const next=new URL(url,location);location.pathname=next.pathname;location.hash=next.hash;}},scrollTo(){},addEventListener:(name,fn)=>windowEvents[name]=fn};
  const document={documentElement:{dataset:{}},querySelectorAll(selector){return selector==='[data-app-page]'?sections:links;},getElementById(id){return id==='study'?study:sections[names.indexOf(id.replace('page-',''))];},querySelector(selector){return selector==='.skip-link'?skip:preferences;},addEventListener(name,fn){listeners[name]=fn;},dispatchEvent(event){events.push(event);}};
  const context=vm.createContext({window,document,location,URL,CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}});
  vm.runInContext(fs.readFileSync('public/assets/navigation.js','utf8'),context);
  // The dictionary has a global lexical history array. Routing must still use
  // window.history rather than accidentally treating that array as the browser API.
  vm.runInContext('let history=[];',context);listeners.DOMContentLoaded();
  return {window,document,sections,links,location,listeners,windowEvents,events,pushes};
}
test('direct page load shows only its destination, updates navigation and keeps initialization quiet',()=>{
  const p=app('/study');assert.equal(p.window.HelenPages.current(),'study');assert.equal(p.document.title,'Study · Helen Dictionary');
  assert.deepEqual(p.sections.filter(item=>!item.hidden).map(item=>item.dataset.appPage),['study']);
  assert.equal(p.links[1].attributes['aria-current'],'page');assert.equal(p.events.length,0);
});
test('moving pages preserves page objects and uses native history despite the dictionary history array',()=>{
  const p=app(),study=p.sections[1];study.quiz={answer:'loan'};
  p.window.HelenPages.go('/words',{focus:true,scroll:true});assert.equal(p.location.pathname,'/words');assert.equal(p.sections[2].heading.focused,true);
  assert.equal(p.events.at(-1).detail.page,'words');p.window.HelenPages.go('/study');assert.deepEqual(p.sections[1].quiz,{answer:'loan'});
  assert.deepEqual(p.pushes,['/words','/study']);p.window.HelenPages.go('/study');assert.equal(p.pushes.length,2);
});
test('programmatic dictionary lookup suppresses automatic restoration and foreign destinations are rejected',()=>{
  const p=app();p.window.HelenPages.go('/',{restore:false});assert.equal(p.events.at(-1).detail.restore,false);
  assert.equal(p.window.HelenPages.go('https://elsewhere.test/study'),false);assert.equal(p.window.HelenPages.go('/api/history'),false);
  assert.equal(p.location.pathname,'/');assert.equal(p.pushes.length,1);
});
test('back navigation and legacy bookmarks resolve the correct destination',()=>{
  const p=app('/#library');assert.equal(p.location.pathname,'/words');assert.equal(p.window.HelenPages.current(),'words');
  p.location.pathname='/history';p.windowEvents.popstate();assert.equal(p.window.HelenPages.current(),'history');
  assert.deepEqual(p.sections.filter(item=>!item.hidden).map(item=>item.dataset.appPage),['history']);assert.equal(p.sections[3].heading.focused,true);
});
test('modified clicks retain native new-tab behavior while a normal link switches pages',()=>{
  const p=app(),link=p.links[2];let prevented=false;
  p.listeners.click({target:{closest:()=>link},button:0,ctrlKey:true,preventDefault(){prevented=true;}});assert.equal(p.pushes.length,0);assert.equal(prevented,false);
  p.listeners.click({target:{closest:()=>link},button:0,preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(p.location.pathname,'/words');
});

test('topic catalog has its own shareable destination and preserves other page state',()=>{
  const p=app('/topics');assert.equal(p.window.HelenPages.current(),'topics');assert.equal(p.document.title,'Topics · Helen Dictionary');assert.deepEqual(p.sections.filter(item=>!item.hidden).map(item=>item.dataset.appPage),['topics']);p.window.HelenPages.go('/study');assert.equal(p.window.HelenPages.current(),'study');
});
