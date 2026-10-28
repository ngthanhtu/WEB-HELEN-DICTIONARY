const {test}=require('node:test'),assert=require('node:assert/strict');
const languages=require('../public/assets/languages'),i18n=require('../public/assets/i18n'),messages=require('../public/assets/ui-messages');
const {createTranslationService}=require('../lib/translation');
test('only the seven supported languages are shared by dictionary, AI, speech and interface catalogs',()=>{
 const codes=['en','vi','ko','ja','zh-CN','es','fr'];
 assert.deepEqual(Object.keys(languages.names),codes);assert.deepEqual(Object.keys(require('../lib/context-ai').languages),codes);assert.deepEqual(Object.keys(languages.speech),codes);
 assert.deepEqual(messages.locales,codes);
 for(const row of messages.rows){assert.equal(row.length,7,row[0]);assert.ok(row.every(value=>typeof value==='string' && value.trim()),row[0]);}
 for(const [input,expected] of [['ko-KR','ko'],['ja_JP','ja'],['zh-TW','zh-CN'],['zh-Hans-CN','zh-CN'],['en-GB','en'],['fr-CA','fr'],['es-MX','es']])assert.equal(languages.normalize(input),expected);
 for(const input of [null,{},['en'],'de','it','ru','auto','__proto__','constructor','en|vi','en<script>'])assert.equal(languages.normalize(input),null);
});
test('device interface language and saved translation directions stay independent, including legacy migration',()=>{
 const saved={'helen-target':'ko','helen-from':'fr','helen-study-v1':'keep'},storage={getItem:key=>saved[key]};
 assert.deepEqual(languages.preferences(storage,{languages:['fr-CA','en-US']}),{locale:'fr',from:'fr',to:'ko'});
 saved['helen-target']='de';saved['helen-from']='ru';assert.deepEqual(languages.preferences(storage,{language:'ja-JP'}),{locale:'ja',from:'en',to:'ja'});assert.equal(saved['helen-study-v1'],'keep');
 assert.equal(languages.deviceLocale({languages:['de-DE','es-MX']}),'es');assert.equal(languages.deviceLocale({language:'de-DE'}),'en');
 assert.equal(languages.preferences({getItem(){throw Error('private mode');}},{language:'vi-VN'}).to,'vi');
});
test('Topics keeps an explicit learning language without inheriting English from a reversed dictionary lookup',()=>{
 const values={'helen-from':'vi','helen-target':'en'},storage={getItem:key=>values[key]};
 assert.equal(languages.topicTarget(storage,{language:'vi-VN'}),'vi');
 assert.equal(languages.topicTarget(storage,{language:'ja-JP'}),'ja');
 assert.equal(languages.topicTarget(storage,{language:'en-US'}),'vi');
 values['helen-target']='fr';assert.equal(languages.topicTarget(storage,{language:'vi-VN'}),'fr');
 values['helen-topic-target-v1']='ko';values['helen-target']='en';assert.equal(languages.topicTarget(storage,{language:'vi-VN'}),'ko');
 values['helen-topic-target-v1']='en';assert.equal(languages.topicTarget(storage,{language:'vi-VN'}),'en','an explicit Topics choice is preserved');
 values['helen-topic-target-v1']='de';assert.equal(languages.topicTarget(storage,{language:'vi-VN'}),'vi');
 assert.equal(languages.topicTarget({getItem(){throw Error('private mode');}},{language:'es-MX'}),'es');
 assert.equal(values['helen-from'],'vi');assert.equal(values['helen-target'],'en');
});
test('all 42 translation directions and seven identical-language paths preserve source, target and persistent cache isolation',async()=>{
 const samples={en:'Where is the train station?',vi:'Ga tàu ở đâu?',ko:'기차역이 어디에 있나요?',ja:'駅はどこですか？','zh-CN':'火车站在哪里？',es:'¿Dónde está la estación de tren?',fr:'Où est la gare ?'},calls=[],persisted=new Map();
 const store={get:async(namespace,key)=>persisted.get(namespace+key),set:async(namespace,key,value)=>{persisted.set(namespace+key,{value});return true;}};
 const fetchImpl=async input=>{const url=new URL(input),[from,to]=url.searchParams.get('langpair').split('|');calls.push([from,to]);assert.equal(url.searchParams.get('q'),samples[from]);return Response.json({responseStatus:200,responseData:{translatedText:samples[to]}});};
 const service=createTranslationService({fetchImpl,store});
 for(const from of Object.keys(samples))for(const to of Object.keys(samples))assert.equal(await service.translate(samples[from],from,to),samples[to],`${from} → ${to}`);
 await service.drain();assert.equal(calls.length,42);assert.equal(new Set(calls.map(pair=>pair.join('|'))).size,42);assert.equal(persisted.size,42);
 const reload=createTranslationService({store,fetchImpl:async()=>{throw Error('cached pairs must not call the provider');}});
 for(const from of Object.keys(samples))for(const to of Object.keys(samples))assert.equal(await reload.translate(samples[from],from,to),samples[to]);
 await assert.rejects(service.translateMany([],'de','vi'),{code:'TRANSLATION_INVALID'});
 await assert.rejects(service.translate('Hello','en','de'),{code:'TRANSLATION_INVALID'});
});
test('regional aliases use the same canonical cache entry and one request',async()=>{
 let calls=0;const service=createTranslationService({fetchImpl:async()=>{calls++;return Response.json({responseStatus:200,responseData:{translatedText:'Bonjour'}});}});
 assert.equal(await service.translate('안녕하세요','ko-KR','fr-CA'),'Bonjour');assert.equal(await service.translate('안녕하세요','ko','fr'),'Bonjour');assert.equal(calls,1);
});
test('interface translations are local, parameterized and independent of learner text',()=>{
 for(const code of Object.keys(languages.names)){
  i18n.setLocale(code);assert.ok(i18n.t('Search'));assert.ok(i18n.t('Meanings in'));assert.ok(i18n.t('Swap languages'));
  if(code!=='vi')assert.notEqual(i18n.t('3 ngày liên tiếp'),'3 ngày liên tiếp');
  assert.equal(i18n.t('I has worked in healthcare. Um I I train doctors.'),'I has worked in healthcare. Um I I train doctors.');
 }
 i18n.setLocale('ja');assert.equal(i18n.t('Search'),'検索');assert.equal(i18n.t('2/5 lượt luyện'),'練習 2/5回');
 i18n.setLocale('fr');assert.equal(i18n.t('Meanings in'),'Traduire en');
});

test('structured direct translation routes all 42 pairs to their requested target without unverified memory fallback',async()=>{
 const samples={en:'Good evening.',vi:'Chào buổi tối.',ko:'좋은 저녁입니다.',ja:'こんばんは。','zh-CN':'晚上好。',es:'Buenas noches.',fr:'Bonsoir.'};let calls=0;
 const service=createTranslationService({apiKey:'test-only',fetchImpl:async(url,options)=>{
  assert.ok(!String(url).includes('mymemory'));calls++;const input=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
  const from=Object.keys(languages.english).find(key=>languages.english[key]===input.sourceLanguage),to=Object.keys(languages.english).find(key=>languages.english[key]===input.targetLanguage);
  assert.ok(from && to && from!==to);assert.ok(input.texts.every(item=>item.text===samples[from]));
  return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({translations:input.texts.map(item=>({id:item.id,text:samples[to]}))})}]},finishReason:'STOP'}]});
 }});
 for(const from of Object.keys(samples))for(const to of Object.keys(samples))if(from!==to)assert.equal(await service.translate(samples[from],from,to,{kind:'direct'}),samples[to],`${from}→${to}`);
 assert.equal(calls,42);
});
