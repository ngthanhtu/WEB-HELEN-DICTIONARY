const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createWebSecurity}=require('../lib/web-security');
async function fixture(t){
 const security=createWebSecurity({production:true,random:()=> 'a'.repeat(64)}),app=express();app.disable('x-powered-by');app.set('trust proxy',1);app.set('query parser','simple');
 app.use(security.headers);app.use(express.json());app.post('/api/session',security.session);
 app.get('/api/history',security.history,(req,res)=>res.json({device:req.deviceToken}));
 app.get('/',(req,res)=>res.send(`<script nonce="${res.locals.cspNonce}"></script>`));
 const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base=`http://127.0.0.1:${server.address().port}`;return {base,post:(body={},headers={})=>fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})};
}
test('production migrates the existing history capability to a host-only HttpOnly Secure Strict cookie, without exposing it in JSON',async t=>{
 const f=await fixture(t),legacy='b'.repeat(64),response=await f.post({legacyDevice:legacy}),cookie=response.headers.get('set-cookie');
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{ready:true});
 assert.match(cookie,/^__Host-helen-device=/);for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(cookie.includes(flag));assert.ok(!cookie.includes('Domain='));assert.equal(response.headers.get('cache-control'),'no-store');
 const header=cookie.split(';')[0],history=await fetch(f.base+'/api/history',{headers:{Cookie:header}});assert.equal((await history.json()).device,legacy);
 // Client-readable headers never grant access in production.
 assert.equal((await fetch(f.base+'/api/history',{headers:{'X-Helen-Device':legacy}})).status,401);
 const existing=await f.post({legacyDevice:'c'.repeat(64)},{Cookie:header});assert.ok(existing.headers.get('set-cookie').includes(legacy));
});
test('foreign origins, cross-site fetches and form posts cannot establish sessions or read private history',async t=>{
 const f=await fixture(t);assert.equal((await f.post({}, {Origin:'https://attacker.example'})).status,403);
 assert.equal((await f.post({}, {Origin:'null'})).status,403);
 assert.equal((await f.post({}, {'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await fetch(f.base+'/api/session',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'legacyDevice=value'})).status,415);
 assert.equal((await f.post({legacyDevice:'bad'})).status,400);
 const cookie=(await f.post()).headers.get('set-cookie').split(';')[0];assert.equal((await fetch(f.base+'/api/history',{headers:{Cookie:cookie,'Sec-Fetch-Site':'cross-site'}})).status,403);
});
test('API route casing cannot bypass Origin, Fetch Metadata, JSON or no-store protections',async t=>{
 const f=await fixture(t);
 for(const path of ['/API/session','/Api/SESSION/']){
  const post=headers=>fetch(f.base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'});
  assert.equal((await post({Origin:'https://attacker.example'})).status,403);
  assert.equal((await post({'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await fetch(f.base+path,{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
  const valid=await post({});assert.equal(valid.status,200);assert.equal(valid.headers.get('cache-control'),'no-store');
 }
});
test('nested, repeated and prototype query fields are rejected before route handlers and legacy cookie migration requires a string',async t=>{
 const f=await fixture(t);
 for(const query of ['word[toString]=poison','word[__proto__][admin]=true','word=a&word=b','__proto__=poison','constructor=poison','word[]=a']){
  const r=await fetch(f.base+'/api/history?'+query);assert.equal(r.status,400);assert.equal((await r.json()).code,'REQUEST_QUERY');
 }
 assert.equal((await f.post({legacyDevice:['a'.repeat(64)]})).status,400);
 const cookie=(await f.post()).headers.get('set-cookie').split(';')[0];assert.equal((await fetch(f.base+'/api/history?word=ordinary',{headers:{Cookie:cookie}})).status,200);
 assert.equal({}.admin,undefined);
});
test('HTTPS security headers block embedding and untrusted scripts while retaining same-origin microphone access',async t=>{
 const f=await fixture(t),response=await fetch(f.base,{headers:{'X-Forwarded-Proto':'https'}}),html=await response.text(),csp=response.headers.get('content-security-policy');
 const nonce=html.match(/nonce="([^"]+)"/)[1];assert.ok(csp.includes(`'nonce-${nonce}'`));assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/object-src 'none'/);
 assert.doesNotMatch(csp.split('script-src')[1].split(';')[0],/unsafe-inline|unsafe-eval/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('x-frame-options'),'DENY');assert.equal(response.headers.get('x-powered-by'),null);
 assert.match(response.headers.get('strict-transport-security'),/max-age=31536000/);assert.match(response.headers.get('permissions-policy'),/microphone=\(self\)/);
});
