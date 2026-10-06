const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spellingSuggestions}=require('../lib/spelling');
const {voiceMetadata}=require('../lib/voice-labels');
const {teachingCollocations,corpusPhrases}=require('../lib/collocations');
test('spelling ranks nearby real words and handles transposition without accepting arbitrary input',async()=>{
  const suggestions=await spellingSuggestions('experimence');
  assert.equal(suggestions[0],'experience'); assert.equal(suggestions[1],'experiment');
  assert.equal((await spellingSuggestions('expreiment'))[0],'experiment');
  for(const word of ['<script>alert(1)</script>','a'.repeat(100),'môi trường','zzzzzzzzzzzz']) assert.deepEqual(await spellingSuggestions(word),[]);
});
test('accent labels never guess from names or map other English accents to British',()=>{
  for(const accent of ['american','US','United States','general-american']) assert.equal(voiceMetadata({labels:{accent}}).dialect,'Ame');
  for(const accent of ['british','UK','received pronunciation','english']) assert.equal(voiceMetadata({labels:{accent}}).dialect,'Eng');
  for(const accent of ['', 'Australian English','Indian English','Canadian','British American']) assert.equal(voiceMetadata({name:'British Sarah',labels:{accent}}).dialect,null);
});
test('corpus phrases require evidence and exclude function words, punctuation and duplicates',()=>{
  const items=[{word:'the',score:100},{word:'.',score:99},{word:'scientific',score:10},{word:'madeup'},{word:'experiment',score:5}];
  assert.deepEqual(corpusPhrases('experiment',items,true).map(item=>item.phrase),['scientific experiment']);
  assert.deepEqual(corpusPhrases('experiment',items,false).map(item=>item.phrase),['experiment scientific']);
  assert.ok(teachingCollocations('experiment').every(item=>item.example && item.source.includes('biên soạn')));
  assert.deepEqual(teachingCollocations('unknown-word'),[]);
});
