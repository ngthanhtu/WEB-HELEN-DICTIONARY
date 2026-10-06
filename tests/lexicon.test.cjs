const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const NativePromise = global.Promise;
const { wordnetMeanings, close } = require('../lib/lexicon');
after(close);
test('reader preserves modern Promise support', () => {
  assert.equal(global.Promise, NativePromise);
  assert.equal(typeof Promise.any, 'function');
});
test('experiment relations belong to individual senses, not all noun senses', async () => {
  const meanings = await wordnetMeanings('experiment');
  const noun=meanings.find(m=>m.pos==='noun'), verb=meanings.find(m=>m.pos==='verb');
  const testing=noun.senses.find(s=>s.definition.includes('testing of an idea'));
  const venture=noun.senses.find(s=>s.definition.includes('venture'));
  assert.ok(testing.synonyms.includes('experimentation'));
  assert.ok(!venture.synonyms.includes('experimentation'));
  assert.ok(verb.senses.some(s=>s.synonyms.includes('try out')));
  assert.ok(meanings.every(m=>m.senses.every(s=>!s.synonyms.includes('experiment'))));
});
test('hot has a direct cold antonym for its temperature sense, not every sense', async () => {
  const meanings = await wordnetMeanings('hot');
  const senses=meanings.flatMap(m=>m.senses);
  assert.ok(senses.find(s=>s.definition.includes('physical heat')).antonyms.includes('cold'));
  assert.ok(!senses.find(s=>s.definition.includes('stolen')).antonyms.includes('cold'));
});
test('unknown words return no invented lexical entries', async () => {
  assert.deepEqual(await wordnetMeanings('zznotadictionarywordzz'), []);
});
