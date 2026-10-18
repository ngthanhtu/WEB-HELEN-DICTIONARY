// Optional browser regression: no real generations or paid API requests.
const {chromium}=require(process.env.HELEN_PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('node:child_process'),net=require('node:net'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const answer='I work in a small technology company where I help customers solve problems with their online accounts. Last year our team introduced a new training programme, and I helped explain the changes to several colleagues. At first I found it difficult to speak confidently in meetings, but I started preparing short notes and asking more questions. This helped me express my ideas more clearly. In the future I would like to lead a project because I enjoy working with different people and finding practical solutions together.';
(async()=>{
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),NODE_ENV:'development',DATABASE_URL:'',MYSQL_HOST:'',GEMINI_API_KEY:'',ELEVENLABS_API_KEY:'',HELEN_DISABLE_WORDNET:'1'},stdio:['ignore','pipe','pipe']});
 let browser;try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error(`server exited ${code}`)));});server.stdout.resume();server.stderr.resume();
  browser=await chromium.launch({executablePath:process.env.HELEN_CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const width of [320,390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',serviceWorkers:'allow'});
   if(process.env.HELEN_AXE_PATH)await context.addInitScript({path:process.env.HELEN_AXE_PATH});
   await context.addInitScript(()=>localStorage.setItem('helen-practical-autoplay-v1','0'));
   const page=await context.newPage(),faults=[],ids=[];let mode={code:'USAGE_LIMIT',scope:'shared'},assessments=0;
   page.on('pageerror',error=>faults.push(error.message));
   await page.route('**/api/practical/status',route=>route.fulfill({json:{configured:true,dailyReplyLimit:100,dailyAssessmentLimit:10,pronunciation:[]}}));
   await page.route('**/api/practical',route=>{
    const body=route.request().postDataJSON();
    if(body.stage!=='assess')return route.fulfill({json:{transcript:body.text,reply:'What did you learn from that experience?',translation:'Bạn học được gì từ trải nghiệm đó?',improved:body.text,feedback:'Thêm một ví dụ cụ thể.',phrase:{text:'gain experience',translation:'tích lũy kinh nghiệm'},corrections:[],collocations:[]}});
    assessments++;ids.push(body.requestId);
    if(mode)return route.fulfill({status:mode.code==='USAGE_LIMIT' || mode.code==='PRACTICAL_QUOTA' || mode.code==='REQUEST_RATE_LIMIT'?429:503,json:{error:'PRIVATE_PROVIDER_DETAIL',...mode,...(mode.code==='USAGE_LIMIT'?{resetAt:new Date(Date.now()+86400000).toISOString()}:{})}});
    return route.fulfill({json:{stage:'assess',estimated:true,overall:null,summary:'Bạn trình bày ý rõ ràng.',notice:'Chỉ đánh giá các tiêu chí có đủ dữ liệu.',criteria:Object.fromEntries(['fluency','vocabulary','grammar','pronunciation'].map(key=>[key,{band:['fluency','pronunciation'].includes(key)?null:6,feedback:'Thử phát triển một ví dụ.',quote:'I work in a small technology company'}])),nextSteps:['Luyện trả lời với một ví dụ.'],coverage:{turns:1,words:answer.split(/\s+/).length,audioSeconds:0,allSpoken:false}}});
   });
   await page.goto(`http://127.0.0.1:${port}/practical-ai`);await page.waitForFunction(()=>window.HelenPracticalCore && window.HelenDictionary);
   await page.fill('#practical-input',answer);await page.locator('#practical-send').click();await page.waitForFunction(()=>document.querySelectorAll('.practical-message.user').length===1 && !document.getElementById('practical-end').disabled);
   for(const [code,scope,expected] of [['USAGE_LIMIT','shared','chung của website'],['USAGE_LIMIT','device','Thiết bị này'],['USAGE_LIMIT','network','Mạng này'],['PRACTICAL_MODEL',undefined,'Model AI'],['PRACTICAL_AUTH',undefined,'cấp quyền'],['PRACTICAL_QUOTA',undefined,'Nhà cung cấp'],['PRACTICAL_BUSY',undefined,'quá tải'],['USAGE_UNAVAILABLE',undefined,'Bộ kiểm soát'],['REQUEST_RATE_LIMIT',undefined,'một phút']]){
    mode={code,...(scope?{scope}:{})};await page.locator('#practical-end').click();await page.waitForFunction(()=>document.getElementById('practical-status').classList.contains('error') && !document.getElementById('practical-end').disabled);
    const text=await page.locator('#practical-status').textContent();assert.ok(text.includes(expected),text);assert.ok(!text.includes('PRIVATE'));assert.equal(await page.locator('.practical-message.user').count(),1);assert.equal(await page.locator('#practical-report').isVisible(),false);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('helen-practical-session-v1')).turns[0].text),answer);
   }
   assert.equal(new Set(ids).size,1,'retrying the same assessment preserves its request ID');
   mode=null;await page.locator('#practical-end').click();await page.waitForFunction(()=>!document.getElementById('practical-report').hidden);assert.equal(await page.locator('#practical-report .practical-score-grid article').count(),4);
   for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.HELEN_AXE_PATH){const violations=await page.evaluate(async()=>{const r=await axe.run(document.getElementById('page-practical'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));});assert.deepEqual(violations,[]);}
   }
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);const before=assessments;
   await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!document.getElementById('practical-report').hidden);assert.equal(assessments,before);assert.equal(await page.locator('.practical-message.user').count(),1);assert.deepEqual(faults,[]);
   console.log(JSON.stringify({width,distinctErrors:9,retryIdentity:true,conversationKept:true,reportSavedOffline:true,overflow:false,axe:process.env.HELEN_AXE_PATH?'passed':'not run'}));await context.close();
  }
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
