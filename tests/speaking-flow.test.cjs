const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {observe,coaching}=require('../lib/speaking-flow');
const {validateOutput,createPracticalService}=require('../lib/practical-ai');
const {createSpeechEvidence,prepareSession}=require('../lib/practical-assessment');
const core=require('../public/assets/practical-core');
const answer='Um, uh, I want to um I want to share my experience. I has worked for one year.';
const response={reply:'What did you learn from that experience?',translation:'Bạn đã học được gì từ trải nghiệm đó?',feedback:'Dùng have với I.',phrase:{text:'gain hands-on experience',translation:'tích lũy kinh nghiệm thực tế'},collocations:[],corrections:[{original:'I want to',replacement:'I would like to',reason:'Một cụm không rõ vị trí.'},{original:'I has',replacement:'I have',reason:'Dùng have với chủ ngữ I.'}]};
const generated=value=>Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(value)}]},finishReason:'STOP'}]});
test('repeated starts and fillers cannot invalidate a good reply; one generation retains only an unambiguous grammar correction',async()=>{
 let calls=0;const service=createPracticalService({apiKey:'test-only',fetchImpl:async(_url,options)=>{calls++;const data=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);assert.equal(data.learnerSentence,answer);assert.equal(data.fillerObservations.fillerCount,3);return generated(response);}});
 const input={scenario:'work',level:'B1',requestId:crypto.randomUUID(),history:core.context(core.fresh('work')),text:answer};
 const reply=await service.reply(input);assert.equal(calls,1);assert.equal(reply.reply,response.reply);assert.equal(reply.transcript,answer);assert.equal(reply.improved,answer.replace('I has','I have'));assert.deepEqual(reply.corrections,[response.corrections[1]]);assert.equal(reply.coachingPartial,true);assert.equal(reply.speakingFlow.fillerCount,3);assert.deepEqual(await service.reply(input),reply);assert.equal(calls,1);
});
test('counts use complete filler tokens, preserve literal repeated quotes, and exclude legitimate words/discourse markers/acronyms',()=>{
 const result=observe('Um, uh, umm, erm, er, hmm. I want to um I want to explain.');assert.equal(result.fillerCount,7);assert.equal(result.restarts[0],'I want to um I want to');
 assert.equal(observe('Umbrella, umami, unusual, summer, thermal. I like the ER and UM teams. Well, so, you know, I like learning.').fillerCount,0);
 assert.equal(coaching('Um, I enjoy learning.','work'),null);assert.equal(coaching('I had had enough time, and I knew that that answer was right.','work'),null);
});
test('unsafe optional edits never erase an answer or apply part of a word, and filler-only removal is not a grammar correction',()=>{
 for(const corrections of [[{original:'Paris',replacement:'',reason:'Delete everything.'}],[{original:'aris',replacement:'London',reason:'Guess.'}],{bad:'format'}]){
  const output=validateOutput({...response,corrections},{text:'Paris',scenario:'work'});assert.equal(output.improved,'Paris');assert.equal(output.coachingPartial,true);
 }
 const output=validateOutput({...response,corrections:[{original:'Um',replacement:'',reason:'A filler is a grammar error.'}]},{text:'Um, I enjoy learning.',scenario:'work'});assert.equal(output.improved,output.transcript);assert.deepEqual(output.corrections,[]);
 const complete=validateOutput({...response,corrections:[{original:'work',replacement:'worked',reason:'Past tense.'}]},{text:'I work on my workbook.',scenario:'work'});assert.equal(complete.improved,'I worked on my workbook.');assert.equal(complete.coachingPartial,undefined);
});
test('speaking tips contain natural thinking/recall/rephrasing choices without translating typos or claiming measured speech scores',()=>{
 const result=coaching('Um, uh, erm, I work in hospitals.','work');assert.equal(result.source,'transcript');assert.equal(result.phrases.length,3);assert.equal(result.phrases[0].text,'Let me think for a moment.');assert.ok(result.phrases.some(item=>item.text.includes('think back')));assert.ok(result.phrases.some(item=>item.text==='How can I put this?'));assert.match(result.notice,/không đo/);assert.equal(result.band,undefined);
 assert.ok(coaching(answer,'opinions').phrases.some(item=>item.text==='The main point is…'));
});
test('assessment aggregates fillers from signed original speech instead of a cleaned-up draft, and saved feedback survives reload',()=>{
 const raw=answer+' '+Array.from({length:14},()=> 'I enjoy working with my colleagues.').join(' '),evidence=createSpeechEvidence('test-only'),device='a'.repeat(64),receipt=evidence.issue(raw,{fluency:{band:6,note:'Dừng để tìm từ.'},pronunciation:{band:6,note:'Dễ hiểu.'}},60000,device);
 const session=prepareSession({turns:[{question:'Tell me about yourself.',text:raw.replace(/\b(?:Um|um|uh)\b/g,''),speechReceipt:receipt}]},evidence,device);assert.equal(session.turns[0].answer,raw);assert.equal(session.fillerSummary.fillerCount,3);assert.equal(session.fillerSummary.source,'originalTranscript');
 const updated=core.add(core.fresh('work'),validateOutput(response,{text:answer,scenario:'work'}));const restored=core.restore(JSON.parse(JSON.stringify(updated)));assert.equal(restored.messages[1].feedback.speakingFlow.fillerCount,3);assert.equal(restored.messages[1].feedback.partial,true);
});
test('critical response and echo validation remain strict despite optional edit recovery',()=>{
 for(const value of [{...response,reply:''},{...response,transcript:'An invented answer.'},{...response,collocations:[{text:'broken'}]},{...response,phrase:{}}])assert.throws(()=>validateOutput(value,{text:answer,scenario:'work'}),{code:'PRACTICAL_OUTPUT'});
});
