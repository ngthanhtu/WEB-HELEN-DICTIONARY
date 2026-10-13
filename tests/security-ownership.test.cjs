const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process');
const core=require('../public/assets/practical-core');
async function fixture(t,extra={}){
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'helen-ownership-')),report=path.join(dir,'report.json');
 const child=spawn(process.execPath,['--require',path.join(__dirname,'security-backend.cjs'),'server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),NODE_ENV:'production',TRUST_PROXY:'1',DATABASE_URL:'',MYSQL_HOST:'',HELEN_DISABLE_WORDNET:'1',GEMINI_API_KEY:'test-only',GEMINI_MODEL:'gemini-2.5-flash-lite',ELEVENLABS_API_KEY:'test-only',ABUSE_LIMIT_SECRET:'test-only',HELEN_SECURITY_FIXTURE_REPORT:report,...extra},stdio:['ignore','pipe','pipe']});child.stdout.resume();let logs='';child.stderr.on('data',v=>logs+=v);
 t.after(async()=>{if(child.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill('SIGTERM');});fs.rmSync(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)return {base,stats:()=>JSON.parse(fs.readFileSync(report)),logs:()=>logs};}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('fixture startup');
}
const post=(f,url,body,headers={})=>fetch(f.base+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
async function session(f){const r=await post(f,'/api/session',{});assert.equal(r.status,200);assert.deepEqual(await r.json(),{ready:true});return r.headers.get('set-cookie').split(';')[0];}
const event=word=>({id:crypto.randomUUID(),action:'search',word,at:new Date().toISOString()});
test('actual production API isolates two history owners even when query, body or headers claim another owner',async t=>{
 const f=await fixture(t),a=await session(f),b=await session(f);assert.notEqual(a,b);
 assert.equal((await post(f,'/api/history',{events:[event('private-a')]},{Cookie:a})).status,200);assert.equal((await post(f,'/api/history',{events:[event('private-b')]},{Cookie:b})).status,200);
 const own=await fetch(f.base+'/api/history?device='+b.split('=')[1],{headers:{Cookie:a,'X-Helen-Device':b.split('=')[1]}});assert.deepEqual((await own.json()).history.map(x=>x.word),['private-a']);
 assert.equal((await post(f,'/api/history',{device:b.split('=')[1],events:[event('foreign')]},{Cookie:a})).status,400);
 assert.equal((await post(f,'/api/history',{events:[{...event('foreign'),device_hash:b.split('=')[1]}]},{Cookie:a})).status,400);
 assert.equal((await fetch(f.base+'/api/history',{headers:{'X-Helen-Device':b.split('=')[1]}})).status,401);
 assert.equal((await post(f,'/api/history',{events:[{id:crypto.randomUUID(),action:'clear',at:new Date().toISOString()}]},{Cookie:a})).status,200);
 assert.deepEqual((await fetch(f.base+'/api/history',{headers:{Cookie:a}}).then(r=>r.json())).history,[]);assert.deepEqual((await fetch(f.base+'/api/history',{headers:{Cookie:b}}).then(r=>r.json())).history.map(x=>x.word),['private-b']);assert.equal(f.stats().aiCalls,0);assert.equal(f.stats().ttsCalls,0);
});
test('mass assignment cannot add admin/VIP/profile fields and no signup/profile/admin route exists',async t=>{
 const f=await fixture(t);
 for(const body of [{role:'admin'},{vip:true},{isAdmin:true},{profile:{email:'fixture@example.invalid'}},{legacyDevice:'a'.repeat(64),plan:'pro'}]){const r=await post(f,'/api/session',body);assert.equal(r.status,400);assert.equal(r.headers.get('set-cookie'),null);assert.equal((await r.json()).code,'SESSION_INPUT');}
 for(const url of ['/api/signup','/api/users','/api/profile','/api/admin','/api/upgrade']){const r=await fetch(f.base+url,{headers:{Authorization:'Bearer forged-admin','X-Role':'admin'}});assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/fixture@example|private-a|MYSQL_PASSWORD/);}
});
test('rotating browser IDs cannot bypass the durable network speaking cap or cause an extra provider call',async t=>{
 const f=await fixture(t,{PRACTICAL_DEVICE_DAILY_REPLY_LIMIT:'1',PRACTICAL_IP_DAILY_REPLY_LIMIT:'2'}),common={scenario:'work',level:'B1',history:core.context(core.fresh('work','B1')),text:'I work in healthcare.'};
 for(let i=0;i<3;i++){const r=await post(f,'/api/practical',{...common,requestId:crypto.randomUUID(),ip:'192.0.2.'+i,network:'forged-network-'+i,role:'admin'},{'X-Helen-Device':String(i+1).repeat(64)});assert.equal(r.status,i<2?200:429);if(i===2)assert.equal((await r.json()).code,'USAGE_LIMIT');}
 assert.equal(f.stats().aiCalls,2);assert.equal(f.stats().ttsCalls,0);
});
test('rotating voice and browser IDs cannot bypass the independent TTS network ceiling',async t=>{
 const f=await fixture(t,{TTS_IP_DAILY_CHARACTER_LIMIT:'5'}),grant=await post(f,'/api/pronunciation',{word:'loan',text:'loan'}),proof=(await grant.json()).proof;
 for(let i=0;i<2;i++){const r=await fetch(f.base+'/api/tts?'+new URLSearchParams({text:'loan',voice:'voice'+i,proof,ip:'192.0.2.'+i}),{headers:{'X-Helen-Device':String(i+1).repeat(64)}});assert.equal(r.status,i===0?200:429);}
 assert.equal(f.stats().ttsCalls,1);
});
test('new anonymous history sessions share the backend network write allowance',async t=>{
 const f=await fixture(t,{HISTORY_IP_DAILY_EVENT_LIMIT:'1'}),a=await session(f),b=await session(f);
 assert.equal((await post(f,'/api/history',{events:[event('one')]},{Cookie:a})).status,200);
 const denied=await post(f,'/api/history',{events:[event('two')]},{Cookie:b});assert.equal(denied.status,429);assert.equal((await denied.json()).code,'USAGE_LIMIT');assert.deepEqual((await fetch(f.base+'/api/history',{headers:{Cookie:b}}).then(r=>r.json())).history,[]);
});
test('history reads and cookie rotation cannot bypass the IP request ceiling or create provider calls',async t=>{
 const f=await fixture(t);
 for(let i=0;i<61;i++){const r=await fetch(f.base+'/api/history',{headers:{Cookie:'__Host-helen-device='+crypto.randomBytes(32).toString('hex')}});assert.equal(r.status,i<60?200:429);}
 assert.equal(f.stats().aiCalls,0);assert.equal(f.stats().ttsCalls,0);
});
