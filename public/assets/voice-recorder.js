(function(root){
  'use strict';
  const media=root.navigator?.mediaDevices;
  const supported=Boolean(root.isSecureContext!==false && media?.getUserMedia && root.MediaRecorder);
  const MAX_BYTES=750000,MAX_DURATION=10000;
  let active=null,configured=false,statusRequest=null;
  function issue(message,code='SPEECH_ERROR') {const error=new Error(message);error.code=code;return error;}
  function aborted() {const error=issue('Đã dừng thu âm.','SPEECH_CANCELLED');error.name='AbortError';return error;}
  function emit(session,state,message,level=0) {
    if(session.done || session!==active) return;
    session.state=state;
    try {session.onState?.({state,message,level});} catch {}
  }
  function stopTracks(stream) {for(const track of stream?.getTracks?.() || []) {try {track.stop();} catch {}}}
  function clean(session) {
    root.clearTimeout(session.timer);root.clearInterval(session.levelTimer);
    stopTracks(session.stream);
    if(session.context) {try {Promise.resolve(session.context.close()).catch(()=>{});} catch {}}
  }
  function finish(session,error,result) {
    if(session.done) return;
    session.done=true;clean(session);
    if(active===session) active=null;
    error ? session.reject(error) : session.resolve(result);
  }
  function permissionError(error) {
    if(error?.name==='NotAllowedError' || error?.name==='SecurityError') return issue('Chưa được phép dùng micro. Bật quyền micro cho Safari rồi thử lại.','SPEECH_PERMISSION');
    if(error?.name==='NotFoundError') return issue('Không tìm thấy micro. Hãy dùng micro khác hoặc gõ từ.','SPEECH_DEVICE');
    if(error?.name==='NotReadableError') return issue('Micro đang được ứng dụng khác dùng. Đóng ứng dụng đó rồi thử lại.','SPEECH_DEVICE');
    return issue('Chưa bật được micro. Hãy mở bằng Safari rồi thử lại.','SPEECH_START');
  }
  async function encode(blob) {
    if(typeof blob.arrayBuffer==='function') {
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
      for(let index=0;index<bytes.length;index+=16384) binary+=String.fromCharCode(...bytes.subarray(index,index+16384));
      return root.btoa(binary);
    }
    return new Promise((resolve,reject)=>{const reader=new root.FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(issue('Không đọc được bản ghi âm. Hãy thử lại.','SPEECH_AUDIO'));reader.readAsDataURL(blob);});
  }
  async function upload(session) {
    if(session.done || session!==active) return;
    clean(session);
    const durationMs=Math.round(root.performance.now()-session.startedAt);
    const blob=new root.Blob(session.chunks,{type:session.recorder.mimeType || session.mimeType});
    if(durationMs<350 || !blob.size || blob.size>MAX_BYTES) {finish(session,issue('Hãy nói một từ rõ ràng rồi bấm micro để gửi.','SPEECH_AUDIO'));return;}
    emit(session,'transcribing','Đang nhận diện…');
    session.abort=new root.AbortController();
    session.timer=root.setTimeout(()=>{session.timedOut=true;session.abort.abort();finish(session,issue('Nhận diện hơi chậm. Hãy thử lại hoặc gõ từ.','SPEECH_TIMEOUT'));},7500);
    try {
      const audio=await encode(blob);
      if(session.done || session!==active) return;
      const response=await root.fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio,mimeType:blob.type,language:session.language,durationMs}),signal:session.abort.signal,cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(session.done || session!==active) return;
      if(!response.ok) throw issue(typeof data.error==='string' ? data.error : 'Chưa nhận diện được. Hãy thử lại hoặc gõ từ.',data.code || 'SPEECH_SERVICE');
      if(typeof data.text!=='string' || !data.text.trim()) throw issue('Chưa nghe rõ từ. Hãy nói lại gần micro hơn.','SPEECH_NO_VOICE');
      finish(session,null,{text:data.text.trim(),language:data.language || session.language});
    } catch(error) {
      if(session.done) return;
      finish(session,error.code ? error : issue(root.navigator?.onLine===false ? 'Đang ngoại tuyến. Hãy gõ từ đã lưu; micro cần Internet.' : 'Chưa kết nối được. Hãy thử lại hoặc gõ từ.','SPEECH_CONNECTION'));
    }
  }
  function watchLevel(session) {
    if(!session.context) return;
    try {
      const analyser=session.context.createAnalyser();analyser.fftSize=512;
      session.context.createMediaStreamSource(session.stream).connect(analyser);
      const samples=new Uint8Array(analyser.fftSize);
      session.voiceMs=0;session.lastVoiceAt=session.startedAt;
      session.levelTimer=root.setInterval(()=>{
        if(session.done || session.state!=='recording') return;
        analyser.getByteTimeDomainData(samples);
        let energy=0;for(const value of samples) energy+=((value-128)/128)**2;
        const rms=Math.sqrt(energy/samples.length),now=root.performance.now();
        if(rms>0.015) {session.voiceMs+=100;session.lastVoiceAt=now;}
        emit(session,'recording','Đang nghe… nói từ rồi bấm micro để gửi.',Math.min(1,rms*8));
        if(session.voiceMs>=100 && now-session.startedAt>=600 && now-session.lastVoiceAt>=950) stop();
        else if(session.voiceMs===0 && now-session.startedAt>=6000) {cancel(issue('Chưa thu được tiếng. Đưa điện thoại gần hơn rồi thử lại.','SPEECH_NO_VOICE'));}
      },100);
    } catch {}
  }
  function start({language='en-US',onState}={}) {
    if(active) return Promise.reject(issue('Micro đang hoạt động. Bấm lại để gửi hoặc dừng.','SPEECH_BUSY'));
    if(root.navigator?.onLine===false) return Promise.reject(issue('Đang ngoại tuyến. Hãy gõ từ đã lưu; micro cần Internet.','SPEECH_CONNECTION'));
    if(!supported || !configured) return Promise.reject(issue('Micro thu âm chưa sẵn sàng. Hãy mở Safari hoặc gõ từ.','SPEECH_UNAVAILABLE'));
    const session={language,onState,chunks:[],done:false,state:'requesting'};
    const result=new Promise((resolve,reject)=>{session.resolve=resolve;session.reject=reject;});
    active=session;
    emit(session,'requesting','Thu âm ngắn và gửi Gemini để nhận diện. Cho phép micro khi Safari hỏi.');
    let pending;
    try {
      // Called directly from the tap: iOS requires a gesture for microphone/audio activation.
      pending=media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      const Context=root.AudioContext || root.webkitAudioContext;
      if(Context) {try {session.context=new Context();Promise.resolve(session.context.resume()).catch(()=>{});} catch {}}
    } catch(error) {finish(session,permissionError(error));return result;}
    Promise.resolve(pending).then(stream=>{
      if(session.done || session!==active) {stopTracks(stream);return;}
      session.stream=stream;
      try {
        const formats=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
        session.mimeType=formats.find(type=>root.MediaRecorder.isTypeSupported?.(type)) || '';
        const options=session.mimeType ? {mimeType:session.mimeType,audioBitsPerSecond:48000} : {audioBitsPerSecond:48000};
        try {session.recorder=new root.MediaRecorder(stream,options);} catch {session.recorder=new root.MediaRecorder(stream,session.mimeType ? {mimeType:session.mimeType} : {});}
        session.recorder.ondataavailable=event=>{if(event.data?.size && !session.done) session.chunks.push(event.data);};
        session.recorder.onerror=()=>finish(session,issue('Micro bị gián đoạn. Hãy bấm micro để thử lại.','SPEECH_RECORDING'));
        session.recorder.onstop=()=>upload(session);
        session.startedAt=root.performance.now();
        session.recorder.start(250);
        emit(session,'recording','Đang nghe… nói từ rồi bấm micro để gửi.');
        session.timer=root.setTimeout(stop,MAX_DURATION);
        watchLevel(session);
      } catch(error) {finish(session,issue('Chưa ghi âm được. Hãy mở bằng Safari rồi thử lại.','SPEECH_START'));}
    },error=>{if(!session.done) finish(session,permissionError(error));});
    return result;
  }
  function stop() {
    const session=active;if(!session) return false;
    if(session.state==='requesting') {cancel();return true;}
    if(session.state!=='recording') return false;
    root.clearTimeout(session.timer);root.clearInterval(session.levelTimer);
    try {if(session.recorder.state!=='inactive') session.recorder.stop();} catch {finish(session,issue('Ghi âm bị gián đoạn. Hãy thử lại.','SPEECH_RECORDING'));}
    return true;
  }
  function cancel(error=aborted()) {
    const session=active;if(!session) return;
    session.abort?.abort();finish(session,error);
    try {if(session.recorder?.state!=='inactive') session.recorder?.stop();} catch {}
  }
  function notifyReady() {
    if(!root.dispatchEvent) return;
    try {
      const event=root.CustomEvent ? new root.CustomEvent('helen:speech-ready',{detail:{configured}}) : new root.Event('helen:speech-ready');
      root.dispatchEvent(event);
    } catch {}
  }
  function refresh() {
    if(!supported || root.navigator?.onLine===false) return Promise.resolve(configured);
    if(statusRequest) return statusRequest;
    statusRequest=(async()=>{
      const controller=new root.AbortController();const timer=root.setTimeout(()=>controller.abort(),4500);
      try {
        const response=await root.fetch('/api/speech/status',{cache:'no-store',signal:controller.signal});
        const data=await response.json();
        // A transient connection failure must not forget a capability already confirmed.
        if(response.ok && typeof data.configured==='boolean') configured=data.configured;
      } catch {} finally {root.clearTimeout(timer);statusRequest=null;notifyReady();}
      return configured;
    })();
    return statusRequest;
  }
  const ready=refresh();
  root.HelenVoiceRecorder={ready,refresh,get configured(){return configured;},available:()=>supported && configured,isActive:()=>Boolean(active),get state(){return active?.state || 'idle';},start,stop,cancel};
  root.document?.addEventListener('visibilitychange',()=>{if(root.document.hidden) cancel();else if(!configured) refresh();});
  root.addEventListener?.('pagehide',()=>cancel());
  root.addEventListener?.('online',()=>refresh());
})(globalThis);
