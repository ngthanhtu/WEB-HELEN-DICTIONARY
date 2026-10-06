// Render's commit replaces this token so each deploy installs a fresh app shell.
const VERSION='helen-__BUILD_VERSION__';
const SHELL=`${VERSION}-shell`, FILES=`${VERSION}-files`, WORDS='helen-words-v1';
const TTL=24*60*60*1000, MAX_WORDS=100, MAX_FILES=40;
const shell=['/','/manifest.webmanifest','/assets/pwa.css','/assets/pwa.js','/assets/hamster.css','/assets/pet-pointer.css','/assets/pet-pointer.js','/assets/icons/icon-180.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(shell)));});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('helen-') && ![SHELL,FILES,WORDS].includes(name))await caches.delete(name);
  await self.clients.claim();
})());});
async function put(cache,request,response,max) {
  try {
    const headers=new Headers(response.headers);headers.set('X-Helen-Saved-At',String(Date.now()));
    await cache.put(request,new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers}));
    const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-max)))await cache.delete(key);
  } catch { /* Storage full must never turn a successful lookup into a failure. */ }
}
async function saved(response) {
  const headers=new Headers(response.headers);headers.set('X-Helen-Cache','saved');
  return new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers});
}
async function word(request) {
  const cache=await caches.open(WORDS), previous=await cache.match(request);
  if(previous && Date.now()-Number(previous.headers.get('X-Helen-Saved-At'))<TTL)return saved(previous);
  try {
    const response=await fetch(request);
    if(response.ok)await put(cache,request,response.clone(),MAX_WORDS);
    // Provider failures and misspellings never replace a successful entry.
    return response;
  } catch {
    if(previous)return saved(previous);
    return new Response(JSON.stringify({error:'Bạn đang ngoại tuyến và từ này chưa được lưu. Kết nối Internet rồi tra lại.'}),{status:503,headers:{'Content-Type':'application/json'}});
  }
}
self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET' || url.origin!==self.location.origin)return;
  if(request.mode==='navigate') {event.respondWith((async()=>{const cache=await caches.open(SHELL);return (await cache.match('/')) || fetch(request);})());return;}
  if(url.pathname==='/api/lookup') {event.respondWith(word(request));return;}
  // Account status, voice lists, audio and AI calls always use the live server.
  if(url.pathname.startsWith('/api/') || url.pathname==='/healthz' || url.pathname==='/assets/appearance.json' || url.pathname==='/sw.js')return;
  if(!url.pathname.startsWith('/assets/') && url.pathname!=='/manifest.webmanifest')return;
  event.respondWith((async()=>{
    const shellCache=await caches.open(SHELL), fileCache=await caches.open(FILES);
    const cached=await shellCache.match(request) || await fileCache.match(request);if(cached)return cached;
    const response=await fetch(request);if(response.ok)await put(fileCache,request,response.clone(),MAX_FILES);return response;
  })());
});
