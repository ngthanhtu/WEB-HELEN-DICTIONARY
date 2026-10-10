const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTranslationService } = require('../lib/translation');

const quota = () => Response.json({ responseStatus: 429, responseDetails: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.', responseData: { translatedText: 'QUOTA ERROR' } }, { status: 429 });
test('translation diagnostics report provider status without exposing keys, request content or raw error messages',async()=>{
  const service=createTranslationService({apiKey:'private-test-key',fetchImpl:async(url)=>String(url).includes('mymemory')?quota():Response.json({error:{code:400,status:'INVALID_ARGUMENT',message:'unsupported thinking option private-test-key'}},{status:400})});
  await assert.rejects(service.translate('a new sentence','en','vi'));
  const status=service.status();assert.deepEqual(status.primaryError,{status:429,reason:'quota'});assert.deepEqual(status.aiError,{status:400,reason:'model-options'});
  assert.ok(!JSON.stringify(status).includes('private-test-key'));assert.ok(!JSON.stringify(status).includes('a new sentence'));
});
test('single-word summaries include multiple parts of speech and separate different sense contexts in cache',async()=>{
  let calls=0;
  const senses=[{pos:'noun',definition:'a preliminary version of a text'},{pos:'noun',definition:'a current of air'},{pos:'verb',definition:'to write a preliminary version'}];
  const service=createTranslationService({apiKey:'test-only',fetchImpl:async(url,request)=>{
    calls++;const input=JSON.parse(JSON.parse(request.body).contents[0].parts[0].text);
    assert.deepEqual(input.texts[0].dictionarySenses,senses);
    return gemini(request,()=> 'bản nháp; luồng gió; soạn thảo');
  }});
  assert.equal(await service.translate('draft','en','vi',{kind:'headword',senses}),'bản nháp; luồng gió; soạn thảo');
  assert.equal(await service.translate('draft','en','vi',{kind:'headword',senses}),'bản nháp; luồng gió; soạn thảo');assert.equal(calls,1);
});
test('premium retains reward, extra payment, insurance and quality senses without a network dependency',async()=>{
  const service=createTranslationService({fetchImpl:()=>{throw Error('must not fetch');}});
  const gloss=await service.translate('premium','en','vi',{kind:'headword',definition:'a payment for insurance'});
  for(const meaning of ['phần thưởng','khoản trả thêm','phí bảo hiểm','cao cấp'])assert.ok(gloss.includes(meaning));
});
test('an exact cached definition remains instant after a day, without a new provider or database request',async()=>{
  let now=1000,calls=0;const service=createTranslationService({now:()=>now,fetchImpl:async()=>{calls++;return Response.json({responseStatus:200,responseData:{translatedText:'một khoản tiền được cho vay tạm thời'}});}});
  const options={kind:'definition'};await service.translate('money lent temporarily','en','vi',options);now+=172800000;
  const start=performance.now();assert.equal(await service.translate('money lent temporarily','en','vi',options),'một khoản tiền được cho vay tạm thời');assert.equal(calls,1);assert.ok(performance.now()-start<1000);
});
test('startup restores persistent translations once and validates purpose before serving warmed data',async()=>{
  const text='money lent temporarily',key=JSON.stringify([text,'en','vi','dictionaryDefinition']),hash=require('node:crypto').createHash('sha256').update(key).digest('hex');let reads=0;
  const service=createTranslationService({store:{translationCache:async()=>[{namespace:'translation-v2',key:hash,value:'số tiền được cho vay tạm thời'},{namespace:'tts-v1',key:hash,value:'wrong namespace'}],get:async()=>{reads++;return null;},set:async()=>true},fetchImpl:async()=>Response.json({responseStatus:200,responseData:{translatedText:'un montant prêté temporairement'}})});
  await service.prepareCache();assert.equal(await service.translate(text,'en','vi',{kind:'definition'}),'số tiền được cho vay tạm thời');assert.equal(reads,0);
  assert.equal(await service.translate(text,'en','fr',{kind:'definition'}),'un montant prêté temporairement');assert.equal(reads,1);
});
test('startup preparation resolves the Lite model and applies its fast generation settings',async()=>{
  let listed=0;
  const service=createTranslationService({apiKey:'test-only',fetchImpl:async(url,request)=>{
    if(!request?.body){listed++;return Response.json({models:[{name:'models/gemini-3.1-flash-lite',supportedGenerationMethods:['generateContent']}]});}
    assert.ok(String(url).includes('gemini-3.1-flash-lite'));
    const body=JSON.parse(request.body);assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'MINIMAL');
    assert.equal(body.generationConfig.maxOutputTokens,512);
    return gemini(request,()=> 'phá vỡ sự ngượng ngùng ban đầu');
  }});
  await service.prepare();await service.prepare();
  assert.equal(await service.translate('break the ice','en','vi',{kind:'headword'}),'phá vỡ sự ngượng ngùng ban đầu');
  assert.equal(listed,1);
});
test('common phrasal verbs and idioms use established Vietnamese meanings without API calls',async()=>{
  const service=createTranslationService({fetchImpl:()=>{throw Error('unnecessary API call');}});
  for(const [phrase,meaning] of [['Name after','đặt tên theo'],['look after','chăm sóc'],['give up','từ bỏ'],['take after','người thân'],['put up with','chịu đựng'],['once in a blue moon','rất hiếm khi']]) {
    assert.ok((await service.translate(phrase,'en','vi',{kind:'headword'})).includes(meaning));
  }
});
test('uncurated headwords use semantic AI before a plausible but literal translation and ignore the old cache namespace',async()=>{
  let primary=0,ai=0;const written=[];
  const service=createTranslationService({apiKey:'test-only',store:{get:async(namespace)=>namespace==='translation-v2'?{value:'kéo chân'}:null,set:async(...args)=>written.push(args)},fetchImpl:async(url,request)=>{
    if(String(url).includes('mymemory')){primary++;return Response.json({responseStatus:200,responseData:{translatedText:'kéo chân'}});}
    ai++;const input=JSON.parse(JSON.parse(request.body).contents[0].parts[0].text);
    assert.equal(input.texts[0].purpose,'learnerGloss');assert.match(input.texts[0].dictionaryDefinition,/joke/);
    return gemini(request,()=> 'trêu chọc, đùa với ai');
  }});
  const options={kind:'headword',definition:'to joke with someone by making them believe something untrue'};
  assert.equal(await service.translate('pull someone\'s leg','en','vi',options),'trêu chọc, đùa với ai');
  assert.equal(await service.translate('pull someone\'s leg','en','vi',options),'trêu chọc, đùa với ai');
  assert.equal(primary,0);assert.equal(ai,1);assert.equal(written[0][0],'translation-semantic-v4');
});
test('AI quota uses the dictionary definition instead of falling back to a literal headword',async()=>{
  const service=createTranslationService({apiKey:'test-only',fetchImpl:async(url,request)=>{
    if(!String(url).includes('mymemory'))return Response.json({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'quota'}},{status:429});
    assert.equal(new URL(url).searchParams.get('q'),'to make a situation less tense');
    return Response.json({responseStatus:200,responseData:{translatedText:'làm cho tình huống bớt căng thẳng'}});
  }});
  assert.equal(await service.translate('break the ice','en','vi',{kind:'headword',definition:'to make a situation less tense'}),'Giải nghĩa: làm cho tình huống bớt căng thẳng');
});
function gemini(request, textFor = text => `vi:${text}`) {
  const input = JSON.parse(JSON.parse(request.body).contents[0].parts[0].text);
  return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ translations: input.texts.map(item => ({ id: item.id, text: textFor(item.text, input.targetLanguage) })) }) }] }, finishReason: 'STOP' }] });
}
test('exhausted free translations switch to a small Gemini batch, cache success and stop retrying the exhausted source', async () => {
  let primaryCalls = 0, aiCalls = 0;
  const service = createTranslationService({ apiKey: 'test-only', fetchImpl: async (url, request) => {
    if (String(url).includes('mymemory')) { primaryCalls++; return quota(); }
    aiCalls++; return gemini(request);
  } });
  assert.deepEqual(await service.translateMany(['first definition', 'second definition'], 'en', 'vi'), ['vi:first definition', 'vi:second definition']);
  assert.equal(aiCalls, 1);
  assert.equal(await service.translate('first definition', 'en', 'vi'), 'vi:first definition');
  await service.translate('third definition', 'en', 'vi');
  assert.equal(primaryCalls, 2); assert.equal(aiCalls, 2);
});
test('parallel translation retries share one request; target languages and dictionary headword contexts remain separate', async () => {
  let aiCalls = 0;
  const service = createTranslationService({ apiKey: 'test-only', fetchImpl: async (url, request) => {
    if (String(url).includes('mymemory')) return quota();
    aiCalls++; return gemini(request, (text, language) => `${language}:${text}`);
  } });
  assert.deepEqual(await Promise.all([service.translate('ambiguous', 'en', 'vi'), service.translate('ambiguous', 'en', 'vi')]), ['Vietnamese:ambiguous', 'Vietnamese:ambiguous']);
  assert.equal(aiCalls, 1);
  assert.equal(await service.translate('ambiguous', 'en', 'fr'), 'French:ambiguous');
  await service.translate('ambiguous', 'en', 'vi', { kind: 'headword', definition: 'a distinct sense' });
  assert.equal(aiCalls, 3);
});

test('a temporary Gemini 503 is retried once inside the same translation request and then cached',async()=>{
  let calls=0;
  const service=createTranslationService({apiKey:'test-only',fetchImpl:async(url,request)=>{
    if(String(url).includes('mymemory'))return quota();
    calls++;return calls===1?Response.json({error:{code:503,status:'UNAVAILABLE',message:'Temporarily unavailable'}},{status:503}):gemini(request);
  }});
  assert.equal(await service.translate('a complete new sentence','en','vi'),'vi:a complete new sentence');
  assert.equal(await service.translate('a complete new sentence','en','vi'),'vi:a complete new sentence');
  assert.equal(calls,2);assert.equal(service.status().aiError,null);
});
test('persistent upstream errors stop after two attempts; short deadlines and access failures do not retry',async()=>{
  for(const [status,timeoutMs,expected] of [[503,6500,2],[503,200,1],[403,6500,1],[429,6500,1],[400,6500,1]]){
    let calls=0;
    const service=createTranslationService({apiKey:'test-only',timeoutMs,fetchImpl:async(url)=>{
      if(String(url).includes('mymemory'))return quota();
      calls++;return Response.json({error:{code:status,status:'FAILED',message:'Provider failed'}},{status});
    }});
    await assert.rejects(service.translate('a complete new sentence','en','vi'));
    assert.equal(calls,expected);
  }
});

test('translation keeps its local deadline separate from the Google server deadline',async()=>{
  const service=createTranslationService({apiKey:'test-only',timeoutMs:150,fetchImpl:async(url,request)=>{
    if(String(url).includes('mymemory'))return quota();
    const deadline=Number(new Headers(request.headers).get('X-Server-Timeout'));
    if(deadline<10)return Response.json({error:{code:400,status:'INVALID_ARGUMENT',message:'Server deadline too short'}},{status:400});
    assert.ok(request.signal);return gemini(request);
  }});
  assert.equal(await service.translate('around the middle','en','vi'),'vi:around the middle');
});

test('full definitions reject abbreviated concept names while headword glosses keep their separate cache',async()=>{
  const definition='a substance formed during a chemical process before the desired product is obtained';
  const complete='Một chất được tạo thành trong một quá trình hóa học trước khi thu được sản phẩm mong muốn.';
  let generated=0;
  const service=createTranslationService({apiKey:'test-only',fetchImpl:async(url,request)=>{
    if(String(url).includes('mymemory'))return Response.json({responseStatus:200,responseData:{translatedText:'chất trung gian'}});
    generated++;const input=JSON.parse(JSON.parse(request.body).contents[0].parts[0].text);assert.equal(input.texts[0].purpose,'dictionaryDefinition');return gemini(request,()=>complete);
  }});
  assert.equal(await service.translate(definition,'en','vi'),'chất trung gian');
  assert.equal(await service.translate(definition,'en','vi',{kind:'definition'}),complete);
  assert.equal(await service.translate(definition,'en','vi',{kind:'definition'}),complete);assert.equal(generated,1);
});
test('Gemini quota, malformed or unchanged output are not stored as successful translations', async () => {
  let calls = 0;
  const service = createTranslationService({ apiKey: 'test-only', fetchImpl: async (url, request) => {
    if (String(url).includes('mymemory')) return quota();
    calls++;
    if (calls === 1) return Response.json({ error: { code: 429, message: 'Quota', status: 'RESOURCE_EXHAUSTED' } }, { status: 429 });
    if (calls === 2) return gemini(request, text => text);
    return gemini(request);
  } });
  await assert.rejects(service.translate('unique word', 'en', 'vi'), error => error.code === 'TRANSLATION_QUOTA');
  await assert.rejects(service.translate('unique word', 'en', 'vi'), error => error.code === 'TRANSLATION_UNAVAILABLE');
  assert.equal(await service.translate('unique word', 'en', 'vi'), 'vi:unique word');
  assert.equal(calls, 3);
});
test('unconfigured fallback returns the actual quota error, while intermediate Vietnamese gloss remains available', async () => {
  const service = createTranslationService({ fetchImpl: async () => quota() });
  await assert.rejects(service.translate('new definition', 'en', 'vi'), error => error.code === 'TRANSLATION_QUOTA' && error.status === 429);
  assert.match(await service.translate('intermediate', 'en', 'vi'), /trung gian; trung cấp/);
});
test('slow fallback stops at the total deadline and is never cached as success', async () => {
  let calls = 0;
  const service = createTranslationService({ apiKey: 'test-only', timeoutMs: 80, fetchImpl: async (url, request) => {
    if (String(url).includes('mymemory')) return quota();
    calls++;
    if (calls === 1) await new Promise(resolve => setTimeout(resolve, 150));
    return gemini(request);
  } });
  const start = Date.now();
  await assert.rejects(service.translate('slow definition', 'en', 'vi'), error => error.code === 'TRANSLATION_TIMEOUT');
  assert.ok(Date.now() - start < 140);
  assert.equal(await service.translate('slow definition', 'en', 'vi'), 'vi:slow definition');
});
test('invalid language, blank and oversized texts fail before any provider call', async () => {
  const service = createTranslationService({ fetchImpl: async () => { throw new Error('must not fetch'); } });
  for (const [text, from, to] of [['', 'en', 'vi'], ['x'.repeat(451), 'en', 'vi'], ['word', 'bogus', 'vi'], ['word', 'en', 'bogus']]) {
    await assert.rejects(service.translate(text, from, to), error => error.code === 'TRANSLATION_INVALID' && error.status === 400);
  }
});
test('reverse-language lookup requests one headword and keeps its cache separate from a learner gloss', async () => {
  const service = createTranslationService({ apiKey: 'test-only', fetchImpl: async (url, request) => {
    if (String(url).includes('mymemory')) return quota();
    const input = JSON.parse(JSON.parse(request.body).contents[0].parts[0].text);
    return gemini(request, () => input.texts[0].purpose === 'dictionaryLookup' ? 'intermediate' : 'intermediate; intermediary');
  } });
  assert.equal(await service.translate('trung gian', 'vi', 'en'), 'intermediate; intermediary');
  assert.equal(await service.translate('trung gian', 'vi', 'en', { kind: 'lookup' }), 'intermediate');
});
