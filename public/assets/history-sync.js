(function(root) {
  function create({storage,fetch:request,api='',onHistory=()=>{},onStatus=()=>{},online=()=>root.navigator?.onLine!==false,crypto=root.crypto}) {
    const DEVICE='helen-history-device',QUEUE='helen-history-outbox',SEEDED='helen-history-seeded';
    const read=key=>{try{return storage.getItem(key);}catch{return null;}};
    const write=(key,value)=>{try{storage.setItem(key,value);return true;}catch{return false;}};
    const uuid=()=>crypto?.randomUUID?.() || (crypto?.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5') : null);
    let token=read(DEVICE), busy=null, checked=false, configured=false, lastCheck=0;
    if(!/^[a-f0-9]{64}$/.test(token || '')) {
      if(!crypto?.getRandomValues)return {search(){},clear(){},sync:async()=>{}};
      token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
      if(!write(DEVICE,token))return {search(){},clear(){},sync:async()=>{}};
    }
    const headers={'Content-Type':'application/json','X-Helen-Device':token};
    function queue() {
      try {const values=JSON.parse(read(QUEUE)||'[]');return Array.isArray(values)?values.filter(e=>e && e.id && ['search','clear'].includes(e.action)).slice(-200):[];}catch{return [];}
    }
    function enqueue(action,word,at=new Date().toISOString()) {
      const id=uuid();if(!id)return;
      let values=queue();
      if(action==='clear')values=[];
      values.push({id,action,at,...(word?{word}:{})});
      if(values.length>200) {
        const clear=values.slice().reverse().find(event=>event.action==='clear');
        values=clear ? [clear,...values.filter(event=>event!==clear).slice(-199)] : values.slice(-200);
      }
      write(QUEUE,JSON.stringify(values));
    }
    function seed() {
      if(read(SEEDED))return;
      let local=[];try{local=JSON.parse(read('helen-history')||'[]');}catch{}
      if(Array.isArray(local))for(const [index,word] of local.slice(0,40).reverse().entries())if(typeof word==='string' && word.trim() && word.length<=100)enqueue('search',word,new Date(Date.now()-40000+index*1000).toISOString());
      write(SEEDED,'1');
    }
    function sync() {
      if(busy)return busy;
      if(!online()) {onStatus('Lịch sử lưu trên thiết bị; sẽ đồng bộ khi có mạng.');return Promise.resolve();}
      busy=(async()=>{
        if(!checked || Date.now()-lastCheck>30000) {
          const response=await request(`${api}/api/history/status`,{cache:'no-store'});
          if(!response.ok)throw Error('unavailable');
          const status=await response.json();configured=status.configured && status.connected;checked=true;lastCheck=Date.now();
        }
        if(!configured) {onStatus('Lịch sử đang lưu trên thiết bị này.');return;}
        onStatus('Đang đồng bộ lịch sử…');seed();
        // Events added while a request is pending remain queued for the next batch.
        for(let round=0;round<3 && online();round++) {
          const batch=queue().slice(0,100);if(!batch.length)break;
          const response=await request(`${api}/api/history`,{method:'POST',headers,body:JSON.stringify({events:batch})});
          if(!response.ok)throw Error('unavailable');
          const sent=new Set(batch.map(event=>event.id));write(QUEUE,JSON.stringify(queue().filter(event=>!sent.has(event.id))));
        }
        const response=await request(`${api}/api/history`,{headers,cache:'no-store'});
        if(!response.ok)throw Error('unavailable');const data=await response.json();
        // Never restore cleared history or replace a newer local search with an older GET.
        if(!queue().length && Array.isArray(data.history))onHistory(data.history.map(item=>item.word).filter(word=>typeof word==='string').slice(0,40));
        onStatus(queue().length?'Lịch sử mới đang chờ đồng bộ.':'Đã lưu lịch sử vào database cho thiết bị này.');
      })().catch(()=>{checked=false;onStatus('Lịch sử vẫn được lưu trên thiết bị; sẽ đồng bộ lại.');}).finally(()=>{busy=null;});
      return busy;
    }
    seed();
    return {sync,
      search(word){seed();enqueue('search',word);void sync();},
      clear(){write(SEEDED,'1');enqueue('clear');void sync();}
    };
  }
  root.HelenHistory={create};
  if(typeof module!=='undefined')module.exports={create};
})(typeof window==='undefined'?globalThis:window);
