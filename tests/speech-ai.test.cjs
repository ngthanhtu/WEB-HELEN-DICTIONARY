const test=require('node:test');
const assert=require('node:assert/strict');
const {createSpeechService,validateRecording,MAX_AUDIO_BYTES}=require('../lib/speech-ai');
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypM4A '),Buffer.alloc(36)]).toString('base64');
const clip={audio:mp4,mimeType:'audio/mp4;codecs=mp4a.40.2',language:'en-US',durationMs:950};
const answer=text=>Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({transcript:text,language:'en'})}]},finishReason:'STOP'}]});

test('speech rejects mismatched containers, oversized data, unsupported languages and long clips',()=>{
  assert.equal(validateRecording(clip).mimeType,'audio/mp4');
  assert.equal(validateRecording(clip).language,'en');
  assert.equal(validateRecording({...clip,language:'zh-TW'}).language,'zh-TW');
  for(const change of [{mimeType:'text/html'},{mimeType:'audio/webm'},{audio:'not-base64'},{language:'xx-XX'},{durationMs:18000},{audio:Buffer.alloc(MAX_AUDIO_BYTES+1).toString('base64')}]) {
    assert.throws(()=>validateRecording({...clip,...change}),error=>error.status===400);
  }
});

test('speech sends actual MP4 inline audio and preserves spoken text without translation',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});let request;
  global.fetch=async(input,options)=>{request=JSON.parse(options.body);return answer('  intermediate  ');};
  const service=createSpeechService({apiKey:'test-only'});
  const result=await service.transcribe(clip);
  assert.deepEqual(result,{text:'intermediate',language:'en'});
  assert.equal(request.contents[0].parts[1].inlineData.mimeType,'audio/mp4');
  assert.equal(request.contents[0].parts[1].inlineData.data,mp4);
  assert.equal(request.generationConfig.temperature,0);
  assert.match(request.systemInstruction.parts[0].text,/do not translate/i);
});

test('speech distinguishes missing configuration, silence and provider quota without retries',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});
  await assert.rejects(createSpeechService({}).transcribe(clip),error=>error.status===501);
  global.fetch=async()=>answer('');
  await assert.rejects(createSpeechService({apiKey:'test-only'}).transcribe(clip),error=>error.code==='SPEECH_NO_VOICE' && error.status===422);
  let count=0;global.fetch=async()=>{count++;return Response.json({error:{code:429,message:'PRIVATE PROVIDER DETAILS',status:'RESOURCE_EXHAUSTED'}},{status:429});};
  await assert.rejects(createSpeechService({apiKey:'test-only'}).transcribe(clip),error=>error.status===429 && !error.message.includes('PRIVATE'));
  assert.equal(count,1);
});

test('speech respects explicit models and replaces retired default with an available Flash model',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});let called=[];
  global.fetch=async(input,options)=>{
    const url=new URL(input);called.push(url.pathname);
    if(!options.body) return Response.json({models:[{name:'models/gemini-3.1-flash-lite',supportedGenerationMethods:['generateContent']}]});
    if(url.pathname.includes('gemini-flash-lite-latest:')) return Response.json({error:{code:404,message:'Retired model',status:'NOT_FOUND'}},{status:404});
    return answer('loan');
  };
  const service=createSpeechService({apiKey:'test-only'});
  assert.equal((await service.transcribe(clip)).text,'loan');
  assert.equal(service.model,'gemini-3.1-flash-lite');
  assert.equal(called.length,3);
  called=[];
  await assert.rejects(createSpeechService({apiKey:'test-only',model:'gemini-flash-lite-latest'}).transcribe(clip),error=>error.status===503);
  assert.equal(called.length,1);
});

test('speech caps total provider wait and aborts the request',async t=>{
  const original=global.fetch;t.after(()=>{global.fetch=original;});let signal;
  global.fetch=(input,options)=>{signal=options.signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));};
  await assert.rejects(createSpeechService({apiKey:'test-only',timeoutMs:40}).transcribe(clip),error=>error.code==='SPEECH_TIMEOUT' && error.status===504);
  assert.equal(signal.aborted,true);
});
