const {test}=require('node:test'),assert=require('node:assert/strict');
const create=require('../public/assets/translation-warmup'),tick=()=>new Promise(resolve=>setTimeout(resolve,20));
test('visible definitions prepare in small batches once, retaining language and definition purpose',async()=>{
  const calls=[];let callback;
  const warm=create({translate:async(...args)=>calls.push(args),target:()=> 'vi',delay:1,Observer:class{constructor(cb){callback=cb;}observe(){}unobserve(){}}});
  const elements=Array.from({length:9},(_,i)=>({isConnected:true,addEventListener(){},i}));elements.forEach(e=>warm.observe(e,[`definition ${e.i}`],{kind:'definition'}));
  callback(elements.map(target=>({target,isIntersecting:true})));await tick();
  assert.deepEqual(calls.map(c=>c[0].length),[4,4,1]);assert.ok(calls.every(c=>c[1]==='en' && c[2]==='vi' && c[3].kind==='definition'));
  callback(elements.map(target=>({target,isIntersecting:true})));await tick();assert.equal(calls.length,3);
});
test('English, offline and unseen contents never generate background provider traffic',async()=>{
  let online=false,to='vi',calls=0;const warm=create({translate:async()=>calls++,target:()=>to,online:()=>online,delay:1});
  warm.prepare(['a sentence']);await tick();assert.equal(calls,0);online=true;to='en';warm.prepare(['a sentence']);await tick();assert.equal(calls,0);
  warm.observe({addEventListener(){}},['not visible']);await tick();assert.equal(calls,0);
});
test('changing language prepares visible controls again, drops old queued language and suppresses background failures',async()=>{
  let to='vi',callback;const calls=[],warm=create({target:()=>to,delay:1,translate:async(...args)=>{calls.push(args);throw Error('quota');},Observer:class{constructor(cb){callback=cb;}observe(){}unobserve(){}}});
  const element={isConnected:true,addEventListener(){}};warm.observe(element,['a male sibling'],{kind:'definition'});callback([{target:element,isIntersecting:true}]);to='fr';warm.refresh();await tick();
  assert.equal(calls.length,1);assert.equal(calls[0][2],'fr');warm.refresh();await tick();assert.equal(calls.length,1);
});
