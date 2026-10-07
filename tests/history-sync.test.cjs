const {test}=require('node:test'), assert=require('node:assert/strict'), {webcrypto}=require('node:crypto');
const {create}=require('../public/assets/history-sync');
function fixture(initial={}) {
  const data={...initial}, events=new Map();let connected=true, requestCount=0, deferred;
  let remote=[];
  const storage={getItem:key=>data[key],setItem:(key,value)=>data[key]=value};
  const fetch=async(url,options={})=>{
    requestCount++;
    if(!connected)throw Error('offline');
    if(url.endsWith('/status'))return Response.json({configured:true,connected:true});
    assert.match(options.headers['X-Helen-Device'],/^[a-f0-9]{64}$/);
    if(options.method==='POST') {
      const batch=JSON.parse(options.body).events;
      if(deferred)await deferred;
      for(const event of batch)if(!events.has(event.id)) {
        events.set(event.id,event);
        if(event.action==='clear')remote=[];
        else remote=[{word:event.word},...remote.filter(item=>item.word!==event.word)].slice(0,40);
      }
      return Response.json({saved:true});
    }
    return Response.json({history:remote});
  };
  let shown=[];const client=create({storage,fetch,crypto:webcrypto,online:()=>connected,onHistory:words=>shown=words});
  return {client,data,events,storage,fetch,setOnline:value=>connected=value,shown:()=>shown,count:()=>requestCount,delay:value=>deferred=value};
}
test('initial local history imports once, reload retains device identity, and repeat lookups count once',async() => {
  const f=fixture({'helen-history':'["loan","bank"]'});await f.client.sync();
  assert.deepEqual(f.shown(),['loan','bank']);assert.equal(f.events.size,2);
  f.client.search('drawback');await f.client.sync();assert.deepEqual(f.shown(),['drawback','loan','bank']);assert.equal(f.events.size,3);
  const reloaded=create({storage:f.storage,fetch:f.fetch,crypto:webcrypto});await reloaded.sync();assert.equal(f.events.size,3);
  assert.equal(JSON.parse(f.data['helen-history-outbox']).length,0);
});
test('offline searches and clear sync in order, without resurrecting old history or losing new searches',async() => {
  const f=fixture();f.setOnline(false);f.client.search('old');f.client.clear();f.client.search('new');
  assert.equal(f.count(),0);assert.equal(JSON.parse(f.data['helen-history-outbox']).length,2);
  f.setOnline(true);await f.client.sync();assert.deepEqual(f.shown(),['new']);
  assert.equal(f.events.size,2);
});
test('search arriving during sync remains queued and no stale GET overwrites a clear',async() => {
  const f=fixture();let release;f.delay(new Promise(resolve=>release=resolve));
  f.client.search('old');await new Promise(resolve=>setImmediate(resolve));f.client.clear();f.client.search('new');release();
  await f.client.sync();assert.deepEqual(f.shown(),['new']);assert.equal(f.events.size,3);
});
test('blocked storage or missing secure random generation never creates a shared device identity',async() => {
  let calls=0;const request=async()=>{calls++;};
  await create({storage:{getItem(){throw Error();},setItem(){throw Error();}},fetch:request,crypto:webcrypto}).sync();
  await create({storage:{getItem(){},setItem(){}},fetch:request,crypto:{}}).sync();assert.equal(calls,0);
});
