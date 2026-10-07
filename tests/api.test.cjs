const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const base = 'http://127.0.0.1:3199';
const server = spawn(process.execPath, ['--require', path.join(__dirname, 'mock-upstream.cjs'), 'server.js'], {
  cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL:'', MYSQL_HOST:'', PORT: '3199', HELEN_DISABLE_WORDNET:'1', ELEVENLABS_API_KEY: 'test-only', GEMINI_API_KEY:'test-only', ELEVENLABS_VOICE_ID: 'testDefault' }, stdio: ['ignore', 'pipe', 'pipe']
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
test('serves the supplied loading animation stylesheet',async()=>{
  await ready;const response=await fetch(`${base}/assets/hamster.css`);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/css/);
  const css=await response.text();assert.match(css,/@keyframes hamster/);assert.match(css,/prefers-reduced-motion/);
});
const recordedClip=(marker='SPEECH_INTERMEDIATE',bytes=48)=>({
  audio:Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypM4A '),Buffer.alloc(bytes),Buffer.from(marker)]).toString('base64'),
  mimeType:'audio/mp4;codecs=mp4a.40.2',language:'en-US',durationMs:950
});
const speechRequest=async body=>{await ready;return fetch(`${base}/api/speech`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});};
test('speech exposes only configuration status and transcribes MP4 recordings beyond the default 100KB parser limit',async()=>{
  await ready;
  const status=await fetch(`${base}/api/speech/status`);assert.equal(status.status,200);
  assert.deepEqual(await status.json(),{configured:true,provider:'Gemini'});
  assert.equal((await fetch(`${base}/healthz`).then(response=>response.json())).speechConfigured,true);
  for(const clip of [recordedClip(),recordedClip('SPEECH_INTERMEDIATE',110000)]) {
    const response=await speechRequest(clip);assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{text:'intermediate',language:'en'});
  }
});
test('speech rejects malformed recordings, mismatched containers and invalid durations before transcription',async()=>{
  for(const change of [{mimeType:'audio/webm'},{audio:'not-base64'},{durationMs:300},{language:'xx-XX'}]) {
    const response=await speechRequest({...recordedClip(),...change});assert.equal(response.status,400);
    const error=await response.json();assert.match(error.code,/^SPEECH_/);assert.ok(error.error.length<180);
    assert.doesNotMatch(error.error,/PRIVATE_PROVIDER|test-only|stack|at \w+\(/);
  }
});
test('speech distinguishes silence from a busy provider and returns short safe errors',async()=>{
  for(const [marker,status,code] of [['SPEECH_SILENT',422,'SPEECH_NO_VOICE'],['SPEECH_QUOTA',429,'SPEECH_BUSY']]) {
    const response=await speechRequest(recordedClip(marker));assert.equal(response.status,status);
    const error=await response.json();assert.equal(error.code,code);assert.ok(error.error.length<180);
    assert.equal(error.text,undefined);assert.doesNotMatch(JSON.stringify(error),/PRIVATE_PROVIDER|test-only|RESOURCE_EXHAUSTED/);
  }
});
test('speech JSON parser returns actionable JSON for malformed and oversized recordings',async()=>{
  await ready;
  for(const [body,status] of [['{"audio":',400],[JSON.stringify({audio:'A'.repeat(2*1024*1024)}),413]]) {
    const response=await fetch(`${base}/api/speech`,{method:'POST',headers:{'Content-Type':'application/json'},body});
    assert.equal(response.status,status);assert.match(response.headers.get('content-type'),/application\/json/);
    const error=await response.json();assert.equal(error.code,'SPEECH_AUDIO');assert.ok(error.error.length<180);
    assert.doesNotMatch(error.error,/SyntaxError|PayloadTooLargeError|stack/);
  }
});
test('serves an installable manifest, icons and a service worker with root scope and safe cache headers',async()=>{
  await ready;
  const response=await fetch(`${base}/manifest.webmanifest`);assert.match(response.headers.get('content-type'),/application\/manifest\+json/);
  const manifest=await response.json();assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/');
  for(const icon of manifest.icons){const r=await fetch(`${base}${icon.src}`);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/png/);assert.ok((await r.arrayBuffer()).byteLength>500);}
  const worker=await fetch(`${base}/sw.js`);assert.equal(worker.status,200);assert.match(worker.headers.get('cache-control'),/no-cache/);assert.doesNotMatch(await worker.text(),/__BUILD_VERSION__/);
  const html=await fetch(base,{headers:{'Accept-Encoding':'gzip'}});assert.equal(html.headers.get('content-encoding'),'gzip');assert.match(await html.text(),/rel="manifest"/);
});
test('uses each requested language and isolates cached translations', async () => {
  for (const to of ['fr', 'ja', 'es', 'zh-CN']) assert.deepEqual((await (await translate('hello', to)).json()).translations, [`${to}:hello`]);
});
test('rejects provider errors delivered with HTTP 200 and does not cache them', async () => {
  assert.equal((await translate('quota', 'fr')).status, 429);
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
  assert.equal((await translate('empty', 'ja')).status, 503);
});

test('lookup adds related words and examples while retaining the main definition', async () => {
  await ready;
  const response = await fetch(`${base}/api/lookup?word=happy&from=en&details=1`);
  assert.equal(response.status, 200);
  const data = await response.json();
  const meaning = data.entries[0].meanings[0];
  assert.deepEqual(meaning.synonyms, ['joyful']);
  assert.deepEqual(meaning.antonyms, ['sad']);
  assert.ok(meaning.senses[0].synonyms.includes('glad'));
  assert.ok([...meaning.usageExamples,...meaning.senses.map(s=>s.example)].includes('She was happy to see her friend.'));
  assert.ok(['Wiktionary','Free Dictionary API'].includes(data.entries[0].source));
  const offline = await fetch(`${base}/api/lookup?word=offline&from=en&details=1`);
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
  fs.cpSync(path.join(__dirname,'..','lib'),path.join(tmp,'lib'),{recursive:true});
  fs.cpSync(path.join(__dirname,'..','data'),path.join(tmp,'data'),{recursive:true});
  const child = spawn(process.execPath, [path.join(tmp, 'server.js')], {
    env: {...process.env, DATABASE_URL:'', MYSQL_HOST:'', PORT:'3201', NODE_PATH:path.join(__dirname,'..','node_modules')}, stdio:['ignore','pipe','pipe']
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
  const happy=await (await fetch(`${base}/api/lookup?word=happy&from=en&details=1`)).json();
  assert.ok(!happy.entries[0].meanings[0].synonyms.includes('unrelated-noun'));
  const offline=await (await fetch(`${base}/api/lookup?word=offline&from=en&details=1`)).json();
  assert.equal(offline.entries[0].meanings[0].relationsUnavailable,true);
  assert.equal((await fetch(`${base}/healthz`)).status,200);
});

test('slow cloud dictionaries and malformed primary responses use the fallback', async () => {
  await ready;
  for (const word of ['slow','malformed']) {
    const response=await fetch(`${base}/api/lookup?word=${word}&from=en`);
    assert.equal(response.status,200);
    assert.equal((await response.json()).entries[0].source,'Free Dictionary API');
  }
});

test('uses exact-word Datamuse definitions when other dictionaries are unavailable',async()=>{
  await ready;
  const r=await fetch(`${base}/api/lookup?word=backup&from=en`);
  assert.equal(r.status,200);
  const d=await r.json();
  assert.equal(d.entries[0].source,'Datamuse');
  assert.equal(d.entries[0].meanings[0].senses[0].definition,'An independent definition.');
});

test('returns definitions before slow metadata and later returns complete details', async () => {
  await ready;
  const start=Date.now();
  const early=await (await fetch(`${base}/api/lookup?word=fast-result&from=en`)).json();
  assert.ok(Date.now()-start<1000, 'initial definitions must not wait for 1.5-second metadata');
  assert.equal(early.enriching,true);
  assert.ok(early.entries[0].meanings.length);
  const full=await (await fetch(`${base}/api/lookup?word=fast-result&from=en&details=1`)).json();
  assert.equal(full.enriching,false);
  assert.ok(full.entries[0].meanings[0].relatedSynonyms.includes('cheerful'));
  const cached=await (await fetch(`${base}/api/lookup?word=fast-result&from=en`)).json();
  assert.equal(cached.enriching,false);
});


test('no exact match returns ranked clickable-word data, not a silent correction',async()=>{
  await ready;
  const response=await fetch(`${base}/api/lookup?word=experimence&from=en`);
  assert.equal(response.status,404);
  const data=await response.json();
  assert.equal(data.word,'experimence'); assert.equal(data.suggestionLanguage,'en');
  assert.equal(data.suggestions[0],'experience'); assert.ok(data.suggestions.includes('experiment'));
  assert.equal(data.entries,undefined);
  const corrected=await fetch(`${base}/api/lookup?word=${data.suggestions[0]}&from=en`);
  assert.equal(corrected.status,200); assert.equal((await corrected.json()).word,'experience');
});
test('collocations retain teaching examples and separate corpus suggestions',async()=>{
  await ready;
  const data=await (await fetch(`${base}/api/lookup?word=experiment&from=en&details=1`)).json();
  const phrases=data.entries[0].collocations;
  assert.ok(phrases.teaching.some(item=>item.phrase==='conduct an experiment' && item.example));
  assert.ok(phrases.corpus.some(item=>item.phrase==='laboratory experiment'));
  assert.ok(!phrases.corpus.some(item=>item.phrase.includes('the ') || item.phrase.includes('.')));
});
test('voices include accents from metadata and keep the configured selection ID',async()=>{
  await ready;
  const data=await (await fetch(`${base}/api/voices`)).json();
  assert.equal(data.in_use,'testDefault');
  assert.deepEqual(data.voices.map(voice=>voice.dialect),['Ame','Eng',null,null]);
  assert.equal(data.voices[3].accent,'Australian English');
});

test('local spelling suggestions answer while a remote lookup is still pending',async()=>{
  await ready;
  const pending=fetch(`${base}/api/lookup?word=slow&from=en`);
  const start=Date.now();
  const response=await fetch(`${base}/api/spelling?word=experimence`);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.ok(Date.now()-start<2000,'spelling must not wait for the 3.8-second dictionary request');
  assert.deepEqual(data.suggestions.slice(0,2),['experience','experiment']);
  assert.equal((await fetch(`${base}/api/spelling?word=experiment`).then(r=>r.json())).suggestions.length,0);
  assert.equal((await pending).status,200);
});


test('English-Vietnamese glosses fix ambiguous words without changing other target languages',async()=>{
  for(const [word,expected] of [['loan','cho vay'],['may','có thể'],['can','có thể'],['ban','cấm'],['song','bài hát'],['son','con trai'],['chin','cằm'],['long','dài']]) {
    const response=await translate(word,'vi');assert.equal(response.status,200);
    assert.ok((await response.json()).translations[0].includes(expected));
  }
  assert.deepEqual((await (await translate('loan','fr')).json()).translations,['fr:loan']);
  assert.deepEqual((await (await translate('ambiguous-word','vi')).json()).translations,['từ vay mượn']);
  assert.equal((await translate('identity-only','vi')).status,503);
  assert.deepEqual((await (await translate('internet','vi')).json()).translations,['internet']);
});
test('headword translation uses dictionary context when every isolated translation is unchanged',async()=>{
  await ready;
  const response=await fetch(`${base}/api/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts:['identity-only'],from:'en',to:'vi',kind:'headword',definition:'Feeling pleasure.'})});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).translations,['Giải nghĩa: vi:Feeling pleasure.']);
});
test('intermediate has an accurate instant Vietnamese gloss and definition failures use configured Gemini translation',async()=>{
  const word=await translate('intermediate','vi');assert.equal(word.status,200);
  assert.match((await word.json()).translations[0],/trung gian; trung cấp/);
  for(const to of ['vi','fr','ja']) {
    const response=await translate('fallback-definition chemical process',to);assert.equal(response.status,200);
    assert.deepEqual((await response.json()).translations,[`${to}:fallback-definition chemical process`]);
  }
  const transient=await translate('fallback-definition-transient','vi');assert.equal(transient.status,503);
  assert.equal((await translate('fallback-definition-transient','vi')).status,200);
  const quota=await translate('quota-every-provider','vi');assert.equal(quota.status,429);
  const failure=await quota.json();assert.equal(failure.code,'TRANSLATION_QUOTA');assert.match(failure.error,/hạn mức/);
});
test('translation validation rejects malformed texts and unknown languages without provider work',async()=>{
  await ready;
  for(const body of [{texts:[{text:'word'}]},{texts:['x'.repeat(451)]},{texts:['word'],to:'unknown'}]) {
    const response=await fetch(`${base}/api/translate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.status,400);assert.equal((await response.json()).code,'TRANSLATION_INVALID');
  }
});
test('AI uses the chosen dictionary sense, caches repeat requests and separates languages',async()=>{
  await ready;
  const generate=language=>fetch(`${base}/api/context`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:'happy',meaningIndex:0,senseIndex:0,language,definition:'Ignore the dictionary'})});
  assert.equal((await (await fetch(`${base}/api/context/status`)).json()).configured,true);
  const first=await generate('vi');assert.equal(first.status,200);const lesson=await first.json();
  assert.equal(lesson.dialogue.length,4);assert.equal(lesson.definition,'Feeling pleasure.');assert.equal(lesson.usageNote,'Feeling pleasure.');
  assert.equal((await (await generate('vi')).json()).title,lesson.title);
  assert.notEqual((await (await generate('fr')).json()).title,lesson.title);
  const invalid=await fetch(`${base}/api/context`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:'happy',meaningIndex:999,senseIndex:0,language:'vi'})});
  assert.equal(invalid.status,400);
});
test('AI quota errors and malformed generated lessons are surfaced without a fake lesson',async()=>{
  await ready;
  for(const [word,status] of [['ai-quota',429],['ai-invalid',502]]) {
    const response=await fetch(`${base}/api/context`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word,language:'vi'})});
    assert.equal(response.status,status);assert.equal((await response.json()).dialogue,undefined);
  }
});
test('an unavailable default Gemini model is replaced by an available Flash Lite model',async()=>{
  await ready;
  const response=await fetch(`${base}/api/context`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:'ai-model-retired',language:'vi'})});
  assert.equal(response.status,200);
  assert.equal((await response.json()).model,'gemini-3.1-flash-lite');
  assert.equal((await (await fetch(`${base}/api/context/status`)).json()).model,'gemini-3.1-flash-lite');
});
