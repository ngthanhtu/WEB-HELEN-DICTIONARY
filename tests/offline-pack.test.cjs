const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raw = fs.readFileSync(path.join(__dirname, '../public/assets/offline-basics.json'), 'utf8');
const pack = JSON.parse(raw);

test('starter pack fits the offline app limits and includes useful learner vocabulary', () => {
  assert.equal(pack.version, 1);
  assert.equal(pack.source, 'Princeton WordNet');
  assert.equal(pack.entries.length, 50);
  assert.equal(new Set(pack.entries.map(entry => entry.word)).size, 50);
  assert.ok(Buffer.byteLength(raw) <= 750000);
  for (const word of ['intermediate', 'experiment', 'borrow', 'loan', 'bank', 'can', 'may', 'do', 'go', 'happy', 'sad', 'good', 'bad', 'book', 'school', 'friend', 'work', 'learn']) {
    assert.ok(pack.entries.some(entry => entry.word === word), `Missing ${word}`);
  }
});

test('every saved lookup has real definitions, human Vietnamese glosses and completed local metadata', () => {
  for (const { word, gloss, result } of pack.entries) {
    assert.ok(gloss.trim() && gloss.toLowerCase() !== word, `Invalid gloss for ${word}`);
    assert.equal(result.query, word);
    assert.equal(result.word, word);
    assert.equal(result.from, 'en');
    assert.equal(result.enriching, false);
    assert.equal(result.entries[0].word, word);
    assert.equal(result.entries[0].source, 'Princeton WordNet');
    assert.equal(result.entries[0].collocations.pending, false);
    assert.ok(result.entries[0].meanings.length);
    for (const meaning of result.entries[0].meanings) {
      assert.ok(['noun', 'verb', 'adjective', 'adverb'].includes(meaning.pos));
      assert.ok(meaning.senses.length);
      for (const sense of meaning.senses) {
        assert.ok(sense.definition.trim());
        assert.equal(sense.relationSource, 'Princeton WordNet');
        assert.ok(Array.isArray(sense.synonyms) && Array.isArray(sense.antonyms));
      }
    }
  }
  assert.match(pack.entries.find(entry => entry.word === 'intermediate').gloss, /trung gian/);
  assert.match(pack.entries.find(entry => entry.word === 'loan').gloss, /cho vay/);
  const experiment = pack.entries.find(entry => entry.word === 'experiment');
  assert.ok(experiment.result.entries[0].collocations.teaching.some(item => item.phrase === 'conduct an experiment'));
  const happy = pack.entries.find(entry => entry.word === 'happy');
  assert.ok(happy.result.entries[0].meanings.some(meaning => meaning.senses.some(sense => sense.antonyms.includes('unhappy'))));
});

test('the downloadable WordNet data carries the exact license and disclaimer', () => {
  const provided = fs.readFileSync(path.join(path.dirname(require.resolve('wordnet-db/package.json')), 'LICENSE'), 'utf8');
  const standalone = fs.readFileSync(path.join(__dirname, '../public/assets/wordnet-license.txt'), 'utf8');
  assert.equal(pack.license, provided);
  assert.equal(standalone, provided);
  assert.match(pack.license, /Copyright 2006 by Princeton University/);
  assert.match(pack.license, /ALL copies/);
  assert.match(pack.license, /PROVIDED "AS IS"/);
});
