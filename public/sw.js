// Render's commit replaces this token so each deploy installs a fresh app shell.
const BUILD='__BUILD_VERSION__',VERSION=`helen-${BUILD}`;
const SHELL=`${VERSION}-shell`, FILES=`${VERSION}-files`, WORDS='helen-words-v1';
const TTL=24*60*60*1000, MAX_WORDS=100, MAX_FILES=40;
const SAVED_WAIT=2400, NETWORK_WAIT=6500;
const LEXICAL_REVISION=2;
const shell=['/','/manifest.webmanifest','/assets/pwa.css','/assets/pwa.js','/assets/study.css','/assets/study-core.js','/assets/study.js','/assets/sense-core.js','/assets/voice-recorder.js','/assets/history-sync.js','/assets/autocomplete.js','/assets/appearance.json','/assets/hamster.css','/assets/pet-pointer.css','/assets/pet-pointer.js','/assets/icons/icon-180.png','/assets/icons/icon-192.png','/assets/icons/icon-512.png',
  '/assets/mobile/background.webp','/assets/mobile/lookup.webp','/assets/mobile/hero.webp','/assets/mobile/dog-idle.webp','/assets/mobile/dog-pressed.webp'].map(url=>/\.(css|js)$/.test(url)?`${url}?v=${BUILD}`:url);
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(shell)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('helen-') && ![SHELL,FILES,WORDS].includes(name))await caches.delete(name);
  await normalizeWords();await self.clients.claim();
})());});
function lookupKey(input) {
  const url=new URL(typeof input==='string'?input:input.url,self.location.origin);
  if(url.origin!==self.location.origin || url.pathname!=='/api/lookup')return null;
  const word=(url.searchParams.get('word') || '').trim().toLowerCase(), from=url.searchParams.get('from') || 'en';
  if(!word || word.length>100 || !/^[a-zA-Z-]{2,10}$/.test(from))return null;
  return `${self.location.origin}/api/lookup?${new URLSearchParams({word,from})}`;
}
function validEntry(data) {
  return data && typeof data.word==='string' && data.word.trim() && data.word.length<=100 && Array.isArray(data.entries) && data.entries.length>0 && data.entries.every(entry=>Array.isArray(entry.meanings) && entry.meanings.some(meaning=>Array.isArray(meaning.senses) && meaning.senses.some(sense=>typeof sense.definition==='string' && sense.definition.trim())));
}
async function put(cache,request,response,max) {
  try {
    const headers=new Headers(response.headers);headers.set('X-Helen-Saved-At',String(Date.now()));
    await cache.put(request,new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers}));
    const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-max)))await cache.delete(key);
    return true;
  } catch { return false; /* Storage full must never turn a successful lookup into a failure. */ }
}
async function saveWord(cache,key,response) {
  try {
    if(!key || !response.ok)return false;
    const text=await response.clone().text();if(text.length>500000)return false;
    const data=JSON.parse(text);if(!validEntry(data))return false;
    const previous=await cache.match(key), previousData=previous && await previous.clone().json().catch(()=>null);
    // A fast, partial response must not overwrite the complete version saved later.
    if((data.enriching || data.offlinePartial) && previousData && !previousData.enriching && !previousData.offlinePartial)return true;
    return await put(cache,key,new Response(text,{headers:{'Content-Type':'application/json'}}),MAX_WORDS);
  } catch {return false;}
}
async function normalizeWords() {
  const cache=await caches.open(WORDS);
  for(const request of await cache.keys()) {
    const key=lookupKey(request);if(!key) {await cache.delete(request);continue;}
    const original=typeof request==='string'?request:request.url;
    if(key===original)continue;
    const response=await cache.match(request);if(response)await saveWord(cache,key,response);await cache.delete(request);
  }
}
async function saved(response) {
  const headers=new Headers(response.headers);headers.set('X-Helen-Cache','saved');
  const data=await response.json();data.savedOnDevice=true;
  // Do not leave a never-ending enrichment spinner on a saved partial entry.
  data.offlinePartial=Boolean(data.enriching || data.offlinePartial);data.enriching=false;
  if(data.offlinePartial)for(const entry of data.entries || []) {
    for(const meaning of entry.meanings || [])meaning.relationsPending=false;
    if(!entry.collocations || entry.collocations.pending)entry.collocations={...(entry.collocations || {teaching:[],corpus:[]}),pending:false,unavailable:true};
  }
  return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
}
const unavailable=message=>new Response(JSON.stringify({error:message}),{status:503,headers:{'Content-Type':'application/json'}});
async function word(request,event) {
  const cache=await caches.open(WORDS), key=lookupKey(request), previous=key && await cache.match(key);
  const previousData=previous && await previous.clone().json().catch(()=>null);
  const details=new URL(request.url).searchParams.get('details')==='1';
  if(previous && (previousData?.offlinePack || previousData?.lexicalRevision===LEXICAL_REVISION && previousData?.collocationRevision===2) && !previousData?.entries?.some(entry=>entry.collocations?.unavailable) && Date.now()-Number(previous.headers.get('X-Helen-Saved-At'))<TTL && (!details || !previousData?.enriching))return saved(previous);
  const controller=new AbortController();let timer;
  const network=(async()=>{
    const response=await fetch(request,{signal:controller.signal});
    if(response.ok)await saveWord(cache,key,response.clone());
    return response;
  })();
  // A saved entry opens quickly on a weak connection while its refresh can finish in the background.
  if(previous && event?.waitUntil)event.waitUntil(network.catch(()=>{}));
  try {
    const response=await Promise.race([network,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),previous?SAVED_WAIT:NETWORK_WAIT);})]);
    if(!response) {
      if(previous)return saved(previous);
      controller.abort();return unavailable('Kết nối chậm. Hãy thử lại; từ đã lưu vẫn mở được ngoại tuyến.');
    }
    if(!response.ok && previous)return saved(previous);
    return response;
  } catch {
    if(previous)return saved(previous);
    return unavailable('Chưa có từ này trên thiết bị. Kết nối Internet rồi tra lại.');
  } finally {clearTimeout(timer);}
}
async function offlineInventory() {
  const cache=await caches.open(WORDS), words=[];
  for(const request of await cache.keys()) {
    try {
      const response=await cache.match(request), data=await response.json();if(!validEntry(data))continue;
      const url=new URL(typeof request==='string'?request:request.url,self.location.origin);
      words.push({word:data.word,query:url.searchParams.get('word'),from:url.searchParams.get('from') || 'en',partial:Boolean(data.enriching),at:Number(response.headers.get('X-Helen-Saved-At')) || 0});
    } catch {}
  }
  return words.sort((a,b)=>b.at-a.at).slice(0,MAX_WORDS);
}
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE') {self.skipWaiting();return;}
  if(event.data?.type==='OFFLINE_WORDS') {event.waitUntil(offlineInventory().then(words=>event.ports?.[0]?.postMessage({words})));return;}
  if(event.data?.type==='SAVE_OFFLINE_PACK') {
    event.waitUntil((async()=>{
      const pack=event.data.pack;
      if(!pack || pack.version!==1 || !Array.isArray(pack.entries) || pack.entries.length>100 || JSON.stringify(pack).length>750000)return;
      const cache=await caches.open(WORDS);let added=0, skipped=0;
      for(const item of pack.entries) {
        if(typeof item?.word!=='string' || typeof item.gloss!=='string' || item.gloss.length>1000 || !validEntry(item.result))continue;
        const key=lookupKey(`${self.location.origin}/api/lookup?word=${encodeURIComponent(item.word)}&from=en`);
        // Optional starter words never evict previously saved personal lookups.
        if(!key || await cache.match(key) || (await cache.keys()).length>=MAX_WORDS) {skipped++;continue;}
        const data={...item.result,query:item.word,from:'en',enriching:false,offlineGloss:item.gloss,offlinePack:true};
        if(await saveWord(cache,key,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})))added++;
      }
      event.ports?.[0]?.postMessage({added,skipped});
    })());return;
  }
  if(event.data?.type!=='SAVE_LOOKUP')return;
  event.waitUntil((async()=>{
    const key=lookupKey(event.data.url), data=event.data.result;
    const source=event.source?.url;if(source && new URL(source).origin!==self.location.origin)return;
    const text=JSON.stringify(data);if(!key || text.length>500000 || !validEntry(data) || data.savedOnDevice) {event.ports?.[0]?.postMessage({saved:false});return;}
    const cache=await caches.open(WORDS), success=await saveWord(cache,key,new Response(text,{headers:{'Content-Type':'application/json'}}));
    // A translated query also supplies the English entry without another API request.
    if(success && data.word && (new URL(key).searchParams.get('from')!=='en' || new URL(key).searchParams.get('word')!==data.word.toLowerCase()))await saveWord(cache,lookupKey(`${self.location.origin}/api/lookup?word=${encodeURIComponent(data.word)}&from=en`),new Response(JSON.stringify({...data,query:data.word,from:'en'}),{headers:{'Content-Type':'application/json'}}));
    event.ports?.[0]?.postMessage({saved:success});
  })());
});
async function appPage(request,event){
  const cache=await caches.open(SHELL),previous=await cache.match('/');let timer;
  const controller=new AbortController();
  const network=(async()=>{
    const response=await fetch(request,{cache:'no-cache',signal:controller.signal});
    // Keep the installed offline HTML paired with its own cached scripts/styles.
    // A newer build is served online and installs its complete offline shell separately.
    if(response.ok && response.headers.get('Content-Type')?.includes('text/html') && response.headers.get('X-Helen-Build')===BUILD)await cache.put('/',response.clone());
    return response;
  })();
  if(previous && event.waitUntil)event.waitUntil(network.catch(()=>{}));
  try{
    const response=await Promise.race([network,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),previous?2200:6500);})]);
    if(response?.ok)return response;
    if(previous)return previous;
    controller.abort();return response || new Response('Kết nối chậm. Hãy tải lại trang.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }catch{if(previous)return previous;return new Response('Chưa kết nối được. Hãy thử lại khi có mạng.',{status:503});}
  finally{clearTimeout(timer);}
}
self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET' || url.origin!==self.location.origin)return;
  if(request.mode==='navigate' && url.pathname==='/') {event.respondWith(appPage(request,event));return;}
  if(url.pathname==='/api/lookup') {event.respondWith(word(request,event));return;}
  // Account status, voice lists, audio and AI calls always use the live server.
  if(url.pathname.startsWith('/api/') || url.pathname==='/healthz' || url.pathname==='/sw.js')return;
  if(!url.pathname.startsWith('/assets/') && url.pathname!=='/manifest.webmanifest')return;
  event.respondWith((async()=>{
    const shellCache=await caches.open(SHELL), fileCache=await caches.open(FILES);
    const cached=await shellCache.match(request) || await fileCache.match(request);if(cached)return cached;
    const response=await fetch(request);if(response.ok)await put(fileCache,request,response.clone(),MAX_FILES);return response;
  })());
});
