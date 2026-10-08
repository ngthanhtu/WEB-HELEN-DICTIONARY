(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory;
  else root.HelenOfflineAudio=factory({caches:root.caches,origin:root.location.origin});
})(typeof globalThis!=='undefined'?globalThis:this,function({caches,origin,maxClips=100,maxBytes=20*1024*1024,maxClipBytes=1024*1024}={}){
  const CACHE='helen-audio-v1';
  let queue=Promise.resolve();
  const available=Boolean(caches?.open && origin);
  function key(text,voice){
    text=typeof text==='string'?text.trim():'';
    if(!text || text.length>2000 || typeof voice!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(voice))return null;
    return `${origin}/__helen_audio__?${new URLSearchParams({text,voice})}`;
  }
  function info(request,response){
    try{
      const url=new URL(typeof request==='string'?request:request.url),text=url.searchParams.get('text'),voice=url.searchParams.get('voice');
      const bytes=Number(response?.headers.get('X-Helen-Audio-Bytes'));
      if(key(text,voice)!==url.href || !response?.ok || !/^audio\//i.test(response.headers.get('Content-Type') || '') || !Number.isSafeInteger(bytes) || bytes<1 || bytes>maxClipBytes)return null;
      return {text,voice,bytes,at:Number(response.headers.get('X-Helen-Saved-At')) || 0,key:url.href};
    }catch{return null;}
  }
  async function inventory(){
    if(!available)return [];
    try{
      const cache=await caches.open(CACHE),items=[];
      // Newer insertion wins when several clips share the same millisecond.
      for(const request of (await cache.keys()).reverse()){
        const item=info(request,await cache.match(request));if(item)items.push(item);
      }
      return items.sort((a,b)=>b.at-a.at);
    }catch{return [];}
  }
  async function get(text,voice){
    const url=key(text,voice);if(!available || !url)return null;
    try{const response=await (await caches.open(CACHE)).match(url);return info(url,response)?response:null;}catch{return null;}
  }
  function serialized(work){const result=queue.then(work);queue=result.catch(()=>{});return result;}
  async function save(text,voice,response){
    const url=key(text,voice);
    if(!available || !url || !response?.ok || !/^audio\//i.test(response.headers.get('Content-Type') || ''))return false;
    try{
      const bytes=await response.clone().arrayBuffer();
      if(!bytes.byteLength || bytes.byteLength>maxClipBytes || bytes.byteLength>maxBytes)return false;
      return await serialized(async()=>{
        const cache=await caches.open(CACHE);
        // Write first: a full device must not delete the last successful recording.
        await cache.put(url,new Response(bytes,{headers:{'Content-Type':response.headers.get('Content-Type'),'X-Helen-Audio-Bytes':String(bytes.byteLength),'X-Helen-Saved-At':String(Date.now())}}));
        const items=await inventory();let count=items.length,total=items.reduce((sum,item)=>sum+item.bytes,0);
        for(const item of items.slice().reverse()){
          if(count<=maxClips && total<=maxBytes)break;
          if(item.key===url)continue;
          await cache.delete(item.key);count--;total-=item.bytes;
        }
        return true;
      });
    }catch{return false;}
  }
  async function clear(){
    if(!available)return false;
    return serialized(async()=>{try{await caches.delete(CACHE);return true;}catch{return false;}});
  }
  async function plan(words,voice){
    const unique=[...new Set((Array.isArray(words)?words:[]).filter(word=>typeof word==='string' && word.trim().length<=100 && key(word,voice)).map(word=>word.trim()))].slice(0,100);
    const saved=new Set((await inventory()).filter(item=>item.voice===voice).map(item=>item.text));
    const missing=unique.filter(word=>!saved.has(word));
    return {words:missing.slice(0,10),remaining:missing.length,cached:unique.length-missing.length};
  }
  async function download({words,voice,signal,fetchAudio,onProgress=()=>{},online=()=>true}={}){
    const planned=await plan(words,voice),outcome={total:planned.words.length,saved:0,failed:0,cancelled:false,message:''};
    if(!available){outcome.message='Trình duyệt chưa hỗ trợ lưu giọng ngoại tuyến.';return outcome;}
    for(const text of planned.words){
      if(signal?.aborted){outcome.cancelled=true;break;}
      if(!online()){outcome.message='Mất mạng. Các giọng đã tải vẫn được giữ.';break;}
      onProgress({...outcome,text});
      try{
        // Never substitute another voice, and never re-download an existing clip.
        if(await get(text,voice))continue;
        const response=await fetchAudio(text,voice,signal);
        if(signal?.aborted){outcome.cancelled=true;break;}
        if(!response.ok){
          const failure=await response.json().catch(()=>({}));
          if(response.status===429 || failure.upstream_status===429){outcome.message='Đã chạm giới hạn giọng đọc. Chờ một phút hoặc kiểm tra hạn mức ElevenLabs.';break;}
          throw new Error(failure.error || 'Chưa tải được giọng.');
        }
        if(!await save(text,voice,response)){outcome.message='Chưa lưu được âm thanh. Kiểm tra dung lượng hoặc quyền lưu của trình duyệt.';break;}
        outcome.saved++;
      }catch(error){
        if(signal?.aborted){outcome.cancelled=true;break;}
        outcome.failed++;
        // Do not repeat a failing provider ten times in a row.
        outcome.message=error.message || 'Kết nối chậm. Hãy thử lại.';break;
      }
    }
    onProgress({...outcome,done:true});return outcome;
  }
  return {CACHE,available,key,get,save,inventory,clear,plan,download};
});
