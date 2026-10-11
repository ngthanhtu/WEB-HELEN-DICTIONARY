(function(root,factory){
  'use strict';
  if(typeof module==='object' && module.exports)module.exports=factory;
  else root.HelenPracticalAudio={create:options=>factory({AudioCtor:root.Audio,BlobCtor:root.Blob,URL:root.URL,synthesis:root.speechSynthesis,Utterance:root.SpeechSynthesisUtterance,...options})};
})(typeof globalThis==='undefined'?this:globalThis,function({AudioCtor,BlobCtor=globalThis.Blob,URL=globalThis.URL,synthesis,Utterance,pronunciation,offlineAudio,api='',requestTimeout=8000,startTimeout=5000,playbackTimeout=120000}={}){
  const messages={blocked:'Bấm nút nghe để phát giọng trên trình duyệt này.',unsupported:'Trình duyệt chưa hỗ trợ giọng đọc này.',failed:'Chưa phát được giọng AI. Bấm nghe để thử lại.',timeout:'Giọng AI chưa sẵn sàng. Bấm nghe để thử lại.'};
  let audio=null,sequence=0,current=null,clipUrl=null,silentUrl=null;
  try{if(AudioCtor){audio=new AudioCtor();audio.preload='auto';audio.playsInline=true;audio.setAttribute?.('playsinline','');audio.setAttribute?.('webkit-playsinline','');}}catch{}
  function revoke(url){if(url)try{URL.revokeObjectURL(url);}catch{}}
  function releaseMedia(unload=true){if(!audio)return;audio.onplaying=audio.onended=audio.onerror=null;try{audio.pause();if(unload){audio.removeAttribute?.('src');audio.load?.();}}catch{}revoke(clipUrl);clipUrl=null;}
  function notify(job,state,message){try{job.onState?.({state,text:job.text,voiceId:job.voiceId,message});}catch{}}
  function emit(job,state,message){if(!job.done && current===job)notify(job,state,message);}
  function settle(job,state,message,unload=true){if(job.done)return;job.done=true;clearTimeout(job.requestTimer);clearTimeout(job.startTimer);clearTimeout(job.endTimer);job.controller.abort();if(current===job){current=null;releaseMedia(unload);notify(job,state,message);}job.resolve({state,...(message?{message}:{})});}
  function cancel(unload){sequence++;const job=current;if(job){settle(job,'cancelled',undefined,unload);if(job.utterance)try{synthesis.cancel();}catch{}}else releaseMedia(unload);}
  function stop(){cancel(true);}
  function silentWave(){
    // A tiny, silent PCM WAV played inside the actual user gesture. A Blob URL
    // respects media-src 'self' blob: and never contacts a voice provider.
    const samples=320,bytes=new Uint8Array(44+samples*2),view=new DataView(bytes.buffer);
    const write=(at,text)=>{for(let i=0;i<text.length;i++)bytes[at+i]=text.charCodeAt(i);};
    write(0,'RIFF');view.setUint32(4,bytes.length-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples*2,true);
    return new BlobCtor([bytes],{type:'audio/wav'});
  }
  function unlock(){
    if(!audio || !BlobCtor || !URL?.createObjectURL)return Promise.resolve(false);
    stop();const ticket=sequence;
    try{silentUrl ||= URL.createObjectURL(silentWave());audio.src=silentUrl;audio.volume=1;
      // Do not await before play(): iOS needs the original click's activation.
      return Promise.resolve(audio.play()).then(()=>{if(sequence===ticket && !current)try{audio.pause();}catch{}return true;},()=>false);
    }catch{return Promise.resolve(false);}
  }
  const voiceKey=voice=>voice.voiceURI || `${voice.lang}:${voice.name}`;
  function deviceVoices(){try{return (synthesis?.getVoices() || []).filter(voice=>/^en(?:[-_]|$)/i.test(voice.lang));}catch{return [];}}
  function listDeviceVoices(){return deviceVoices().map(voice=>({id:voiceKey(voice),name:voice.name || voice.lang,lang:voice.lang,local:voice.localService===true}));}
  function device(job,deviceVoiceId){
    if(!synthesis?.speak || !Utterance){settle(job,'error',messages.unsupported);return;}
    const voices=deviceVoices(),explicit=deviceVoiceId?voices.find(voice=>voiceKey(voice)===deviceVoiceId):null;
    if(deviceVoiceId && !explicit){settle(job,'error','Giọng máy đã chọn chưa có trên thiết bị. Hãy chọn lại giọng.');return;}
    const friendly=/\b(Samantha|Aria|Zira|Susan|Karen|Jessica|Jenny|Sara|Sarah|Emma|Victoria|Salli|Joanna)\b/i;
    const voice=explicit || voices.find(voice=>voice.localService && friendly.test(voice.name || '')) || voices.find(voice=>friendly.test(voice.name || '')) || voices.find(voice=>voice.localService && voice.lang==='en-US') || voices.find(voice=>voice.localService) || voices[0];
    const utterance=new Utterance(job.text);job.utterance=utterance;utterance.lang=voice?.lang || 'en-US';if(voice)utterance.voice=voice;utterance.rate=.95;utterance.pitch=1.08;utterance.volume=1;
    utterance.onstart=()=>{if(job.done || current!==job)return;clearTimeout(job.startTimer);emit(job,'speaking');};
    utterance.onend=()=>settle(job,'idle');utterance.onerror=event=>settle(job,event.error==='not-allowed'?'blocked':'error',event.error==='not-allowed'?messages.blocked:messages.failed);
    job.startTimer=setTimeout(()=>{if(job.done)return;settle(job,'error',messages.timeout);try{synthesis.cancel();}catch{}},startTimeout);
    job.endTimer=setTimeout(()=>{if(job.done)return;settle(job,'error',messages.timeout);try{synthesis.cancel();}catch{}},playbackTimeout);
    // For manual replay, keep speechSynthesis.speak synchronous in the click.
    try{synthesis.resume?.();synthesis.speak(utterance);}catch(error){settle(job,error?.name==='NotAllowedError'?'blocked':'error',error?.name==='NotAllowedError'?messages.blocked:messages.failed);}
  }
  async function media(job){
    try{
      if(!audio || !URL?.createObjectURL)throw Error(messages.unsupported);
      job.requestTimer=setTimeout(()=>settle(job,'error',messages.timeout),requestTimeout);
      let response=await offlineAudio?.get?.(job.text,job.voiceId);if(job.done || current!==job)return;
      if(!response){
        if(!pronunciation?.request)throw Error(messages.unsupported);
        response=await pronunciation.request(job.text,job.voiceId,{api,signal:job.controller.signal});if(job.done || current!==job)return;
        if(!response?.ok){const failure=await response?.json?.().catch(()=>({}));throw Error(failure?.error || messages.failed);}
        // Saving should never delay audible playback. Retain only this exact
        // voice/text response, using the existing bounded offline audio cache.
        try{Promise.resolve(offlineAudio?.save?.(job.text,job.voiceId,response.clone())).catch(()=>{});}catch{}
      }
      const blob=await response.blob();if(job.done || current!==job)return;
      clearTimeout(job.requestTimer);
      if(!blob.size || !/^audio\//i.test(blob.type || response.headers?.get?.('Content-Type') || ''))throw Error(messages.failed);
      clipUrl=URL.createObjectURL(blob);audio.src=clipUrl;audio.volume=1;
      audio.onplaying=()=>{if(job.done || current!==job)return;clearTimeout(job.startTimer);emit(job,'speaking');};
      audio.onended=()=>settle(job,'idle');audio.onerror=()=>settle(job,'error',messages.failed);
      job.startTimer=setTimeout(()=>settle(job,'error',messages.timeout),startTimeout);
      job.endTimer=setTimeout(()=>settle(job,'error',messages.timeout),playbackTimeout);
      try{await audio.play();}catch(error){if(job.done)return;settle(job,error?.name==='NotAllowedError'?'blocked':'error',error?.name==='NotAllowedError'?messages.blocked:messages.failed);}
    }catch(error){if(!job.done && current===job)settle(job,'error',error?.message || messages.failed);}
  }
  function play(text,{voiceId='',method='elevenlabs',deviceVoiceId='',onState}={}){
    // Reuse the gesture-unlocked element; cancellation removes the preceding
    // source but does not replace the Audio instance or its playback permission.
    cancel(false);text=typeof text==='string'?text.trim():'';
    return new Promise(resolve=>{
      const job={text,voiceId,onState,resolve,controller:new AbortController(),done:false};current=job;
      if(!text || text.length>2000){settle(job,'error','Chưa có câu trả lời để nghe.');return;}
      if(method!=='device' && !/^[A-Za-z0-9_-]{1,100}$/.test(voiceId)){settle(job,'error','Hãy chọn giọng cho bạn luyện nói.');return;}
      emit(job,'loading');if(job.done || current!==job)return;
      if(method==='device')device(job,deviceVoiceId);else void media(job);
    });
  }
  function destroy(){stop();revoke(silentUrl);silentUrl=null;}
  return {unlock,play,stop,destroy,listDeviceVoices,available:Boolean(audio || synthesis?.speak && Utterance)};
});
