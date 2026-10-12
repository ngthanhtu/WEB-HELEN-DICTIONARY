const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),net=require('node:net'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib');

async function fixture(t){
 const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'helen-api-security-')),preload=path.join(folder,'provider.cjs');
 fs.writeFileSync(preload,"global.fetch=async url=>{if(String(url).includes('/v1/voices'))return {ok:true,status:200,json:async()=>{throw Error('PRIVATE_PROVIDER_DETAIL');}};throw Error('UNEXPECTED_UPSTREAM_CALL');};");
 const child=spawn(process.execPath,['--require',preload,'server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),NODE_ENV:'production',TRUST_PROXY:'1',DATABASE_URL:'',MYSQL_HOST:'',GEMINI_API_KEY:'',ELEVENLABS_API_KEY:'test-only',HELEN_DISABLE_WORDNET:'1'},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.resume();child.stderr.on('data',chunk=>logs+=chunk);
 t.after(async()=>{if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});fs.rmSync(folder,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Security fixture exited');try{if((await fetch(base+'/healthz')).ok)return {base,child,logs:()=>logs};}catch{}await new Promise(resolve=>setTimeout(resolve,50));}
 throw Error('Security fixture did not start');
}
test('malformed query structures and duplicate parameters cannot crash the real server or reach providers',async t=>{
 const f=await fixture(t);
 for(const endpoint of ['/api/suggestions','/API/spelling','/api/lookup','/api/collocations','/api/tts']){
  for(const query of ['word[toString]=poison','word=a&word=b','word[__proto__][admin]=true']){
   const response=await fetch(f.base+endpoint+'?'+query);assert.equal(response.status,400);assert.equal((await response.json()).code,'REQUEST_QUERY');
  }
 }
 assert.equal((await fetch(f.base+'/healthz')).status,200);assert.equal(f.child.exitCode,null);assert.doesNotMatch(f.logs(),/TypeError|UNEXPECTED_UPSTREAM_CALL/);
});
test('unexpected asynchronous provider failures return safe JSON while the server stays available',async t=>{
 const f=await fixture(t),response=await fetch(f.base+'/api/voices');assert.equal(response.status,500);
 assert.deepEqual(await response.json(),{error:'Chưa xử lý được yêu cầu. Hãy thử lại.',code:'REQUEST_ERROR'});
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await fetch(f.base+'/healthz')).status,200);assert.equal(f.child.exitCode,null);assert.doesNotMatch(f.logs(),/PRIVATE_PROVIDER_DETAIL|test-only|stack|TypeError/);
});
test('compressed uploads, oversized bodies, malformed JSON and unrelated TTS input are rejected without provider access',async t=>{
 const f=await fixture(t);
 for(const endpoint of ['/api/session','/API/speech','/api/practical']){
  const response=await fetch(f.base+endpoint,{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:zlib.gzipSync('{}')});assert.equal(response.status,415);assert.equal((await response.json()).code,'REQUEST_ENCODING');
 }
 const large=await fetch(f.base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({padding:'x'.repeat(110000)})});assert.equal(large.status,413);
 const malformed=await fetch(f.base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});assert.equal(malformed.status,400);
 const arbitrary=await fetch(f.base+'/api/tts?text=arbitrary-document&voice=wrong/../../host');assert.equal(arbitrary.status,400);
 const noProof=await fetch(f.base+'/api/tts?text=arbitrary-document');assert.equal(noProof.status,403);
 assert.equal((await fetch(f.base+'/healthz')).status,200);assert.doesNotMatch(f.logs(),/UNEXPECTED_UPSTREAM_CALL/);
});
test('collocations rate limits cover route casing and normalize IPv6 clients rather than allowing address rotation within one subnet',async t=>{
 const f=await fixture(t);let last;
 for(let i=0;i<31;i++)last=await fetch(f.base+'/API/collocations?word='+('x'.repeat(101)),{headers:{'X-Forwarded-For':`2001:db8:abcd:1200::${i+1}`}});
 assert.equal(last.status,429);assert.ok(last.headers.get('ratelimit'));assert.doesNotMatch(f.logs(),/UNEXPECTED_UPSTREAM_CALL/);
});
test('static traversal and private files cannot expose source, environment values or Git metadata',async t=>{
 const f=await fixture(t);
 for(const url of ['/.env','/env','/.git/config','/server.js','/assets/%2e%2e%2f%2e%2e%2fserver.js','/images/%2e%2e%2f.env','/assets/.env','/assets/%00']){
  const response=await fetch(f.base+url),body=await response.text();assert.ok(response.status>=400);assert.doesNotMatch(body,/test-only|require\('dotenv'\)|ELEVENLABS_API_KEY=|at [\w.]+ \(/);
 }
 assert.equal((await fetch(f.base+'/assets/practical.js')).status,200);
});
