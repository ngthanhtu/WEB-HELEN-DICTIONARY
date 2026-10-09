(()=>{
  'use strict';
  const grants=new Map(),pending=new Map();let volatileDevice;
  function device(){try{const old=localStorage.getItem('helen-history-device');if(/^[a-f0-9]{64}$/.test(old || ''))return old;}catch{}
    volatileDevice ||= Array.from(crypto.getRandomValues(new Uint8Array(32)),value=>value.toString(16).padStart(2,'0')).join('');
    try{localStorage.setItem('helen-history-device',volatileDevice);}catch{}return volatileDevice;
  }
  function register(data){for(const item of data?.pronunciation || [])if(typeof item.text==='string' && typeof item.proof==='string')grants.set(item.text,{proof:item.proof,word:item.word || data.word || ''});
    if(grants.size>1500)for(const key of [...grants.keys()].slice(0,grants.size-1500))grants.delete(key);
  }
  async function request(text,voice,{word='',signal,api='',context,renew=false}={}){
    let grant=grants.get(text);
    if(renew || !grant || Number(grant.proof.split('.')[0])*1000<Date.now()+60000){
      const headword=word || grant?.word || (text.length<=100?text:'');
      if(!headword)throw Error('Hãy tra lại từ trước khi nghe.');
      const key=JSON.stringify([text,headword,context]);
      let job=pending.get(key);
      if(!job){job=(async()=>{
        const response=await apiFetch(`${api}/api/pronunciation`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,word:headword,context}),signal});
        const data=await response.json();if(!response.ok)throw Error(data.error || 'Hãy tra lại từ trước khi nghe.');grants.set(text,data);return data;
      })();pending.set(key,job);job.finally(()=>pending.delete(key)).catch(()=>{});}grant=await job;
    }
    const response=await apiFetch(`${api}/api/tts?${new URLSearchParams({text,voice,proof:grant.proof})}`,{signal,headers:{'X-Helen-Device':device()}});
    if(!renew && response.status===403 && (await response.clone().json().catch(()=>({}))).code==='PRONUNCIATION_REQUIRED')return request(text,voice,{word,signal,api,context,renew:true});
    return response;
  }
  window.HelenPronunciation={register,request};
})();
