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
