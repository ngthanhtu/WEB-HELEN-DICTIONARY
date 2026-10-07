const {test}=require('node:test'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const {spawn}=require('node:child_process'),path=require('node:path');
const {createDatabase}=require('../lib/database');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('real API retains dictionary, translation, AI, audio and isolated history across a process restart with all providers disabled',{skip:process.env.HELEN_MYSQL_TEST!=='1'},async()=>{
  const port=3255,base=`http://127.0.0.1:${port}`,word=`durable-${crypto.randomBytes(6).toString('hex')}`;
  const token=crypto.randomBytes(32).toString('hex'),headers={'Content-Type':'application/json','X-Helen-Device':token};
  const db=createDatabase();let child,logs='';
  async function start(mock) {
    child=spawn(process.execPath,['--require',path.join(__dirname,mock),'server.js'],{
      cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HELEN_DISABLE_WORDNET:'1',ELEVENLABS_API_KEY:'test-only',GEMINI_API_KEY:'test-only',ELEVENLABS_VOICE_ID:'testVoice'},stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
    for(let attempt=0;attempt<100;attempt++) {
      if(child.exitCode!==null)throw Error('Test server exited');
      try {const health=await fetch(`${base}/healthz`).then(r=>r.json());if(health.database?.connected)return;}catch{}
      await sleep(50);
    }
    throw Error('Test MySQL API did not become ready');
  }
  async function stop() {
    if(!child || child.exitCode!==null)return;
    await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});
  }
  const translate=()=>fetch(`${base}/api/translate`,{method:'POST',headers,body:JSON.stringify({texts:[word],from:'en',to:'fr'})});
  const context=()=>fetch(`${base}/api/context`,{method:'POST',headers,body:JSON.stringify({word,language:'vi'})});
  const audio=()=>fetch(`${base}/api/tts?text=${word}&voice=testVoice`).then(async r=>({status:r.status,text:await r.text()}));
  try {
    assert.equal(await db.initialize(),true);await start('mock-upstream.cjs');
    assert.equal((await fetch(`${base}/api/history`)).status,401);
    const malformed=await fetch(`${base}/api/history`,{method:'POST',headers,body:JSON.stringify({events:[{id:'not-an-id',action:'search',word:'bad'}]})});assert.equal(malformed.status,400);
    const foreign=await fetch(`${base}/api/history`,{headers:{...headers,Origin:'https://foreign.example'}});assert.equal(foreign.status,403);
    const initial=await fetch(`${base}/api/lookup?word=${word}&from=en&details=1`).then(r=>r.json());assert.equal(initial.lexicalRevision,2);
    const translated=await (await translate()).json();assert.deepEqual(translated.translations,[`fr:${word}`]);
    const lesson=await (await context()).json();assert.equal(lesson.word,word);
    assert.deepEqual(await audio(),{status:200,text:'testVoice'});
    const event={id:crypto.randomUUID(),action:'search',word,at:new Date().toISOString()};
    for(let i=0;i<2;i++)assert.equal((await fetch(`${base}/api/history`,{method:'POST',headers,body:JSON.stringify({events:[event]})})).status,200);
    for(let attempt=0;attempt<30 && !await db.get('dictionary-v2',word);attempt++)await sleep(20);
    assert.ok(await db.get('dictionary-v2',word));
    await stop();await start('no-upstream.cjs');
    assert.deepEqual(await fetch(`${base}/api/lookup?word=${word}&from=en`).then(r=>r.json()),initial);
    assert.deepEqual(await (await translate()).json(),translated);
    assert.deepEqual(await (await context()).json(),lesson);
    assert.deepEqual(await audio(),{status:200,text:'testVoice'});
    const history=await fetch(`${base}/api/history`,{headers}).then(r=>r.json());assert.equal(history.history[0].word,word);assert.equal(history.history[0].count,1);
    const other=await fetch(`${base}/api/history`,{headers:{...headers,'X-Helen-Device':crypto.randomBytes(32).toString('hex')}}).then(r=>r.json());assert.deepEqual(other.history,[]);
    const clear={id:crypto.randomUUID(),action:'clear',at:new Date().toISOString()};
    assert.equal((await fetch(`${base}/api/history`,{method:'POST',headers,body:JSON.stringify({events:[clear]})})).status,200);
    assert.deepEqual((await fetch(`${base}/api/history`,{headers}).then(r=>r.json())).history,[]);
    assert.doesNotMatch(logs,/test-only|local-test-only-password|UPSTREAM_CALL_FORBIDDEN_AFTER_RESTART/);
  } finally {await stop();await db.close();}
});
