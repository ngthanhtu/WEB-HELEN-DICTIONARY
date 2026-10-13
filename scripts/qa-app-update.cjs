const {chromium}=require(process.env.HELEN_PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('node:child_process'),http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
const cwd=path.resolve(__dirname,'..'),output=process.env.HELEN_QA_OUTPUT || path.join(os.tmpdir(),'helen-app-update-qa');fs.mkdirSync(output,{recursive:true});
const builds=['aaa111aaa111','bbb222bbb222'];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 let browser,proxy;const servers=[];let chosen=0;const ports=[];
 try{
  for(const [index,build] of builds.entries()){
   const slot=http.createServer();await new Promise(resolve=>slot.listen(0,'127.0.0.1',resolve));ports.push(slot.address().port);await new Promise(resolve=>slot.close(resolve));
   const server=spawn(process.execPath,['--require',cwd+'/tests/mock-upstream.cjs','server.js'],{cwd,env:{...process.env,PORT:String(ports[index]),NODE_ENV:'development',RENDER_GIT_COMMIT:build,DATABASE_URL:'',MYSQL_HOST:'',HELEN_DISABLE_WORDNET:'1',GEMINI_API_KEY:'',ELEVENLABS_API_KEY:''},stdio:['ignore','pipe','pipe']});server.stdout.resume();server.stderr.resume();servers.push(server);
   for(let j=0;j<100;j++){try{if((await fetch(`http://127.0.0.1:${ports[index]}/healthz`)).ok)break;}catch{}await pause(50);}
  }
  proxy=http.createServer((req,res)=>{const upstream=http.request({hostname:'127.0.0.1',port:ports[chosen],path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.on('error',()=>{res.writeHead(503);res.end();});req.pipe(upstream);});await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${proxy.address().port}`;
  browser=await chromium.launch({executablePath:process.env.HELEN_CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox']});const results=[];
  for(const width of [390,1440]){
   chosen=0;const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'allow',isMobile:width===390,hasTouch:width===390});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/practical-ai');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller && window.HelenAppUpdate);
   await page.waitForTimeout(1100);assert.equal(await page.locator('#app-update-dialog').evaluate(el=>el.open),false,'first-time visit should already be current');
   await page.evaluate(async()=>{
    localStorage.setItem('helen-favorites',JSON.stringify(['loan','happy','brotherhood']));localStorage.setItem('helen-voice','SavedVoice');localStorage.setItem('helen-update-test-sentinel','saved learning data');
    const cache=await caches.open('helen-audio-v1');await cache.put('/__helen_audio__?text=loan&voice=SavedVoice',new Response('saved audio'));
   });
   const draft='I would like to discuss my experience in healthcare.';await page.locator('#practical-input').fill(draft);
   const second=await context.newPage();await second.goto(origin+'/words');await second.evaluate(()=>navigator.serviceWorker.ready);await second.waitForFunction(()=>window.HelenAppUpdate);
   chosen=1;await page.evaluate(()=>window.HelenAppUpdate.check(true));await page.waitForFunction(()=>document.getElementById('app-update-dialog').open);
   if(width===1440){
    // Re-enter with an unconfirmed update: the notice must open on entry,
    // before any Update app click or pointer-controller initialization.
    await page.reload();await page.waitForFunction(()=>document.getElementById('app-update-dialog').open);
    assert.equal(await page.locator('#pet-cursor').evaluate(el=>el.parentElement.id),'app-update-dialog');
    assert.equal(await page.locator('#pet-cursor').evaluate(el=>el.inert),false);
   }
   assert.equal(await page.evaluate(()=>document.activeElement.id),'confirm-app-update');await page.keyboard.press('Escape');assert.equal(await page.locator('#app-update-dialog').evaluate(el=>el.open),true);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.getElementById('app-update-dialog').contains(document.activeElement)),true);
   assert.equal(await page.locator('#practical-input').evaluate(el=>el.closest('main').inert),true);
   if(width===1440){
    await page.waitForFunction(()=>!document.getElementById('pet-control').hidden);
    const box=await page.locator('#confirm-app-update').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.waitForFunction(()=>!document.getElementById('pet-cursor').hidden);
    assert.equal(await page.locator('#pet-cursor').evaluate(el=>el.parentElement.id),'app-update-dialog');
    assert.equal(await page.locator('#pet-cursor').evaluate(el=>el.inert),false);
    assert.equal(await page.locator('#pet-cursor').evaluate(el=>Math.round(el.getBoundingClientRect().width)),width);
    const picture=await page.locator('#pet-cursor img').getAttribute('src');
    const heading=await page.locator('#app-update-title').boundingBox();await page.mouse.move(heading.x+10,heading.y+10);await page.mouse.down();
    assert.notEqual(await page.locator('#pet-cursor img').getAttribute('src'),picture);await page.mouse.up();
    await page.mouse.move(100,100);await page.waitForTimeout(100);
    assert.equal(await page.locator('#pet-cursor').evaluate(el=>el.hidden || el.inert),false);
    assert.equal(await page.locator('#pet-cursor img').evaluate(el=>Math.round(el.getBoundingClientRect().x)),105);
    await page.screenshot({path:path.join(output,'helen-cursor-entry-backdrop.png')});
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
   }
   await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return Boolean(r.waiting);},{},{timeout:20000});
   assert.equal(await page.evaluate(()=>localStorage.getItem('helen-app-build-v1')),builds[0]);
   await context.setOffline(true);await page.waitForFunction(()=>document.getElementById('confirm-app-update').disabled);assert.match(await page.locator('#app-update-status').textContent(),/Internet|mạng/);await context.setOffline(false);
   await page.waitForFunction(()=>!document.getElementById('confirm-app-update').disabled);
   await page.route('**/api/app-version',route=>route.fulfill({status:503,body:'temporary failure'}));await page.locator('#confirm-app-update').click();await page.waitForFunction(()=>document.getElementById('app-update-status').classList.contains('error'));
   assert.equal(await page.locator('#app-update-dialog').evaluate(el=>el.open),true);assert.equal(await page.evaluate(()=>localStorage.getItem('helen-app-build-v1')),builds[0]);await page.unroute('**/api/app-version');
   await page.evaluate(()=>{window.__originalUpdate=ServiceWorkerRegistration.prototype.update;window.__originalTimeout=window.setTimeout;ServiceWorkerRegistration.prototype.update=()=>new Promise(()=>{});window.setTimeout=(fn,ms,...args)=>window.__originalTimeout(fn,ms===20000?200:ms,...args);});
   await page.locator('#confirm-app-update').click();await page.waitForFunction(()=>document.getElementById('app-update-status').classList.contains('error') && !document.getElementById('confirm-app-update').disabled);
   assert.equal(await page.evaluate(()=>localStorage.getItem('helen-app-build-v1')),builds[0]);await page.evaluate(()=>{ServiceWorkerRegistration.prototype.update=window.__originalUpdate;window.setTimeout=window.__originalTimeout;});
   const axe=fs.readFileSync(process.env.HELEN_AXE_PATH || require.resolve('axe-core/axe.min.js'),'utf8');await page.evaluate(source=>{const script=document.createElement('script');script.nonce=document.querySelector('script[nonce]').nonce;script.textContent=source;document.head.append(script);},axe);
   for(const dark of [false,true]){
    await page.evaluate(d=>document.documentElement.dataset.theme=d?'dark':'light',dark);await page.waitForTimeout(350);
    const violations=await page.evaluate(async()=>{const r=await axe.run(document.getElementById('app-update-dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});if(violations.length)console.log(JSON.stringify({dark,violations,colors:await page.locator('#confirm-app-update').evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,background:s.backgroundColor,opacity:s.opacity};})}));assert.deepEqual(violations,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   await page.screenshot({path:path.join(output,`helen-app-update-${width}.png`)});
   await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('#confirm-app-update').click()]);await page.waitForFunction(expected=>document.documentElement.dataset.build===expected,builds[1],{timeout:30000});await page.waitForFunction(()=>window.HelenAppUpdate && navigator.serviceWorker.controller);
   assert.equal(await page.locator('#app-update-dialog').evaluate(el=>el.open),false);
   assert.equal(await page.evaluate(()=>localStorage.getItem('helen-update-test-sentinel')),'saved learning data');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('helen-favorites'))),['loan','happy','brotherhood']);
   assert.equal(await page.locator('#practical-input').inputValue(),draft);assert.equal(await page.evaluate(()=>localStorage.getItem('helen-voice')),'SavedVoice');
   assert.equal(await page.evaluate(async()=>await(await(await caches.open('helen-audio-v1')).match('/__helen_audio__?text=loan&voice=SavedVoice')).text()),'saved audio');
   await second.waitForFunction(()=>document.getElementById('app-update-dialog').open);assert.equal(await second.evaluate(()=>document.documentElement.dataset.build),builds[0]);await second.locator('#confirm-app-update').click();await second.waitForFunction(expected=>document.documentElement.dataset.build===expected,builds[1]);
   await page.reload();await page.waitForFunction(()=>window.HelenAppUpdate);await page.waitForTimeout(1200);assert.equal(await page.locator('#app-update-dialog').evaluate(el=>el.open),false);
   await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.HelenAppUpdate);assert.equal(await page.locator('#app-update-dialog').evaluate(el=>el.open),false);assert.equal(await page.locator('#practical-input').inputValue(),draft);await context.setOffline(false);
   assert.deepEqual(errors,[]);results.push({width,firstVisitNoFalsePrompt:true,requiredOnNewVersion:true,escapeCannotDismiss:true,backgroundInert:true,cursorAboveUpdate:width===1440,cursorClickPicture:width===1440,failedUpdateRetry:true,stalledUpdateBounded:true,offlineErrorReadable:true,userActivationRequired:true,secondTabAlsoConfirms:true,learningAndDraftPreserved:true,updateOnlyOnce:true,updatedOfflineReload:true,axeViolations:0});console.log(JSON.stringify(results.at(-1)));await context.close();
  }
  chosen=0;const legacyContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),legacy=await legacyContext.newPage();
  await legacy.goto(origin+'/words');await legacy.evaluate(()=>navigator.serviceWorker.ready);await legacy.waitForFunction(()=>navigator.serviceWorker.controller && window.HelenAppUpdate);await legacy.waitForTimeout(1200);
  await legacy.evaluate(()=>localStorage.removeItem('helen-app-build-v1'));chosen=1;await legacy.reload();await legacy.waitForFunction(()=>document.getElementById('app-update-dialog').open);await legacy.locator('#confirm-app-update').click();
  await legacy.waitForFunction(expected=>document.documentElement.dataset.build===expected && localStorage.getItem('helen-app-build-v1')===expected,builds[1]);await legacy.waitForFunction(()=>window.HelenAppUpdate);assert.equal(await legacy.locator('#app-update-dialog').evaluate(el=>el.open),false);await legacyContext.close();
  chosen=0;const plainContext=await browser.newContext({serviceWorkers:'block'}),plain=await plainContext.newPage();await plain.goto(origin+'/study');await plain.waitForFunction(()=>window.HelenAppUpdate);await plain.waitForTimeout(500);chosen=1;await plain.reload();
  await plain.waitForFunction(()=>document.getElementById('app-update-dialog').open);await plain.locator('#confirm-app-update').click();await plain.waitForFunction(expected=>localStorage.getItem('helen-app-build-v1')===expected && !document.getElementById('app-update-dialog').open,builds[1]);await plainContext.close();
  results.push({legacyCacheMigration:true,plainWebWithoutServiceWorker:true});console.log(JSON.stringify(results.at(-1)));
  fs.writeFileSync(path.join(output,'helen-app-update-browser-qa.json'),JSON.stringify(results,null,2));
 }finally{await browser?.close();if(proxy)await new Promise(resolve=>proxy.close(resolve));for(const server of servers)server.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1;});
