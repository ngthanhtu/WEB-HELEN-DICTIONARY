const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../public/assets/practical-core');
const original='I enjoy learning new skills and working with my colleagues. '.repeat(9).trim();
const state=()=>core.add(core.fresh('work'),{transcript:original,reply:'What would you like to learn next?'});
const report=()=>({stage:'assess',overall:null,summary:'Clear ideas with room to improve.',notice:'A practice estimate only.',criteria:Object.fromEntries(['fluency','vocabulary','grammar','pronunciation'].map(key=>[key,{band:['grammar','vocabulary'].includes(key)?6:null,feedback:'Practise a specific example.',quote:['grammar','vocabulary'].includes(key)?'I enjoy learning new skills':''}])),nextSteps:['Practise one example.'],coverage:{turns:1,words:original.split(/\s+/).length,audioSeconds:0,allSpoken:false}});
test('valid four-criterion and partial reports survive reload with the original journal',()=>{
 const chat=state(),session={...core.sessionFrom(chat),report:report()};
 assert.deepEqual(core.restoreSession(JSON.parse(JSON.stringify(session)),chat),session);
 const partial=report();partial.criteria.grammar={band:null,feedback:'More original evidence is needed next session.',quote:''};partial.partial=true;
 assert.deepEqual(core.restoreSession({...session,report:partial},chat).report,partial);
});
test('malformed or stale saved reports never prevent continuing the unchanged accepted conversation',()=>{
 const chat=state(),session=core.sessionFrom(chat);
 for(const change of [r=>({...r,overall:'6'}),r=>({...r,criteria:{}}),r=>({...r,nextSteps:[{}]}),r=>({...r,coverage:null}),r=>({...r,criteria:{...r.criteria,grammar:{...r.criteria.grammar,band:6.2}}}),r=>({...r,overall:6}),r=>({...r,summary:''})]){
  const restored=core.restoreSession({...session,report:change(report())},chat);
  assert.equal(restored.report,null);assert.deepEqual(restored.turns,session.turns);assert.equal(core.canSend(restored,'I would like to practise more.'),true);
 }
});
test('complete scored reports restore only with all four bands and adequate spoken coverage; band zero is valid',()=>{
 const chat=state(),session=core.sessionFrom(chat),value=report();
 value.overall=0;value.coverage={...value.coverage,audioSeconds:40,allSpoken:true};
 for(const criterion of Object.values(value.criteria))criterion.band=0;
 assert.deepEqual(core.restoreSession({...session,report:value},chat).report,value);
 value.coverage.audioSeconds=20;assert.equal(core.restoreSession({...session,report:value},chat).report,null);
});
