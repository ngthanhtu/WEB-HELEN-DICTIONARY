const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createPracticalService,validateInput}=require('../lib/practical-ai');
const {createSpeechEvidence,prepareSession,validateAssessment}=require('../lib/practical-assessment');
const core=require('../public/assets/practical-core');
const device='a'.repeat(64),answer='I has a coffee, please. '+Array.from({length:24},()=> 'I enjoy meeting my friends after work.').join(' ');
const observations={fluency:{band:6,note:'Có vài khoảng dừng khi phát triển ý.'},pronunciation:{band:6.5,note:'Dễ hiểu, cần luyện trọng âm.'}};
const request=changes=>({scenario:'coffee',level:'B1',requestId:crypto.randomUUID(),history:core.context(core.fresh()),...changes});
const clip=()=>({audio:Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypM4A '),Buffer.alloc(1000000)]).toString('base64'),mimeType:'audio/mp4',language:'en-US',durationMs:180000});
const generated=value=>Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(value)}]},finishReason:'STOP'}]});
const result=(quote='I has a coffee, please.')=>({summary:'Bạn truyền đạt được ý chính.',criteria:Object.fromEntries(['fluency','vocabulary','grammar','pronunciation'].map((key,i)=>[key,{band:6+i*.5,feedback:'Luyện cách phát triển ý và trọng âm.',quote}])),nextSteps:['Luyện một câu ví dụ mới mỗi ngày.']});
test('three-minute audio and a complete long answer pass speaking limits while search limits remain unchanged',()=>{
 const input=validateInput(request({...clip(),stage:'transcribe'}));assert.equal(input.durationMs,180000);assert.ok(input.recording.audio.length>750000);
 assert.equal(validateInput(request({text:answer})).text,answer);
 assert.throws(()=>validateInput(request({...clip(),durationMs:180001})),{code:'SPEECH_DURATION'});
 assert.throws(()=>validateInput(request({text:'word '.repeat(901)})),{code:'PRACTICAL_INPUT'});
});
test('device-bound audio observations cannot be forged, transferred, or replaced by a corrected answer',()=>{
 const evidence=createSpeechEvidence('test-only'),receipt=evidence.issue(answer,observations,120000,device);
 const session=prepareSession({turns:[{question:'What do you enjoy?',text:answer.replace('I has','I have'),speechReceipt:receipt}]},evidence,device);
 assert.equal(session.turns[0].answer,answer);assert.equal(session.acoustic,true);assert.equal(session.allSpoken,true);
 for(const proof of [receipt+'x',receipt.replace(/.$/,'x'),undefined])assert.equal(prepareSession({turns:[{question:'Question',text:answer,speechReceipt:proof}]},evidence,device).acoustic,false);
 assert.equal(prepareSession({turns:[{question:'Question',text:answer,speechReceipt:receipt}]},evidence,'b'.repeat(64)).acoustic,false);
 assert.equal(evidence.issue(answer,{...observations,pronunciation:{band:10,note:'Wrong'}},120000,device),null);
});
test('IELTS overall is computed from four equally weighted criteria, never from a model-authored total',()=>{
 const evidence=createSpeechEvidence('test-only'),receipt=evidence.issue(answer,observations,120000,device),session=prepareSession({turns:[{question:'Question',text:answer,speechReceipt:receipt}]},evidence,device);
 const report=validateAssessment({...result(),overall:9},session);assert.equal(report.overall,7);assert.equal(report.estimated,true);assert.match(report.notice,/không phải điểm IELTS chính thức/);assert.equal(report.coverage.audioSeconds,120);
});
test('typed or insufficient audio never fabricates fluency, pronunciation or an overall speaking band',()=>{
 const evidence=createSpeechEvidence('test-only');
 for(const turns of [[{question:'Question',text:answer}],[{question:'Question',text:answer,speechReceipt:evidence.issue(answer,observations,9000,device)}]]){
  const report=validateAssessment(result(),prepareSession({turns},evidence,device));assert.equal(report.overall,null);assert.equal(report.criteria.fluency.band,null);assert.equal(report.criteria.pronunciation.band,null);assert.equal(report.criteria.grammar.band,7);
 }
 const mixed=prepareSession({turns:[{question:'Question',text:answer,speechReceipt:evidence.issue(answer,observations,120000,device)},{question:'Question',text:'An extra typed sentence.'}]},evidence,device);assert.equal(validateAssessment(result(),mixed).overall,null);
});
test('assessment rejects thin samples, wholly ungrounded reports and missing report structure',()=>{
 const evidence=createSpeechEvidence('test-only');assert.throws(()=>prepareSession({turns:[{question:'Question',text:'A short answer.'}]},evidence,device),{code:'PRACTICAL_TOO_SHORT'});
 const session=prepareSession({turns:[{question:'Question',text:answer}]},evidence,device);
 for(const value of [result('Never said this.'),{...result(),nextSteps:[]}])assert.throws(()=>validateAssessment(value,session),{code:'PRACTICAL_ASSESSMENT'});
 const report=validateAssessment({...result(),criteria:{...result().criteria,grammar:{band:6.3,feedback:'Wrong',quote:'I has'}}},session);
 assert.equal(report.criteria.grammar.band,null);assert.equal(report.criteria.grammar.quote,'');assert.equal(report.criteria.vocabulary.band,6.5);assert.equal(report.partial,true);
});
test('transcribe then assess uses signed audio evidence, original speech, separate budget and one cached final evaluation',async()=>{
 const stages=[],payloads=[],service=createPracticalService({apiKey:'test-only',beforeGenerate:info=>stages.push(info.stage),fetchImpl:async(_url,options)=>{
  const payload=JSON.parse(options.body),data=JSON.parse(payload.contents[0].parts[0].text);payloads.push(data);
  return generated(data.task==='faithful-practical-transcription'?{transcript:answer,audibility:'clear',speech:observations}:result());
 }});
 const transcript=await service.reply(request({...clip(),stage:'transcribe'}),{device});assert.ok(transcript.speechReceipt);
 const input=request({stage:'assess',turns:[{question:'Question',text:answer.replace('I has','I have'),speechReceipt:transcript.speechReceipt}]});
 const report=await service.reply(input,{device});assert.equal(report.overall,7);assert.deepEqual(stages,['transcribe','assess']);assert.equal(payloads[1].session.turns[0].answer,answer);assert.deepEqual(await service.reply(input,{device}),report);assert.equal(payloads.length,2);
});
test('long coaching builds the corrected answer locally instead of regenerating the whole transcript, and includes collocation examples',async()=>{
 const value={reply:'That sounds lovely! Where do you meet your friends?',translation:'Nghe thật vui! Bạn gặp bạn bè ở đâu?',feedback:'Dùng have với I.',corrections:[{original:'I has',replacement:'I have',reason:'Dùng have với chủ ngữ I.'}],phrase:{text:'catch up with friends',translation:'gặp gỡ, trò chuyện với bạn bè'},collocations:[{text:'maintain friendships',translation:'duy trì tình bạn',example:'Regular conversations help us maintain friendships.'}]};
 const service=createPracticalService({apiKey:'test-only',fetchImpl:async(_url,options)=>{const payload=JSON.parse(options.body);assert.equal(payload.generationConfig.responseJsonSchema.properties.transcript,undefined);return generated(value);}});
 const response=await service.reply(request({text:answer}),{device});assert.equal(response.transcript,answer);assert.equal(response.improved,answer.replace('I has','I have'));assert.deepEqual(response.collocations,value.collocations);
});
test('a complete session retains earlier answers beyond the visible chat window and survives reload independently of cached words',()=>{
 let state=core.fresh(),session=core.sessionFrom(state);
 for(let i=0;i<18;i++){const text='Answer '+i;session.turns.push({text,question:state.messages.at(-1).text});state=core.add(state,{transcript:text,reply:'Next question?',improved:text,feedback:'Good',phrase:{text:'phrase',translation:'nghĩa'}});}
 assert.equal(state.messages.length,25);assert.equal(session.turns.length,18);assert.equal(core.restoreSession(JSON.parse(JSON.stringify(session)),state).turns[0].text,'Answer 0');assert.equal(core.canSend({...session,report:result()},'new'),false);
});
