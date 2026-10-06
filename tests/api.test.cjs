const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const base = 'http://127.0.0.1:3199';
const server = spawn(process.execPath, ['--require', path.join(__dirname, 'mock-upstream.cjs'), 'server.js'], {
  cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: '3199', ELEVENLABS_API_KEY: 'test-only', ELEVENLABS_VOICE_ID: 'testDefault' }, stdio: ['ignore', 'pipe', 'pipe']
});
const ready = new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`server exited ${code}`))); });
after(() => server.kill());
async function translate(text, to) {
  await ready;
  return fetch(`${base}/api/translate`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({texts:[text], from:'en', to}) });
}
test('serves the application without exposing the env file', async () => {
  await ready;
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(`${base}/env`)).status, 404);
});
test('uses each requested language and isolates cached translations', async () => {
  for (const to of ['fr', 'ja', 'es', 'zh-CN']) assert.deepEqual((await (await translate('hello', to)).json()).translations, [`${to}:hello`]);
});
test('rejects provider errors delivered with HTTP 200 and does not cache them', async () => {
  assert.equal((await translate('quota', 'fr')).status, 502);
  assert.equal((await translate('quota', 'fr')).status, 200);
});
test('uses the explicit voice, separates audio cache and never falls back', async () => {
  await ready;
  for (const voice of ['Rachel', 'Sarah', 'Rachel']) {
    const r = await fetch(`${base}/api/tts?text=hello&voice=${voice}`);
    assert.equal(r.status, 200); assert.equal(await r.text(), voice);
  }
  assert.equal((await fetch(`${base}/api/tts?text=hello&voice=unavailable`)).status, 502);
  assert.equal((await fetch(`${base}/api/tts?text=hello&voice=Rachel`)).status, 200);
});

test('uses a valid exact match for empty translations and rejects empty-only responses', async () => {
  assert.deepEqual((await (await translate('empty-with-match', 'ja')).json()).translations, ['ja:valid']);
  assert.equal((await translate('empty', 'ja')).status, 502);
});

test('lookup adds related words and examples while retaining the main definition', async () => {
  await ready;
  const response = await fetch(`${base}/api/lookup?word=happy&from=en`);
  assert.equal(response.status, 200);
  const data = await response.json();
  const meaning = data.entries[0].meanings[0];
  assert.deepEqual(meaning.synonyms, ['joyful', 'glad', 'cheerful']);
  assert.deepEqual(meaning.antonyms, ['sad', 'unhappy']);
  assert.deepEqual(meaning.usageExamples, ['She was happy to see her friend.']);
  assert.equal(data.entries[0].source, 'Wiktionary');
  const offline = await fetch(`${base}/api/lookup?word=offline&from=en`);
  assert.equal(offline.status, 200);
  assert.deepEqual((await offline.json()).entries[0].meanings[0].antonyms, []);
});
test('speaks full example sentences beyond the old 200-character truncation', async () => {
  await ready;
  const text = 'This is a complete example sentence. '.repeat(10).trim();
  const response = await fetch(`${base}/api/tts?voice=Sarah&text=${encodeURIComponent(text)}`);
  assert.equal(response.status, 200); assert.equal(await response.text(), text);
});

test('serves both uploaded background images with image content types',async()=>{
  await ready;
  for(const name of ['Helennn.jpg','pexels-mart-production-7550534.jpg']){
    const r=await fetch(`${base}/${name}`);
    assert.equal(r.status,200); assert.match(r.headers.get('content-type'),/image\/jpeg/);
    assert.ok((await r.arrayBuffer()).byteLength>1000);
  }
});

test('redirects missing local backgrounds to pinned GitHub images', async () => {
  const fs = require('node:fs');
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'helen-no-images-'));
  fs.copyFileSync(path.join(__dirname, '..', 'server.js'), path.join(tmp, 'server.js'));
  const child = spawn(process.execPath, [path.join(tmp, 'server.js')], {
    env: {...process.env, PORT:'3201', NODE_PATH:path.join(__dirname,'..','node_modules')}, stdio:['ignore','pipe','pipe']
  });
  try {
    await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(new Error(`fixture exited ${code}`)));});
    for (const name of ['Helennn.jpg','pexels-mart-production-7550534.jpg']) {
      const r=await fetch(`http://127.0.0.1:3201/${name}`, {redirect:'manual'});
      assert.equal(r.status,302);
      assert.equal(r.headers.get('location'),`https://raw.githubusercontent.com/ngthanhtu/WEB-HELEN-DICTIONARY/bb47b87/${name}`);
    }
  } finally { child.kill(); fs.rmSync(tmp,{recursive:true,force:true}); }
});

test('relations respect parts of speech and unavailable providers are reported', async () => {
  await ready;
  const happy=await (await fetch(`${base}/api/lookup?word=happy&from=en`)).json();
  assert.ok(!happy.entries[0].meanings[0].synonyms.includes('unrelated-noun'));
  const offline=await (await fetch(`${base}/api/lookup?word=offline&from=en`)).json();
  assert.equal(offline.entries[0].meanings[0].relationsUnavailable,true);
  assert.equal((await fetch(`${base}/healthz`)).status,200);
});
