(()=>{
 'use strict';
 const core=globalThis.HelenPracticalCore,page=document.getElementById('page-practical');if(!core || !page)return;
 const $=id=>document.getElementById(id),KEY='helen-practical-ai-v1',VOICE='helen-practical-voice-v1';
 const input=$('practical-input'),status=$('practical-status'),mic=$('practical-mic'),voice=$('practical-voice');
 let state,configured=null,checking,busy=false,phase='idle',run=0,controller,attempt,recording=false,storageFailed=false;
 try{state=core.restore(JSON.parse(localStorage.getItem(KEY) || 'null'));const saved=localStorage.getItem(VOICE);if(['device','elevenlabs'].includes(saved))voice.value=saved;}catch{}
 state ||= core.fresh();
 function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
 function travelIcon(){const element=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(element.namespaceURI,'path');element.setAttribute('viewBox','0 0 24 24');element.setAttribute('aria-hidden','true');path.setAttribute('d','M5 19 19 5M5 5h14v14');element.append(path);return element;}
 function message(text,error=false,loading=false){status.classList.toggle('error',error);status.setAttribute('role',error?'alert':'status');if(loading)showLoading(status,text);else finishLoading(status,text);}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageFailed=false;}catch{storageFailed=true;}}
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
 }
 function listen(text){const button=node('button','🔊','say');button.type='button';button.setAttribute('aria-label','Listen to this sentence');button.onclick=async()=>{
  if(busy)return;const ticket=run,method=voice.value;message('Đang chuẩn bị giọng đọc…');await speak(text,button,{device:method==='device'});
  if(!busy && ticket===run && method===voice.value){const note=$('voice-status')?.textContent;if(note)message(note,/Chưa|không|unavailable|failed/i.test(note));}controls();
 };return button;}
 function render(){
  const item=core.scenario(state.scenario);$('practical-level').value=state.level;$('practical-chat-title').textContent=item.title;$('practical-goal').textContent=item.goal;$('practical-hint').textContent=item.hint;
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
  state=core.fresh(id,level);attempt=null;input.value='';save();render();message(navigator.onLine===false?'Đang ngoại tuyến. Xem lại hội thoại; kết nối mạng để luyện với AI.':'Bấm Speak hoặc nhập câu trả lời để bắt đầu.');
 }
 async function check(){
  if(navigator.onLine===false){message('Đang ngoại tuyến. Xem lại hội thoại; kết nối mạng để luyện với AI.');controls();return;}
  if(checking)return checking;
  checking=(async()=>{
   try{const response=await apiFetch('/api/practical/status',{cache:'no-store'}),data=await response.json();if(response.ok){configured=data.configured===true;globalThis.HelenPronunciation?.register(data);if(!busy)message(navigator.onLine===false?'Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.':configured?'Bấm Speak hoặc nhập câu trả lời để bắt đầu.':'Practical AI chưa được bật. Quản trị viên cần cấu hình Gemini.');}}
   catch{if(!busy)message(navigator.onLine===false?'Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.':'Chưa kết nối được AI. Hội thoại đã lưu vẫn xem được; có mạng thì thử gửi lại.',navigator.onLine!==false);}
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
 function finish(ticket){if(ticket!==run)return;busy=false;recording=false;phase='idle';controller=null;controls();}
 function cancel(announce=true){
  if(!busy)return;++run;controller?.abort();if(recording)globalThis.HelenVoiceRecorder?.cancel();busy=false;recording=false;phase='idle';controller=null;controls();if(announce)message('Đã dừng. Câu của bạn vẫn giữ nguyên.');
 }
 $('practical-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy || !input.value.trim())return;
  if(navigator.onLine===false){message('Cần Internet để gửi câu trả lời cho AI.',true);return;}
  const ticket=++run,value=input.value.trim();busy=true;phase='replying';controller=new AbortController();globalThis.HelenAudio?.stop();controls();message('AI đang nghe ý của bạn…',false,true);
  try{const data=await request({text:value},controller.signal);if(ticket===run)accept(data);}
  catch(error){if(ticket===run)message(shortError(error,'Chưa kết nối được AI. Hãy thử lại.'),true);}
  finally{finish(ticket);}
 });
 mic.addEventListener('click',()=>{
  const recorder=globalThis.HelenVoiceRecorder;if(recording){if(phase==='requesting')cancel();else recorder?.stop();return;}if(busy || !recorder?.available())return;
  const ticket=++run;busy=true;recording=true;phase='requesting';globalThis.HelenAudio?.stop();controls();
  recorder.start({language:'en-US',mode:'conversation',submit:recorded,onState:info=>{
   if(ticket!==run)return;phase=info.state;controls();
   if(info.state==='transcribing')message('AI đang nghe và chuẩn bị phản hồi…',false,true);
   else if(status.textContent!==info.message)message(info.message);
  }}).then(data=>{if(ticket===run)accept(data);}).catch(error=>{if(ticket===run)message(shortError(error,'Chưa nghe rõ. Hãy thử lại hoặc nhập câu trả lời.'),true);}).finally(()=>finish(ticket));
 });
 // Recorder supplies {signal}; keep the upload and AI reply in one request.
 function recorded(value,{signal}={}){return request(value,signal);}
 $('practical-cancel').onclick=()=>cancel();$('practical-reset').onclick=()=>reset();
 $('practical-level').onchange=()=>reset(state.scenario,$('practical-level').value);
 $('practical-use-hint').onclick=()=>{input.value=core.scenario(state.scenario).hint;input.focus();controls();};
 input.addEventListener('input',controls);input.addEventListener('keydown',event=>{if(event.key==='Enter' && (event.ctrlKey || event.metaKey)){event.preventDefault();$('practical-form').requestSubmit();}});
 voice.onchange=()=>{globalThis.HelenAudio?.stop();try{localStorage.setItem(VOICE,voice.value);}catch{message('Lựa chọn giọng chỉ giữ trong phiên này.');}};
 document.addEventListener('helen:page-change',event=>{if(event.detail.page==='practical')void check();else cancel(false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel(false);});
 globalThis.addEventListener('helen:speech-ready',controls);globalThis.addEventListener('offline',()=>{cancel(false);controls();message('Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.');});
 globalThis.addEventListener('online',()=>{if(globalThis.HelenPages?.current()==='practical')void check();});
 globalThis.addEventListener('storage',event=>{if(event.key!==KEY)return;cancel(false);try{state=core.restore(JSON.parse(event.newValue || 'null')) || core.fresh();render();message('Hội thoại đã cập nhật từ tab khác.');}catch{}});
 render();if(globalThis.HelenPages?.current()==='practical')void check();
})();
