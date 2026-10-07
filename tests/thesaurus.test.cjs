const {test,after} = require('node:test'), assert = require('node:assert/strict');
const {wiktionaryRelations,mergeRelations,words} = require('../lib/thesaurus');
const {wordnetMeanings,close} = require('../lib/lexicon');
after(close);
test('Wiktionary parser handles different words, languages, meanings, qualifiers and parts of speech',() => {
  const text=`==English==
===Noun===
# A [[disadvantage]]; something that [[detracts]].
#: {{syn|en|hindrance|{{l|en|obstacle}}|q1=rare}}
#: {{ant|en|benefit|advantage}}
# A tax refund.
#: {{syn|en|rebate}}
===Verb===
# To make a payment.
#: {{syn|en|repay}}
====Synonyms====
* {{sense|make a payment}} [[reimburse]], {{l|en|pay back}}
==French==
===Noun===
#: {{syn|en|wrong language}}`;
  const groups=wiktionaryRelations(text,'drawback',12345);
  assert.equal(groups.length,4);
  assert.deepEqual(groups[0].synonyms,['hindrance','obstacle']);assert.deepEqual(groups[0].antonyms,['benefit','advantage']);
  assert.deepEqual(groups[1].synonyms,['rebate']);assert.equal(groups[2].pos,'verb');
  assert.deepEqual(groups[3].synonyms,['reimburse','pay back']);
  assert.ok(groups.every(group=>group.license==='CC BY-SA 4.0' && group.sourceUrl.endsWith('oldid=12345')));
  assert.ok(!groups.some(group=>group.synonyms.includes('wrong language')));
});
test('additional dictionary senses stay separate; no fuzzy matching or cross-POS relation leakage',() => {
  const senses=[{definition:'A financial institution.',synonyms:['depository financial institution'],antonyms:[]}];
  const extra=[{pos:'noun',senses:[{definition:'The land beside a river.',synonyms:['riverbank'],antonyms:[]}],synonyms:[],antonyms:[]}];
  const wiki={available:true,groups:[{pos:'verb',definition:'To tilt.',synonyms:['tip'],antonyms:[]}]};
  const [noun]=mergeRelations('bank',[{pos:'noun',senses}],extra,{synonyms:[{word:'tilt',tags:['v']}],antonyms:[]},wiki);
  assert.deepEqual(noun.senses[0].synonyms,['depository financial institution']);
  assert.deepEqual(noun.relatedSynonyms,[]);assert.equal(noun.thesaurus.length,1);assert.deepEqual(noun.thesaurus[0].synonyms,['riverbank']);
});
test('Wiktionary thesaurus references are not displayed as words and ws lists retain their own sense',() => {
  const reference=wiktionaryRelations('==English==\n===Adjective===\n# Between extremes.\n#: {{syn|en|Thesaurus:intermediate}}','intermediate');
  assert.deepEqual(reference[0].synonyms,[]);assert.deepEqual(reference[0].references,['Thesaurus:intermediate']);
  const text='==English==\n===Adjective===\n===={{ws sense|en|between extremes}}====\n=====Synonyms=====\n{{ws|en|middle}}\n{{ws|en|medium}}\n=====Antonyms=====\n{{ws|en|extreme}}\n=====Hypernyms=====\n{{ws|en|entity}}';
  const groups=wiktionaryRelations(text,'Thesaurus:intermediate');
  assert.deepEqual(groups[0].synonyms,['middle','medium']);assert.equal(groups[0].definition,'between extremes');
  assert.deepEqual(groups[1].antonyms,['extreme']);assert.ok(!groups.some(g=>g.synonyms.includes('entity') || g.antonyms.includes('entity')));
});
test('all supplied drawback alternatives belong to disadvantage, never to the refund sense',() => {
  const [noun]=mergeRelations('drawback',[{pos:'noun',senses:[{definition:'the quality of being a hindrance'},{definition:'A partial refund of an import fee.'}]}]);
  for(const word of ['obstacle','hindrance','handicap','detriment','impediment','stumbling block','disadvantage'])assert.ok(noun.senses[0].synonyms.includes(word));
  assert.deepEqual(noun.senses[0].antonyms,['advantage','benefit']);assert.match(noun.senses[0].relationNote,/hoàn thuế/);
  assert.deepEqual(noun.senses[1].synonyms,[]);assert.deepEqual(noun.senses[1].antonyms,[]);
});
test('lists retain more than twelve valid alternatives, remove headword, duplicates and unsafe markup',() => {
  const values=['Word',' word ','a','A','<script>',...Array.from({length:30},(_,i)=>`term ${i}`)];
  assert.equal(words(values,'word').length,31);
});
test('representative antonyms across all four WordNet parts of speech preserve their own sense',async() => {
  for(const [word,opposite] of [['good','bad'],['hot','cold'],['buy','sell'],['success','failure'],['always','never'],['increase','decrease'],['happy','unhappy']]) {
    const meanings=await wordnetMeanings(word);
    assert.ok(meanings.some(m=>m.senses.some(s=>[...s.antonyms,...s.indirectAntonyms].includes(opposite))),`${word}: ${opposite}`);
    assert.ok(meanings.every(m=>m.senses.every(s=>!s.synonyms.includes(word) && !s.antonyms.includes(word))));
  }
  const run=await wordnetMeanings('run');assert.ok(run.find(m=>m.pos==='verb').senses.length>8,'later senses must not be truncated');
});
test('an unavailable provider is distinguishable from a valid empty relation result',() => {
  const base=[{pos:'noun',senses:[{definition:'An object.'}]}];
  assert.equal(mergeRelations('object',base,null,{synonyms:null,antonyms:null},{groups:[],available:false})[0].relationsUnavailable,true);
  assert.equal(mergeRelations('object',base,[],{synonyms:[],antonyms:[]},{groups:[],available:true})[0].relationsUnavailable,false);
});
