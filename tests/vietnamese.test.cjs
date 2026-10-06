const {test}=require('node:test');
const assert=require('node:assert/strict');
const {vietnameseGloss,usableTranslation}=require('../lib/vietnamese');
const {createContextService,validateContext}=require('../lib/context-ai');
test('English learner glosses distinguish Vietnamese-looking spellings and preserve polysemy',()=>{
  assert.match(vietnameseGloss('Loan'),/khoản vay.*cho vay.*cho mượn/);
  assert.match(vietnameseGloss('may'),/có thể.*tháng Năm/);
  assert.match(vietnameseGloss('bank'),/ngân hàng.*bờ sông/);
  assert.match(vietnameseGloss('mine'),/của tôi.*mỏ.*mìn/);
  for(const word of ['constructor','__proto__','unknown-lemma']) assert.equal(vietnameseGloss(word),null);
});
test('unchanged English is rejected while shared loanwords and matching-language text are valid',()=>{
  for(const [word,translation] of [['loan','Loan'],['unknown','UNKNOWN.'],['English sentence.','English sentence.']]) assert.equal(usableTranslation(word,translation,'en','vi'),false);
  assert.equal(usableTranslation('loan','khoản vay','en','vi'),true);
  assert.equal(usableTranslation('internet','Internet','en','vi'),true);
  assert.equal(usableTranslation('loan','loan','en','fr'),true);
});
test('AI without a key fails explicitly instead of inventing generated data',async()=>{
  const service=createContextService({});assert.equal(service.configured,false);
  await assert.rejects(service.generate({word:'loan',language:'vi'}),error=>error.status===501);
  assert.throws(()=>validateContext({dialogue:[]},'loan'));
});
