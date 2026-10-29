// Optional browser QA: real topic packs, fixture providers, no paid generations.
const {chromium}=require(process.env.HELEN_PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),languages=require('../../public/assets/languages'),pack=require('../../public/assets/topics/v2/travel.json');
const sample=pack.entries.find(entry=>entry.word==='responsible travel');
const translated={vi:sample.definitionVi,fr:'Voyager en respectant les personnes et l’environnement.',es:'Viajar teniendo en cuenta a las personas y el medio ambiente.',ko:'사람과 환경을 배려하며 여행하는 것.',ja:'人々や環境に配慮して旅行すること。','zh-CN':'旅行时顾及他人与环境。'};
(async()=>{
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),NODE_ENV:'development',DATABASE_URL:'',MYSQL_HOST:'',GEMINI_API_KEY:'',ELEVENLABS_API_KEY:'',HELEN_DISABLE_WORDNET:'1'},stdio:['ignore','pipe','pipe']});
 let browser;try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error(`server exited ${code}`)));});server.stdout.resume();server.stderr.resume();
  browser=await chromium.launch({executablePath:process.env.HELEN_CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},locale:'vi-VN',serviceWorkers:'allow'});
   if(process.env.HELEN_AXE_PATH)await context.addInitScript({path:process.env.HELEN_AXE_PATH});
   await context.addInitScript(()=>{localStorage.setItem('helen-from','vi');localStorage.setItem('helen-target','en');localStorage.setItem('helen-topic-audio-mode-v1','device');});
   const page=await context.newPage(),calls=[],errors=[];let holdFrench=false,releaseFrench,failKorean=false;
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/translate',async route=>{
    const body=route.request().postDataJSON();calls.push(body);
    if(failKorean && body.to==='ko')return route.fulfill({status:503,json:{error:'Dịch nghĩa đang chậm. Hãy thử lại.',code:'TRANSLATION_TIMEOUT'}});
    if(holdFrench && body.to==='fr')await new Promise(resolve=>{releaseFrench=resolve;});
    try{await route.fulfill({json:{translations:body.texts.map(()=>translated[body.to] || sample.definition)}});}catch{}
   });
   await page.route('**/api/pronunciation**',route=>route.fulfill({json:{pronunciation:[]}}));
   await page.goto(`http://127.0.0.1:${port}/topics`);await page.locator('[data-topic="travel"]').click();
   await page.fill('#topic-word-filter','responsible travel');
   const article=()=>page.locator('.topic-word').filter({has:page.locator('[data-translate="responsible travel"]')});
   assert.equal(await page.locator('#topic-target').inputValue(),'vi');assert.equal(await page.locator('#target').inputValue(),'en');
   assert.deepEqual(await page.locator('#topic-target option').evaluateAll(options=>options.map(option=>option.value)),Object.keys(languages.names));
   const first=Date.now();await article().locator('.eye').click();assert.equal(await article().locator('.topic-translation').textContent(),sample.definitionVi);assert.ok(Date.now()-first<1000);assert.equal(calls.length,0);
   for(const word of ['promote responsible travel','encourage responsible travel','practise responsible travel']){
    const entry=pack.entries.find(value=>value.word===word);if(!entry)continue;
    const card=page.locator('.topic-word').filter({has:page.locator(`[data-translate="${word}"]`)});await card.locator('.eye').click();assert.equal(await card.locator('.topic-translation').textContent(),entry.definitionVi);
   }
   await page.selectOption('#topic-target','en');await article().locator('.eye').click();assert.ok((await article().locator('.topic-translation').textContent()).includes('Định nghĩa đã là tiếng Anh'));assert.equal(calls.length,0);
   for(const to of ['fr','es','ko','ja','zh-CN']){
    await page.selectOption('#topic-target',to);await article().locator('.eye').click();await page.waitForFunction(({text})=>[...document.querySelectorAll('.topic-translation')].some(p=>!p.hidden && p.textContent===text),{text:translated[to]});
    assert.equal(await article().locator('.topic-translation').getAttribute('lang'),to);assert.equal(await page.locator('#target').inputValue(),'en');
   }
   assert.ok(calls.every(body=>body.from==='en' && body.to!=='en'));
   // A pending response for an old language cannot replace a new selection.
   await page.selectOption('#topic-target','vi');await page.fill('#topic-word-filter','encourage cultural immersion');holdFrench=true;await page.selectOption('#topic-target','fr');
   await page.locator('[data-translate="encourage cultural immersion"]').click();for(let i=0;!releaseFrench && i<250;i++)await page.waitForTimeout(20);assert.equal(typeof releaseFrench,'function');
   await page.selectOption('#topic-target','ja');await page.locator('[data-translate="encourage cultural immersion"]').click();await page.waitForFunction(text=>document.querySelector('.topic-translation').textContent===text,translated.ja);
   holdFrench=false;releaseFrench();await page.waitForTimeout(150);assert.equal(await page.locator('.topic-translation').textContent(),translated.ja);
   failKorean=true;await page.selectOption('#topic-target','ko');await page.locator('[data-translate="encourage cultural immersion"]').click();await page.waitForFunction(()=>document.querySelector('.topic-translation').textContent.includes('chậm') && !document.querySelector('[data-translate]').disabled);
   failKorean=false;await page.locator('[data-translate="encourage cultural immersion"]').click();await page.waitForFunction(text=>document.querySelector('.topic-translation').textContent===text,translated.ko);
   await page.selectOption('#topic-target','fr');await page.fill('#topic-word-filter','responsible travel');await article().locator('.eye').click();await page.waitForFunction(text=>[...document.querySelectorAll('.topic-translation')].some(p=>!p.hidden && p.textContent===text),translated.fr);
   const previous=calls.filter(body=>body.texts.includes(sample.definition) && body.to==='fr').length;
   await page.reload();await page.locator('[data-topic="travel"]').click();await page.fill('#topic-word-filter','responsible travel');assert.equal(await page.locator('#topic-target').inputValue(),'fr');await article().locator('.eye').click();assert.equal(await article().locator('.topic-translation').textContent(),translated.fr);assert.equal(calls.filter(body=>body.texts.includes(sample.definition) && body.to==='fr').length,previous);
   // Topic quiz feedback keeps its chosen language even with Dictionary vi→en.
   await page.locator('#practice-topic').click();await page.selectOption('#quiz-mode','choice');await page.locator('#start-quiz').click();await page.locator('.quiz-options [data-choice]').first().click();
   await page.waitForFunction(()=>document.querySelector('#quiz-translation')?.textContent.includes('Français'));assert.equal(await page.locator('#target').inputValue(),'en');assert.ok((await page.locator('#quiz-translation').textContent()).includes(translated.fr));
   await page.locator('#end-study').click();await page.locator('.main-nav a[href="/topics"]').click();await page.selectOption('#topic-target','vi');
   await page.evaluate(()=>{document.querySelector('#from').value='fr';document.querySelector('#target').value='ja';});
   await page.locator('.main-nav a[href="/"]').click();await page.locator('#swap-languages').click();assert.equal(await page.locator('#from').inputValue(),'ja');assert.equal(await page.locator('#target').inputValue(),'fr');assert.equal(await page.locator('#topic-target').inputValue(),'vi');
   await page.locator('.main-nav a[href="/topics"]').click();
   for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.HELEN_AXE_PATH){const violations=await page.evaluate(async()=>{const r=await axe.run(document.getElementById('page-topics'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[]);}
   }
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.locator('#download-topic').click();
   await page.waitForFunction(async()=>Boolean(await (await caches.open('helen-topic-packs-v1')).match('/assets/topics/v2/travel.json')));
   await context.setOffline(true);await page.reload();await page.locator('[data-topic="travel"]').click();await page.fill('#topic-word-filter','responsible travel');await article().locator('.eye').click();assert.equal(await article().locator('.topic-translation').textContent(),sample.definitionVi);assert.equal(await page.locator('#topic-target').inputValue(),'vi');assert.deepEqual(errors,[]);
   console.log(JSON.stringify({width,oldDictionaryEnglishTargetRecovered:true,vietnameseLocal:true,sevenLanguageChoices:true,otherTargets:5,lateResponseIgnored:true,oneClickErrorRetry:true,cachedReload:true,topicQuizLanguage:true,dictionarySwapPreserved:true,offlineVietnamese:true,axe:process.env.HELEN_AXE_PATH?'passed':'not run'}));await context.close();
  }
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
