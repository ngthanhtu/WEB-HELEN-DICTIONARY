// Optional real-browser QA. All translation/AI responses are fixtures, never live generations.
const {chromium}=require(process.env.HELEN_PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),languages=require('../public/assets/languages'),messages=require('../public/assets/ui-messages');
const outputs={en:'hello',vi:'xin chào',ko:'안녕하세요',ja:'こんにちは','zh-CN':'你好',es:'hola',fr:'bonjour'};
const text=(source,locale)=>messages.rows.find(row=>row[0]===source)?.[messages.locales.indexOf(locale)] || source;
(async()=>{
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),NODE_ENV:'development',DATABASE_URL:'',MYSQL_HOST:'',GEMINI_API_KEY:'',ELEVENLABS_API_KEY:'',HELEN_DISABLE_WORDNET:'1'},stdio:['ignore','pipe','pipe']});
 const ready=new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error(`server exited ${code}`)));});server.stdout.resume();server.stderr.resume();let browser;
 try{
  await ready;browser=await chromium.launch({executablePath:process.env.HELEN_CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const results=[];
  for(const locale of ['en-US','vi-VN','ko-KR','ja-JP','zh-TW','es-MX','fr-CA','de-DE']){
   const expected=languages.deviceLocale({language:locale});
   const context=await browser.newContext({viewport:{width:390,height:844},locale,serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/lookup?**',route=>{const url=new URL(route.request().url());return route.fulfill({json:{query:url.searchParams.get('word'),from:url.searchParams.get('from'),word:'hello',entries:[{word:'hello',source:'fixture',meanings:[{pos:'noun',senses:[{definition:'A word used to greet someone.',examples:['She gave us a cheerful hello.'],synonyms:['greeting'],antonyms:[]}]}]}]}});});
   await page.route('**/api/translate',route=>{const body=route.request().postDataJSON();requests.push(body);return route.fulfill({json:{translations:body.texts.map(()=>outputs[body.to])}});});
   await page.goto(`http://127.0.0.1:${port}/`);await page.waitForFunction(()=>Boolean(window.HelenDictionary && window.HelenStudy));
   assert.equal(await page.locator('html').getAttribute('lang'),expected);
   assert.equal(await page.locator('.nav-full').textContent(),text('Dictionary',expected));
   assert.deepEqual(await page.locator('#target option').evaluateAll(options=>options.map(option=>option.value)),Object.keys(languages.names));
   assert.equal(await page.locator('#target').inputValue(),expected);
   await page.evaluate(()=>{document.querySelector('#from').value='fr';const target=document.querySelector('#target');target.value='ja';target.dispatchEvent(new Event('change'));});
   await page.fill('#q','bonjour');await page.locator('#form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#word-translation').textContent.includes('こんにちは'));
   assert.ok(requests.some(request=>request.from==='fr' && request.to==='ja' && request.texts.includes('bonjour')));
   assert.equal(await page.locator('.nav-full').textContent(),text('Dictionary',expected),'translation selection must not change interface language');
   await page.locator('#swap-languages').click();await page.waitForFunction(()=>document.querySelector('#word-translation').textContent.includes('bonjour'));
   assert.equal(await page.locator('#from').inputValue(),'ja');assert.equal(await page.locator('#target').inputValue(),'fr');
   assert.ok(requests.some(request=>request.from==='ja' && request.to==='fr' && request.texts.includes('こんにちは')));
   await page.reload();await page.waitForFunction(()=>Boolean(window.HelenDictionary));assert.equal(await page.locator('#target').inputValue(),'fr');assert.equal(await page.locator('html').getAttribute('lang'),expected);
   for(const pageName of ['topics','study','practical-ai','words','history','offline']){
    await page.locator(`.main-nav a[href="/${pageName}"]`).click();
    await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${locale}/${pageName} overflows`);
   }
   if(locale==='ja-JP')await page.screenshot({path:'/tmp/helen-japanese-mobile.png',fullPage:true});
   assert.deepEqual(errors,[],locale);results.push({locale,interface:expected,directions:'fr→ja→fr',overflow:false});await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'fr-CA',serviceWorkers:'allow'}),page=await context.newPage();
  if(process.env.HELEN_AXE_PATH)await context.addInitScript({path:process.env.HELEN_AXE_PATH});
  await page.goto(`http://127.0.0.1:${port}/study`);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.evaluate(()=>{document.querySelector('#target').value='ko';document.querySelector('#target').dispatchEvent(new Event('change'));localStorage.setItem('helen-favorites',JSON.stringify(['loan']));});
  await context.setOffline(true);await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'fr');assert.equal(await page.locator('#target').inputValue(),'ko');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('helen-favorites'))[0]),'loan');
  const axePath=process.env.HELEN_AXE_PATH;if(axePath){const report=await page.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return result.violations.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));});assert.deepEqual(report,[]);}
  await context.close();console.log(JSON.stringify({mobile:results,desktopOffline:{interface:'fr',translation:'ko',savedWord:'loan',axe:axePath?'passed':'not run'}},null,2));
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
