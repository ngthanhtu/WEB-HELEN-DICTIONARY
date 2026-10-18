'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSpeechEvidence,prepareSession,validateAssessment}=require('../lib/practical-assessment');
const {createPracticalService}=require('../lib/practical-ai');
const device='a'.repeat(64),secret='assessment-grounding-test-only',evidence=createSpeechEvidence(secret);
const observations={fluency:{band:6,note:'Some hesitation, but ideas remain understandable.'},pronunciation:{band:6,note:'Mostly intelligible with uneven word stress.'}};
const padding=' '+Array.from({length:13},()=> 'I enjoy meeting my friends after work.').join(' ');
const answer="I’m  learning English, because I has a new job. The temperature was -5 degrees and the rate was 3,5 percent."+padding;
const turnsFor=(text=answer)=>[{question:'Tell me about your daily life.',text}];
const sessionFor=(text=answer)=>prepareSession({turns:turnsFor(text)},evidence,device);
const reportFor=(quote='I has a new job')=>({summary:'Your ideas are understandable; work on agreement and precise vocabulary.',criteria:Object.fromEntries(['fluency','vocabulary','grammar','pronunciation'].map(key=>[key,{band:6,feedback:'You describe a real situation; use the correct verb form with I.',quote}])),nextSteps:['Practise explaining one example using two connected sentences.']});
const generated=value=>Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(value)}]},finishReason:'STOP'}]});
test('formatting-only legacy quotes restore exact original words without rewriting grammar or facts',()=>{
 const value=reportFor();value.criteria.grammar.quote="i'm learning english because i has a new job";
 const report=validateAssessment(value,sessionFor());assert.equal(report.criteria.grammar.band,6);assert.equal(report.criteria.grammar.quote,'I’m  learning English, because I has a new job');
 for(const quote of ['I have a new job','a completely different job','5 degrees','3.5 percent','jobless']){
  const modified=reportFor();modified.criteria.grammar.quote=quote;
  const partial=validateAssessment(modified,sessionFor());assert.equal(partial.criteria.grammar.band,null,quote);assert.equal(partial.criteria.grammar.quote,'');assert.equal(partial.criteria.vocabulary.band,6);
 }
 const fragment=reportFor();fragment.criteria.grammar.quote='learn';assert.equal(validateAssessment(fragment,sessionFor()).criteria.grammar.band,null);
});
test('server-owned evidence IDs resolve original signed answers including later turns, never corrected input or invented IDs',()=>{
 const original='I has valuable experience working in a hospital.';
 const turns=[...turnsFor(),{question:'Tell me about your experience.',text:original.replace('I has','I have'),speechReceipt:evidence.issue(original,observations,40000,device)}];
 const session=prepareSession({turns},evidence,device),source=session.evidence.find(value=>value.turn===2),value=reportFor();
 for(const key of ['vocabulary','grammar'])value.criteria[key]={band:6,feedback:'Use have with the subject I; explain a concrete workplace example.',evidenceId:source.id};
 const report=validateAssessment(value,session);assert.equal(report.criteria.grammar.quote,original);assert.equal(report.overall,null);
 for(const item of [{...value.criteria.grammar,evidenceId:'t999-e1'},{...value.criteria.grammar,quote:'I have valuable experience'}]){
  const partial=validateAssessment({...value,criteria:{...value.criteria,grammar:item}},session);assert.equal(partial.criteria.grammar.band,null);assert.equal(partial.criteria.grammar.quote,'');
 }
 for(const excerpt of session.evidence){assert.equal(session.turns[excerpt.turn-1].answer.slice(excerpt.start,excerpt.end),excerpt.text);assert.ok(excerpt.text.length<=240);}
});
test('unsupported acoustic hallucinations are ignored rather than blocking grounded text feedback',()=>{
 const value=reportFor();value.criteria.fluency={band:999,quote:'Invented speech',feedback:null};value.criteria.pronunciation={band:8,quote:'Never spoken words',feedback:'A perfect native accent.'};
 const report=validateAssessment(value,sessionFor());
 for(const key of ['fluency','pronunciation']){assert.equal(report.criteria[key].band,null);assert.equal(report.criteria[key].quote,'');assert.equal(report.criteria[key].unavailableReason,'insufficient_audio');assert.doesNotMatch(report.criteria[key].feedback,/perfect|native|Invented/);}
 assert.equal(report.criteria.grammar.band,6);assert.equal(report.criteria.vocabulary.band,6);assert.equal(report.overall,null);
});
test('one invalid criterion is isolated and wholly ungrounded textual reports remain rejected',()=>{
 for(const item of [undefined,{band:9,feedback:'Invented claim',quote:'I can solve every problem'},{band:6.3,feedback:'Bad score',quote:'I has a new job'},{band:null,feedback:'Insufficient text',evidenceId:''}]){
  const value=reportFor();value.criteria.grammar=item;const partial=validateAssessment(value,sessionFor());assert.equal(partial.partial,true);assert.equal(partial.criteria.grammar.band,null);assert.equal(partial.criteria.vocabulary.band,6);
 }
 assert.throws(()=>validateAssessment(reportFor('A completely invented answer'),sessionFor()),{code:'PRACTICAL_ASSESSMENT'});
 const zero=reportFor();zero.criteria.grammar.band=0;assert.equal(validateAssessment(zero,sessionFor()).criteria.grammar.band,0);
 const misleading=reportFor();misleading.summary='You made an invented error.';misleading.nextSteps=['Fix an invented error.'];misleading.criteria.grammar.quote='Invented error';const partial=validateAssessment(misleading,sessionFor());assert.doesNotMatch(partial.summary,/invented/i);assert.ok(partial.nextSteps.every(step=>!/invented/i.test(step)));
});
test('many tiny sentences do not expand the assessment prompt into unbounded excerpt metadata',()=>{
 const session=sessionFor('a. '.repeat(1900));assert.ok(session.evidence.length<60);
 assert.equal(session.evidence.at(-1).end,session.turns[0].answer.length);
});
test('only signed clips with both acoustic observations count toward the thirty-second minimum',()=>{
 const nullObservations={fluency:{band:null,note:'Not enough usable audio.'},pronunciation:{band:null,note:'Not enough usable audio.'}};
 const turns=[{question:'Question one?',text:answer,speechReceipt:evidence.issue(answer,observations,8000,device)},{question:'Question two?',text:'The second answer is not clear enough.',speechReceipt:evidence.issue('The second answer is not clear enough.',nullObservations,25000,device)}];
 const session=prepareSession({turns},evidence,device),report=validateAssessment(reportFor(),session);
 assert.equal(session.audioMs,33000);assert.equal(session.assessedAudioMs,8000);assert.equal(session.acoustic,false);assert.equal(report.coverage.assessedAudioSeconds,8);assert.equal(report.overall,null);
 const complete=prepareSession({turns:[{...turns[0],speechReceipt:evidence.issue(answer,observations,30000,device)},turns[1]]},evidence,device);
 assert.equal(complete.acoustic,true);assert.equal(complete.allSpoken,true);assert.equal(complete.allAcoustic,false);assert.equal(validateAssessment(reportFor(),complete).overall,null);
});
test('invalid duration receipts cannot create acoustic coverage, including legacy signed payloads',()=>{
 for(const duration of [0,-1,180001,Infinity,NaN])assert.equal(evidence.issue(answer,observations,duration,device),null);
 const payload=Buffer.from(JSON.stringify({v:1,transcript:answer,observations,durationMs:-40000,device,expires:Date.now()+60000})).toString('base64url');
 const key=crypto.createHash('sha256').update('helen-speaking-evidence-v1:'+secret).digest(),signature=crypto.createHmac('sha256',key).update(payload).digest('base64url');assert.equal(evidence.read(payload+'.'+signature,device),null);
});
test('acoustic references cannot attribute a typed excerpt to audio in a mixed session',()=>{
 const recorded='I went to the hospital to meet a colleague.'+padding,session=prepareSession({turns:[...turnsFor(),{question:'Where did you go?',text:recorded,speechReceipt:evidence.issue(recorded,observations,40000,device)}]},evidence,device),value=reportFor(),typed=session.evidence.find(item=>item.turn===1),spoken=session.evidence.find(item=>item.turn===2);
 value.criteria.fluency={band:6,feedback:'The pacing is generally understandable.',evidenceId:typed.id};value.criteria.pronunciation={band:6,feedback:'Stress could be clearer in the recorded sentence.',evidenceId:spoken.id};
 const report=validateAssessment(value,session);assert.equal(report.criteria.fluency.band,null);assert.equal(report.criteria.fluency.unavailableReason,'insufficient_evidence');assert.equal(report.criteria.pronunciation.band,6);assert.equal(report.criteria.pronunciation.quote,spoken.text);
});
test('assessment model selects server references, returns four criteria and reserves only one cached assessment',async()=>{
 let generatedCount=0,reservations=0;
 const service=createPracticalService({apiKey:'test-only',beforeGenerate:()=>{reservations++;},fetchImpl:async(_url,options)=>{
  generatedCount++;const payload=JSON.parse(options.body),session=JSON.parse(payload.contents[0].parts[0].text).session,schema=payload.generationConfig.responseJsonSchema;
  assert.ok(session.evidence.length);assert.ok(schema.properties.criteria.properties.grammar.required.includes('evidenceId'));assert.equal(schema.properties.criteria.properties.grammar.properties.quote,undefined);
  assert.match(payload.systemInstruction.parts[0].text,/Lexical Resource/);assert.match(payload.systemInstruction.parts[0].text,/original evidence/);
  const value=reportFor();for(const key of ['vocabulary','grammar'])value.criteria[key]={band:6,feedback:'Use have with I and add a concrete example.',evidenceId:session.evidence[0].id};
  value.criteria.fluency={band:7,feedback:'Do not display a guessed acoustic score.',evidenceId:'invented'};value.criteria.pronunciation={band:9,feedback:'Do not display an invented accent claim.',evidenceId:'invented'};return generated(value);
 }});
 const input={scenario:'coffee',level:'B1',stage:'assess',requestId:crypto.randomUUID(),turns:turnsFor()};
 const report=await service.reply(input,{device});assert.equal(report.stage,'assess');assert.deepEqual(Object.keys(report.criteria),['fluency','vocabulary','grammar','pronunciation']);assert.equal(report.criteria.grammar.quote,sessionFor().evidence[0].text);assert.equal(report.overall,null);
 assert.deepEqual(await service.reply({...input,requestId:crypto.randomUUID()},{device}),report);assert.equal(generatedCount,1);assert.equal(reservations,1);
});
