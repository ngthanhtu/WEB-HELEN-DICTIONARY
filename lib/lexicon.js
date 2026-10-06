// The reader's legacy ES6 shim replaces Promise on modern Node; preserve Node's implementation.
const NativePromise = global.Promise;
const WordNet = require('node-wordnet');
global.Promise = NativePromise;
const database = require('wordnet-db');
const lexicon = new WordNet({ dataDir: database.path, cache: true });
const lemma = value => String(value || '').replace(/_/g, ' ').replace(/\((?:a|p|ip)\)$/, '').trim();
const distinct = (values, word) => [...new Set(values.map(lemma).filter(v => v && v.toLowerCase() !== word.toLowerCase()))];
async function wordnetMeanings(word) {
  const records = await lexicon.lookupAsync(word.replace(/ /g, '_'));
  const grouped = new Map();
  for (const record of [...records].reverse()) {
    const pos = {n:'noun',v:'verb',a:'adjective',s:'adjective',r:'adverb'}[record.pos];
    if (!pos || !record.def) continue;
    const sourceIndexes = record.synonyms.flatMap((name,index) => lemma(name).toLowerCase() === word.toLowerCase() ? [index + 1] : []);
    const antonyms = [];
    for (const pointer of record.ptrs.filter(p => p.pointerSymbol === '!')) {
      const packed = parseInt(pointer.sourceTarget, 16);
      const sourceIndex = packed >> 8, targetIndex = packed & 255;
      if (sourceIndex && !sourceIndexes.includes(sourceIndex)) continue;
      const target = await lexicon.getAsync(pointer.synsetOffset, pointer.pos);
      if (target) antonyms.push(...(targetIndex ? [target.synonyms[targetIndex - 1]] : target.synonyms));
    }
    const senses = grouped.get(pos) || [];
    senses.push({definition:record.def,example:record.exp?.[0] || '',examples:record.exp || [],
      synonyms:distinct(record.synonyms,word),antonyms:distinct(antonyms,word),relationSource:'Princeton WordNet'});
    grouped.set(pos,senses);
  }
  return [...grouped].map(([pos,senses]) => ({pos,senses:senses.slice(0,8),synonyms:[],antonyms:[]}));
}
module.exports = { wordnetMeanings, close: () => lexicon.close() };
