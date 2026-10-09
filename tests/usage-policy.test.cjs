const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPronunciationPolicy,createUsagePolicy}=require('../lib/usage-policy');
test('speech proof is bound to exact content, expiry and rotated credential',()=>{
  let now=Date.UTC(2026,9,9);const signer=createPronunciationPolicy('test-only',{now:()=>now}),proof=signer.issue('a loan');
  assert.equal(signer.verify('a loan',proof),true);assert.equal(signer.verify('a loan!',proof),false);
  assert.equal(signer.verify('a loan',proof.slice(0,-1)+'!'),false);assert.equal(signer.verify('a loan',null),false);
  assert.equal(createPronunciationPolicy('test-only-rotated',{now:()=>now}).verify('a loan',proof),false);
  now+=604801000;assert.equal(signer.verify('a loan',proof),false);
});
test('only English dictionary/lesson fields receive speech grants',()=>{
  const policy=createPronunciationPolicy('test-only');
  const data={word:'loan',entries:[{word:'loan',meanings:[{senses:[{definition:'borrowed money',example:'She took a loan.',translation:'secret translation'}]}],collocations:{teaching:[{phrase:'bank loan',example:'The bank approved it.'}]}}],videoPrompt:'untrusted prompt'};
  assert.deepEqual(policy.texts(data),['loan','borrowed money','She took a loan.','bank loan','The bank approved it.']);
  assert.ok(policy.attach(data).pronunciation.every(item=>policy.verify(item.text,item.proof)));
});
test('production budgets reserve device/day/month together and fail safely',async()=>{
  const calls=[],database={reserveUsage:async rules=>{calls.push(rules);return true;}},policy=createUsagePolicy({database,env:{NODE_ENV:'production'},now:()=>Date.UTC(2026,9,31,23)});
  await policy.reserve('tts',80,'a'.repeat(64));assert.equal(calls[0].length,3);assert.ok(calls[0].every(rule=>rule.units===80 && /^[a-f0-9]{64}$/.test(rule.key)));
  assert.equal(calls[0].find(rule=>rule.bucket==='tts-month').expiresAt,Date.UTC(2026,10,1));
  await policy.reserve('ai',1);assert.equal(calls[1][0].limit,100);
  database.reserveUsage=async()=>false;await assert.rejects(()=>policy.reserve('tts',1),error=>error.status===429 && error.code==='USAGE_LIMIT');
  database.reserveUsage=async()=>{throw Object.assign(Error('unavailable'),{status:503,code:'USAGE_UNAVAILABLE'});};await assert.rejects(()=>policy.reserve('ai',1),{code:'USAGE_UNAVAILABLE'});
});
test('development runs without production budget storage',async()=>{
  const policy=createUsagePolicy({database:{reserveUsage:()=>{throw Error('must not call');}},env:{NODE_ENV:'development'}});await policy.reserve('tts',10);
});
test('cached AI lessons avoid quota reservations and can renew only their own speech text',async()=>{
  const {createContextService}=require('../lib/context-ai');let reservations=0;
  const lesson={word:'loan',pos:'noun',definition:'borrowed money',language:'vi',provider:'Gemini',title:'A bank visit',examples:[{text:'I need a loan.',translation:'Tôi cần vay tiền.'},{text:'This loan is small.',translation:'Khoản vay này nhỏ.'}],dialogue:Array.from({length:4},(_,i)=>({speaker:i%2?'B':'A',text:'We need a loan.',translation:'Chúng tôi cần vay tiền.'})),scenario:{text:'The bank offers a loan.',translation:'Ngân hàng cho vay.'},usageNote:'Khoản vay.',videoPrompt:'An animation of a bank visit.'};
  const service=createContextService({apiKey:'test-only',beforeGenerate:()=>{reservations++;throw Object.assign(Error('limit'),{status:429,code:'USAGE_LIMIT'});},store:{get:async(namespace,key)=>JSON.parse(key)[0]==='loan'?{value:lesson}:null}});
  assert.equal((await service.generate(lesson)).title,lesson.title);assert.equal(reservations,0);
  assert.equal((await service.cached(lesson)).word,'loan');assert.equal(await service.cached({...lesson,definition:'different sense'}),null);
  await assert.rejects(()=>service.generate({...lesson,word:'tree'}),{code:'USAGE_LIMIT'});assert.equal(reservations,1);
});
test('production public TTS refuses arbitrary text before contacting the provider',async t=>{
  const {spawn}=require('node:child_process'),path=require('node:path');
  const server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'3219',NODE_ENV:'production',ELEVENLABS_API_KEY:'test-only',GEMINI_API_KEY:'',DATABASE_URL:'',MYSQL_HOST:''},stdio:['ignore','pipe','pipe']});t.after(()=>server.kill());
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`exited ${code}`)));});
  const denied=await fetch('http://127.0.0.1:3219/api/tts?text=arbitrary');assert.equal(denied.status,403);assert.equal((await denied.json()).code,'PRONUNCIATION_REQUIRED');
  const grant=await fetch('http://127.0.0.1:3219/api/pronunciation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:'loan',text:'loan'})});assert.equal(grant.status,200);const data=await grant.json();
  const unavailable=await fetch(`http://127.0.0.1:3219/api/tts?${new URLSearchParams({text:'loan',proof:data.proof})}`,{headers:{'X-Helen-Device':'a'.repeat(64)}});assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).code,'USAGE_UNAVAILABLE');
  const wrong=await fetch('http://127.0.0.1:3219/api/pronunciation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:'loan',text:'a private document'})});assert.equal(wrong.status,403);
});
