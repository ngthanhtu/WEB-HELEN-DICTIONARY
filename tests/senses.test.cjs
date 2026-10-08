const {test}=require('node:test'),assert=require('node:assert/strict');
const senses=require('../public/assets/sense-core');
const {createContextService,validateContext}=require('../lib/context-ai');
const finance={definition:'A financial institution.',example:'The bank approved my loan.'};
const river={definition:'Sloping land beside a river.',examples:['We sat on the river bank.']};
const entry={word:'bank',source:'Test dictionary',meanings:[{pos:'noun',senses:[finance,river]}]};
const lesson={title:'By the river',examples:[{text:'We rested on the bank.',translation:'Chúng tôi nghỉ trên bờ sông.'},{text:'Flowers grow along the bank.',translation:'Hoa mọc dọc bờ sông.'}],
  dialogue:[{speaker:'Anna',text:'Let us sit on the bank.',translation:'Chúng ta ngồi trên bờ sông nhé.'},{speaker:'Mark',text:'The water is calm here.',translation:'Nước ở đây yên ả.'},{speaker:'Anna',text:'We can watch the birds.',translation:'Chúng ta có thể ngắm chim.'},{speaker:'Mark',text:'That sounds lovely.',translation:'Nghe hay đấy.'}],
  scenario:{text:'Anna sits on the bank beside a quiet river.',translation:'Anna ngồi trên bờ một dòng sông yên ả.'},usageNote:'Bank ở đây là bờ sông, khác với nghĩa ngân hàng.',videoPrompt:'Animate two friends sitting beside a quiet river.'};
test('sense identity survives reorder, enrichment and whitespace without mixing examples or parts of speech',()=>{
  const chosen=senses.choices(entry)[1];assert.deepEqual(chosen.examples,river.examples);assert.equal(chosen.label,'noun · 2');
  const reordered={...entry,meanings:[{pos:'verb',senses:[finance]},{pos:'noun',senses:[{...river,definition:' Sloping  land beside a river. ',synonyms:['riverbank']},finance]}]};
  const resolved=senses.resolve(reordered,{senseKey:chosen.value,meaningIndex:0,senseIndex:1});
  assert.equal(resolved.pos,'noun');assert.equal(resolved.meaningIndex,1);assert.equal(resolved.senseIndex,0);assert.deepEqual(resolved.examples,river.examples);
  assert.notEqual(senses.key('noun',finance.definition),senses.key('verb',finance.definition));
  assert.equal(senses.resolve(entry,{senseKey:senses.key('noun','An invented sense.'),senseIndex:0}),undefined);
  assert.equal(senses.resolve(entry,{senseIndex:0}).definition,finance.definition);
});
test('missing dictionary examples stay empty and are never borrowed from another sense',()=>{
  const list=senses.choices({meanings:[{pos:'noun',usageExamples:['A generic bank example.'],senses:[finance,{definition:'A store of something.'}]}]});
  assert.deepEqual(list[1].examples,[]);assert.deepEqual(list[0].examples,[finance.example]);
});
test('new AI lessons require two translated examples with the exact headword, while old lessons remain readable',()=>{
  assert.equal(validateContext(lesson,'bank',{requireExamples:true}).examples.length,2);
  const old={...lesson};delete old.examples;assert.equal(validateContext(old,'bank').examples,undefined);
  for(const examples of [undefined,[],[lesson.examples[0]],[{text:'A banking service.',translation:'Dịch.'},lesson.examples[1]],[{text:'A bank.',translation:''},lesson.examples[1]]])assert.throws(()=>validateContext({...lesson,examples},'bank',{requireExamples:true}));
});
test('AI receives trusted sense evidence, deduplicates generation and separates meanings and languages',async t=>{
  const original=global.fetch;t.after(()=>global.fetch=original);let requests=[],stored=[];
  global.fetch=async(input,options)=>{
    const request=JSON.parse(options.body);requests.push(request);
    return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(lesson)}]},finishReason:'STOP'}]});
  };
  const service=createContextService({apiKey:'test-only',model:'gemini-3.1-flash-lite',store:{get:async()=>null,set:async(...args)=>stored.push(args)}});
  const input={word:'bank',pos:'noun',definition:river.definition,language:'vi',dictionaryExamples:river.examples,alternatives:[finance.definition]};
  const [one,two]=await Promise.all([service.generate(input),service.generate(input)]);assert.deepEqual(one,two);assert.equal(requests.length,1);
  const prompt=JSON.parse(requests[0].contents[0].parts[0].text);
  assert.equal(prompt.dictionaryDefinition,river.definition);assert.deepEqual(prompt.dictionaryExamples,river.examples);assert.deepEqual(prompt.otherDefinitions,[finance.definition]);
  assert.match(requests[0].systemInstruction.parts[0].text,/never mix in otherDefinitions/);
  assert.equal(one.definition,river.definition);assert.equal(stored[0][0],'context-v2');
  await service.generate({...input,definition:finance.definition});await service.generate({...input,language:'fr'});assert.equal(requests.length,3);
});
test('malformed AI examples are not cached, and mismatched persisted lessons are regenerated',async t=>{
  const original=global.fetch;t.after(()=>global.fetch=original);let calls=0,saves=0;
  global.fetch=async()=>{calls++;return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(calls===1?{...lesson,examples:[]}:lesson)}]},finishReason:'STOP'}]});};
  const service=createContextService({apiKey:'test-only',model:'gemini-3.1-flash-lite',store:{get:async()=>({value:{...lesson,word:'bank',pos:'noun',definition:finance.definition,language:'vi'}}),set:async()=>saves++}});
  const input={word:'bank',pos:'noun',definition:river.definition,language:'vi'};
  await assert.rejects(service.generate(input),/Invalid AI examples/);assert.equal(saves,0);
  assert.equal((await service.generate(input)).definition,river.definition);assert.equal(calls,2);assert.equal(saves,1);
});
