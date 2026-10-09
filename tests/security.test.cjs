const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {spawn}=require('node:child_process');
const {findings,scan}=require('../scripts/check-secrets.cjs');
const fakeKey=['sk_', 'a'.repeat(48)].join(''); // Deliberately generated; never a real credential.
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'helen-security-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const git=(...args)=>{const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(result.status,0);return result.stdout;};
  git('init','--quiet');git('config','user.name','Security test');git('config','user.email','test@example.invalid');
  return {root,git,write:(file,text)=>fs.writeFileSync(path.join(root,file),text)};
}
test('credential checks reject tracked local env files and key literals without returning values',()=>{
  for (const file of ['env','.env','.env.local','nested/.env.production']) assert.ok(findings(file,Buffer.from('PORT=3000')).length);
  assert.deepEqual(findings('.env.example',Buffer.from('ELEVENLABS_API_KEY=\nGEMINI_API_KEY=your_gemini_key\n')),[]);
  const name=['ELEVENLABS','API','KEY'].join('_');
  for (const source of [fakeKey,`${name}=${fakeKey}`,`const config = { ${name}: '${fakeKey}' };`]) {
    const results=findings('config.js',Buffer.from(source));assert.ok(results.length);assert.ok(!JSON.stringify(results).includes(fakeKey));
  }
  assert.deepEqual(findings('tests/mock.cjs',Buffer.from("{ ELEVENLABS_API_KEY: 'test-only' }")),[]);
  assert.ok(findings('credentials.pem',Buffer.from(['-----BEGIN ', 'PRIVATE KEY-----'].join(''))).length);
});
test('the commit guard checks the staged version even when the working file was cleaned',t=>{
  const repo=fixture(t);repo.write('config.js',fakeKey);repo.git('add','config.js');repo.write('config.js','no secret');
  assert.ok(scan(repo.root,'staged').findings.length);
  repo.git('add','config.js');assert.deepEqual(scan(repo.root,'staged').findings,[]);
});
test('history scanning detects deleted secrets and its CLI never prints their values',t=>{
  const repo=fixture(t);repo.write('config.js',fakeKey);repo.git('add','.');repo.git('commit','-qm','Initial fixture');
  repo.write('config.js','no secret');repo.git('add','.');repo.git('commit','-qm','Remove fixture key');
  assert.deepEqual(scan(repo.root).findings,[]);assert.ok(scan(repo.root,'history').findings.length);
  const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/check-secrets.cjs'),'--history'],{cwd:repo.root,encoding:'utf8'});
  assert.equal(result.status,1);assert.ok(!`${result.stdout}${result.stderr}`.includes(fakeKey));assert.match(result.stderr,/credential values are hidden/);
});
test('voice errors never expose reflected credentials in HTTP responses or server logs',async t=>{
  const repo=fixture(t), preload=path.join(repo.root,'upstream.cjs');
  fs.writeFileSync(preload,"global.fetch=async()=>Response.json({detail:'PRIVATE_VOICE_DETAILS',credential:process.env.ELEVENLABS_API_KEY},{status:403});");
  const server=spawn(process.execPath,['--require',preload,'server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'3207',DATABASE_URL:'',MYSQL_HOST:'',GEMINI_API_KEY:'',ELEVENLABS_API_KEY:'test-only'},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());let logs='';server.stderr.on('data',data=>{logs+=data;});
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`fixture server exited ${code}`)));});
  for (const endpoint of ['/api/voices','/api/tts?text=hello']) {
    const response=await fetch(`http://127.0.0.1:3207${endpoint}`);assert.equal(response.status,502);
    const body=await response.text();assert.doesNotMatch(body,/test-only|PRIVATE_VOICE_DETAILS/);
  }
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.match(logs,/TTS failed:.*status=403/);assert.doesNotMatch(logs,/test-only|PRIVATE_VOICE_DETAILS/);
});
