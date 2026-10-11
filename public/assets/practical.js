(()=>{
 'use strict';
 const core=globalThis.HelenPracticalCore,page=document.getElementById('page-practical');if(!core || !page)return;
 const $=id=>document.getElementById(id),KEY='helen-practical-ai-v1',VOICE='helen-practical-voice-v1',AI_VOICE='helen-practical-ai-voice-v1',DEVICE_VOICE='helen-practical-device-voice-v1',AUTO='helen-practical-autoplay-v1';
 const input=$('practical-input'),status=$('practical-status'),mic=$('practical-mic'),voice=$('practical-voice'),aiVoice=$('practical-ai-voice'),deviceVoice=$('practical-device-voice'),autoplay=$('practical-autoplay');
 const partnerCache=globalThis.HelenOfflineAudio?.create({cacheName:'helen-practical-audio-v1',maxClips:30,maxBytes:5*1024*1024});
 const partnerAudio=globalThis.HelenPracticalAudio?.create({pronunciation:globalThis.HelenPronunciation,offlineAudio:partnerCache});
 let state,configured=null,checking,busy=false,phase='idle',run=0,controller,attempt,recording=false,storageFailed=false,partnerConfig=null,partnerLoading,speechPhase='idle',speechRun=0;
 const get=key=>{try{return localStorage.getItem(key);}catch{return null;}},put=(key,value)=>{try{localStorage.setItem(key,value);}catch{message('Lựa chọn chỉ giữ trong phiên này.');}};
 let chosenAI=get(AI_VOICE),chosenDevice=get(DEVICE_VOICE) || '';
 try{state=core.restore(JSON.parse(localStorage.getItem(KEY) || 'null'));const saved=get(VOICE);if(['device','elevenlabs'].includes(saved))voice.value=saved;autoplay.checked=get(AUTO)!=='0';}catch{}
 state ||= core.fresh();
 const mobileSettings=matchMedia('(max-width:760px)');$('practical-settings-details').open=!mobileSettings.matches;
 mobileSettings.addEventListener?.('change',event=>{$('practical-settings-details').open=!event.matches;});
 function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
 function travelIcon(){const element=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(element.namespaceURI,'path');element.setAttribute('viewBox','0 0 24 24');element.setAttribute('aria-hidden','true');path.setAttribute('d','M5 19 19 5M5 5h14v14');element.append(path);return element;}
 function message(text,error=false,loading=false){status.classList.toggle('error',error);status.setAttribute('role',error?'alert':'status');if(loading)showLoading(status,text);else finishLoading(status,text);}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageFailed=false;}catch{storageFailed=true;}}
 function partnerState(value){
  const captions={idle:'Ready when you are.',requesting:'Let’s get your mic ready.',listening:'I’m listening…',thinking:'Let me think…',loading:'Getting my voice ready…',speaking:'Your turn is next!',blocked:'Tap Hear reply to listen.',error:'You can still read my reply.'};
  $('practical-partner').dataset.state=value;$('practical-partner-caption').textContent=captions[value] || captions.idle;
 }
 function stopPartner(){++speechRun;partnerAudio?.stop();speechPhase='idle';if(!busy)partnerState('idle');controls();}
 function voiceChoices(){
  const selected=chosenAI || partnerConfig?.defaultVoice?.id || '',items=new Map();
  if(partnerConfig?.defaultVoice)items.set(partnerConfig.defaultVoice.id,partnerConfig.defaultVoice.label+' · Default');
  for(const option of $('voice')?.options || [])if(/^[A-Za-z0-9_-]{1,100}$/.test(option.value))items.set(option.value,option.text.slice(0,220));
  if(partnerConfig?.defaultVoice)items.set(partnerConfig.defaultVoice.id,partnerConfig.defaultVoice.label+' · Default');
  if(selected && selected!=='preferences' && /^[A-Za-z0-9_-]{1,100}$/.test(selected) && !items.has(selected))items.set(selected,'Saved AI voice · check access');
  aiVoice.replaceChildren(...(!selected?[new Option('Choose an AI voice','')]:[]),...Array.from(items,([id,label])=>new Option(label,id)),new Option('Use my Preferences voice','preferences'));
  if(items.has(selected) || selected==='preferences')aiVoice.value=selected;
  $('practical-ai-voice-field').hidden=voice.value!=='elevenlabs';$('practical-device-voice-field').hidden=voice.value!=='device';
 }
 function deviceChoices(){
  const selected=chosenDevice,list=partnerAudio?.listDeviceVoices() || [];
  deviceVoice.replaceChildren(new Option('Auto · Friendly English voice',''),...list.map(item=>new Option(`${item.name} · ${item.lang}${item.local?' · on device':''}`,item.id)));
  if(selected && !list.some(item=>item.id===selected))deviceVoice.add(new Option('Saved device voice · not available yet',selected));
  deviceVoice.value=selected;
 }
 async function loadPartner(){
  if(partnerConfig)return partnerConfig;if(partnerLoading)return partnerLoading;
  partnerLoading=(async()=>{
   try{
    const response=await apiFetch('/assets/practical-partner.json');if(!response.ok)throw Error();const data=await response.json();
    if(typeof data.name!=='string' || data.name.length>40 || !/^\/assets\/[A-Za-z0-9_./-]+\.(webp|png|svg)$/.test(data.image || '') || !/^[A-Za-z0-9_-]{1,100}$/.test(data.defaultVoice?.id || '') || typeof data.defaultVoice.label!=='string' || data.defaultVoice.label.length>150)throw Error();
    partnerConfig=data;$('practical-partner-name').textContent=`Meet ${data.name}.`;$('practical-partner-image').src=data.image;voiceChoices();deviceChoices();return data;
   }catch{if(!busy && speechPhase==='idle')message('Chưa tải được giọng AI. Chọn giọng khác hoặc giọng máy để nghe.',true);return null;}
   finally{partnerLoading=null;}
  })();return partnerLoading;
 }
 async function playReply(text,button){
  if(busy || !partnerAudio || globalThis.HelenPages?.current()!=='practical')return;
  const ticket=++speechRun;globalThis.HelenAudio?.stop();
  // A manual device replay must reach speechSynthesis.speak within the tap.
  // Keep the same gesture-unlocked media element for delayed ElevenLabs replies.
  if(voice.value==='elevenlabs' && !partnerConfig)await loadPartner();if(ticket!==speechRun || busy)return;
  const voiceId=aiVoice.value==='preferences'?$('voice')?.value:aiVoice.value;
  if(voice.value==='elevenlabs' && !voiceId){message('Chọn một giọng AI hoặc giọng máy để nghe.',true);return;}
  if(button){button.setAttribute('aria-busy','true');button.setAttribute('aria-pressed','true');}
  try{
   const result=await partnerAudio.play(text,{method:voice.value,voiceId,deviceVoiceId:deviceVoice.value,onState:info=>{
    if(ticket!==speechRun)return;speechPhase=info.state;partnerState(info.state);controls();
    if(info.state==='loading')message('Đang chuẩn bị giọng AI…',false,true);
    else if(info.state==='speaking')message('AI đang trả lời bằng giọng nói. Bạn có thể bấm Stop voice để dừng.');
    else if(info.state==='blocked')message('Safari cần một lần chạm để phát tiếng. Bấm Hear reply để nghe.');
    else if(info.state==='error')message(/ElevenLabs rejected|Cannot connect to ElevenLabs/i.test(info.message || '')?'Giọng này chưa phát được. Chọn giọng khác hoặc Device voice.':shortError({message:info.message},'Chưa phát được giọng. Bấm Hear reply để thử lại.'),true);
    else if(info.state==='idle')message('Đến lượt bạn. Bấm Speak hoặc nhập câu trả lời.');
   }});
   if(ticket===speechRun && result?.state==='cancelled'){speechPhase='idle';partnerState('idle');}
  }finally{if(button){button.removeAttribute('aria-busy');button.setAttribute('aria-pressed','false');}controls();}
 }
 function controls(){
  const offline=navigator.onLine===false,disabled=busy || offline || configured===false;
  $('practical-send').disabled=disabled || !input.value.trim();input.disabled=busy;
  mic.disabled=offline || configured===false || !globalThis.HelenVoiceRecorder?.available() || (busy && !['requesting','recording'].includes(phase));
  mic.setAttribute('aria-pressed',String(recording));mic.setAttribute('aria-label',recording?'Stop recording and send reply':'Record a speaking reply');mic.querySelector('span').textContent=recording?'Send recording':'Speak';
  $('practical-cancel').hidden=!busy;$('practical-reset').disabled=busy;$('practical-level').disabled=busy;
  $('practical-scenarios').querySelectorAll('button').forEach(button=>button.disabled=busy);
  $('practical-messages').querySelectorAll('.say').forEach(button=>button.disabled=busy || button.getAttribute('aria-busy')==='true');
  $('practical-use-hint').disabled=busy;
  $('practical-messages').setAttribute('aria-busy',String(busy));
  $('practical-replay').disabled=busy || ['loading','speaking'].includes(speechPhase);$('practical-stop-voice').disabled=!['loading','speaking'].includes(speechPhase);
  aiVoice.disabled=busy;deviceVoice.disabled=busy;voice.disabled=busy;
 }
 function listen(text){const button=node('button','🔊','say');button.type='button';button.setAttribute('aria-label','Listen to this sentence');button.setAttribute('aria-pressed','false');button.onclick=()=>{void partnerAudio?.unlock();void playReply(text,button);};return button;}
 function render(){
  const item=core.scenario(state.scenario);$('practical-level').value=state.level;$('practical-chat-title').textContent=item.title;$('practical-goal').textContent=item.goal;$('practical-hint').textContent=item.hint;$('practical-settings-summary').textContent=`Conversation settings · ${state.level}`;
  $('practical-scenarios').replaceChildren(...core.scenarios.map(item=>{const button=node('button');button.type='button';button.dataset.scenario=item.id;button.setAttribute('aria-pressed',String(item.id===state.scenario));const icon=node('span',item.id==='travel'?undefined:item.icon);icon.setAttribute('aria-hidden','true');if(item.id==='travel')icon.append(travelIcon());button.append(icon,node('strong',item.title));button.onclick=()=>reset(item.id,state.level);return button;}));
  const cards=state.messages.map(turn=>{
   const card=node('article',undefined,'practical-message '+turn.role),head=node('div',undefined,'practical-message-header');head.append(node('strong',turn.role==='user'?'You':'Speaking partner'));
   if(turn.role==='assistant')head.append(listen(turn.text));card.append(head,node('p',turn.text));
   if(turn.translation){const detail=node('details');detail.append(node('summary','Translation'),node('p',turn.translation));card.append(detail);}
   if(turn.feedback && typeof turn.feedback.note==='string'){
    const feedback=node('div',undefined,'practical-feedback');feedback.append(node('h3','A little coaching'),node('p',turn.feedback.note));
    if(typeof turn.feedback.improved==='string'){feedback.append(node('strong','Try saying'),node('blockquote',turn.feedback.improved));}
    if(turn.feedback.phrase && typeof turn.feedback.phrase.text==='string')feedback.append(node('p','Useful phrase · '+turn.feedback.phrase.text),node('p',typeof turn.feedback.phrase.translation==='string'?turn.feedback.phrase.translation:''));
    card.append(feedback);
   }
   globalThis.HelenPronunciation?.register(turn);return card;
  });$('practical-messages').replaceChildren(...cards);controls();
 }
 function reset(id=state.scenario,level=state.level){
  if(busy)return;
  if(state.messages.length>1 && !confirm('Bắt đầu phiên mới? Cuộc hội thoại hiện tại trên thiết bị sẽ được thay thế.')){$('practical-level').value=state.level;return;}
  stopPartner();
  state=core.fresh(id,level);attempt=null;input.value='';save();render();message(navigator.onLine===false?'Đang ngoại tuyến. Xem lại hội thoại; kết nối mạng để luyện với AI.':'Bấm Speak hoặc nhập câu trả lời để bắt đầu.');
 }
 async function check(){
  void loadPartner();
  if(navigator.onLine===false){message('Đang ngoại tuyến. Xem lại hội thoại; kết nối mạng để luyện với AI.');controls();return;}
  if(checking)return checking;
  checking=(async()=>{
   try{const response=await apiFetch('/api/practical/status',{cache:'no-store'}),data=await response.json();if(response.ok){configured=data.configured===true;globalThis.HelenPronunciation?.register(data);if(!busy && speechPhase==='idle')message(navigator.onLine===false?'Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.':configured?'Bấm Speak hoặc nhập câu trả lời để bắt đầu.':'Practical AI chưa được bật. Quản trị viên cần cấu hình Gemini.');}}
   catch{if(!busy && speechPhase==='idle')message(navigator.onLine===false?'Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.':'Chưa kết nối được AI. Hội thoại đã lưu vẫn xem được; có mạng thì thử gửi lại.',navigator.onLine!==false);}
   finally{checking=null;controls();}
  })();return checking;
 }
 async function request(value,signal){
  const content={scenario:state.scenario,level:state.level,history:core.context(state),...value},fingerprint=JSON.stringify(content);
  const requestId=value.audio?crypto.randomUUID():(attempt && attempt.fingerprint===fingerprint?attempt.id:(attempt={fingerprint,id:crypto.randomUUID()}).id);
  const response=await apiFetch('/api/practical',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...content,requestId}),signal});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error || 'Chưa nhận được phản hồi. Hãy thử lại.'),{code:data.code});
  globalThis.HelenPronunciation?.register(data);return data;
 }
 function accept(data){state=core.add(state,data);attempt=null;save();input.value='';render();const list=$('practical-messages');list.scrollTop=list.scrollHeight;message(storageFailed?'Bộ nhớ đầy. Hội thoại chỉ giữ trong phiên này.':'Đã có phản hồi. Bạn có thể nghe, xem bản dịch rồi trả lời tiếp.');}
 function finish(ticket,reply){if(ticket!==run)return;busy=false;recording=false;phase='idle';controller=null;partnerState('idle');controls();if(reply && autoplay.checked)void playReply(reply,$('practical-messages').querySelector('.practical-message.assistant:last-child .say'));}
 function cancel(announce=true){
  stopPartner();if(!busy)return;++run;controller?.abort();if(recording)globalThis.HelenVoiceRecorder?.cancel();busy=false;recording=false;phase='idle';controller=null;partnerState('idle');controls();if(announce)message('Đã dừng. Câu của bạn vẫn giữ nguyên.');
 }
 $('practical-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy || !input.value.trim())return;
  if(navigator.onLine===false){message('Cần Internet để gửi câu trả lời cho AI.',true);return;}
  stopPartner();void partnerAudio?.unlock();const ticket=++run,value=input.value.trim();let reply;busy=true;phase='replying';controller=new AbortController();globalThis.HelenAudio?.stop();partnerState('thinking');controls();message('AI đang nghe ý của bạn…',false,true);
  try{const data=await request({text:value},controller.signal);if(ticket===run){accept(data);reply=data.reply;}}
  catch(error){if(ticket===run)message(shortError(error,'Chưa kết nối được AI. Hãy thử lại.'),true);}
  finally{finish(ticket,reply);}
 });
 mic.addEventListener('click',()=>{
  const recorder=globalThis.HelenVoiceRecorder;if(recording){if(phase==='requesting')cancel();else {void partnerAudio?.unlock();recorder?.stop();}return;}if(busy || !recorder?.available())return;
  stopPartner();const ticket=++run;let reply;busy=true;recording=true;phase='requesting';globalThis.HelenAudio?.stop();partnerState('requesting');controls();
  const task=recorder.start({language:'en-US',mode:'conversation',submit:recorded,onState:info=>{
   if(ticket!==run)return;phase=info.state;controls();
   partnerState(info.state==='recording'?'listening':info.state==='transcribing'?'thinking':'requesting');
   if(info.state==='transcribing')message('AI đang nghe và chuẩn bị phản hồi…',false,true);
   else if(status.textContent!==info.message)message(info.message);
  }});void partnerAudio?.unlock();
  task.then(data=>{if(ticket===run){accept(data);reply=data.reply;}}).catch(error=>{if(ticket===run)message(shortError(error,'Chưa nghe rõ. Hãy thử lại hoặc nhập câu trả lời.'),true);}).finally(()=>finish(ticket,reply));
 });
 // Recorder supplies {signal}; keep the upload and AI reply in one request.
 function recorded(value,{signal}={}){return request(value,signal);}
 $('practical-cancel').onclick=()=>cancel();$('practical-reset').onclick=()=>reset();
 $('practical-level').onchange=()=>reset(state.scenario,$('practical-level').value);
 $('practical-use-hint').onclick=()=>{input.value=core.scenario(state.scenario).hint;input.focus();controls();};
 input.addEventListener('input',controls);input.addEventListener('keydown',event=>{if(event.key==='Enter' && (event.ctrlKey || event.metaKey)){event.preventDefault();$('practical-form').requestSubmit();}});
 voice.onchange=()=>{stopPartner();put(VOICE,voice.value);voiceChoices();deviceChoices();};
 aiVoice.onchange=()=>{stopPartner();chosenAI=aiVoice.value;put(AI_VOICE,chosenAI);};deviceVoice.onchange=()=>{stopPartner();chosenDevice=deviceVoice.value;put(DEVICE_VOICE,chosenDevice);};
 autoplay.onchange=()=>{put(AUTO,autoplay.checked?'1':'0');if(!autoplay.checked)stopPartner();};
 $('practical-replay').onclick=()=>{void partnerAudio?.unlock();const text=[...state.messages].reverse().find(turn=>turn.role==='assistant')?.text;if(text)void playReply(text,$('practical-replay'));};
 $('practical-stop-voice').onclick=()=>{stopPartner();message('Đã dừng giọng. Đến lượt bạn.');};
 document.addEventListener('helen:voices',voiceChoices);globalThis.speechSynthesis?.addEventListener?.('voiceschanged',deviceChoices);
 document.addEventListener('helen:voice-selected',()=>{if(aiVoice.value==='preferences')stopPartner();});
 document.addEventListener('helen:page-change',event=>{if(event.detail.page==='practical')void check();else cancel(false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel(false);});
 globalThis.addEventListener('pagehide',()=>cancel(false));
 globalThis.addEventListener('helen:speech-ready',controls);globalThis.addEventListener('offline',()=>{cancel(false);controls();message('Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.');});
 globalThis.addEventListener('online',()=>{if(globalThis.HelenPages?.current()==='practical')void check();});
 globalThis.addEventListener('storage',event=>{
  if([VOICE,AI_VOICE,DEVICE_VOICE,AUTO].includes(event.key)){
   stopPartner();if(event.key===VOICE && ['device','elevenlabs'].includes(event.newValue))voice.value=event.newValue;
   if(event.key===AI_VOICE)chosenAI=event.newValue;if(event.key===DEVICE_VOICE)chosenDevice=event.newValue || '';if(event.key===AUTO)autoplay.checked=event.newValue!=='0';voiceChoices();deviceChoices();return;
  }
  if(event.key!==KEY)return;cancel(false);try{state=core.restore(JSON.parse(event.newValue || 'null')) || core.fresh();render();message('Hội thoại đã cập nhật từ tab khác.');}catch{}
 });
 render();voiceChoices();deviceChoices();if(globalThis.HelenPages?.current()==='practical')void check();
})();
