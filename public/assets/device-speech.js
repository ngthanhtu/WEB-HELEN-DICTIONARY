(function(root,factory){
  'use strict';
  if(typeof module==='object' && module.exports)module.exports=factory;
  else root.HelenDeviceSpeech=factory({synthesis:root.speechSynthesis,Utterance:root.SpeechSynthesisUtterance});
})(typeof globalThis==='undefined'?this:globalThis,function({synthesis,Utterance,startTimeout=4000}={}){
  const available=Boolean(synthesis?.speak && Utterance);let voices=[],active;
  function refresh(){try{voices=synthesis?.getVoices() || [];}catch{voices=[];}}
  refresh();synthesis?.addEventListener?.('voiceschanged',refresh);
  function stop(){if(!active)return;const previous=active;active=null;previous.cancel();synthesis.cancel();}
  function speak(text,{accent='Ame'}={}){
    if(!available)return Promise.reject(Error('Máy chưa hỗ trợ giọng đọc nhanh. Chọn Selected ElevenLabs voice.'));
    stop();refresh();
    const lang=accent==='Eng'?'en-GB':'en-US',english=voices.filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
    const voice=english.find(v=>v.localService && v.lang===lang) || english.find(v=>v.localService) || english.find(v=>v.lang===lang) || english[0];
    const utterance=new Utterance(String(text));utterance.lang=voice?.lang || lang;if(voice)utterance.voice=voice;utterance.rate=.95;utterance.volume=1;
    return new Promise((resolve,reject)=>{
      let timer,started=false;
      const finish=(error)=>{clearTimeout(timer);if(active?.utterance===utterance)active=null;if(error && !started)reject(error);};
      utterance.onstart=()=>{clearTimeout(timer);started=true;resolve({lang:utterance.lang,local:voice?.localService===true});};
      utterance.onend=()=>{if(!started){started=true;resolve({lang:utterance.lang,local:voice?.localService===true});}finish();};
      utterance.onerror=event=>finish(Error(['interrupted','canceled'].includes(event.error)?'Đã dừng giọng đọc.':'Giọng máy chưa sẵn sàng. Chọn Selected ElevenLabs voice hoặc thử lại.'));
      active={utterance,cancel:()=>finish(Error('Đã dừng giọng đọc.'))};
      timer=setTimeout(()=>{if(active?.utterance!==utterance)return;finish(Error('Giọng máy chưa sẵn sàng. Kiểm tra giọng tiếng Anh trong cài đặt điện thoại.'));synthesis.cancel();},startTimeout);
      // Keep this synchronous inside the original click, required by iOS Safari.
      try{synthesis.resume?.();synthesis.speak(utterance);}catch(error){finish(error);}
    });
  }
  return {available,speak,stop};
});
