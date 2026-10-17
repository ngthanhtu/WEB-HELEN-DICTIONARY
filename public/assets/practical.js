(()=>{
 'use strict';
  const localUI=(text,params)=>globalThis.HelenI18n?.t(text,params) || text;
 const t=(text,params)=>globalThis.HelenI18n?.t(text,params) || text;
 const core=globalThis.HelenPracticalCore,page=document.getElementById('page-practical');if(!core || !page)return;
 const $=id=>document.getElementById(id),KEY='helen-practical-ai-v1',VOICE='helen-practical-voice-v1',AI_VOICE='helen-practical-ai-voice-v1',DEVICE_VOICE='helen-practical-device-voice-v1',AUTO='helen-practical-autoplay-v1',DRAFT='helen-practical-draft-v1',FALLBACK='helen-practical-quota-fallback-v1',QUOTA_UNTIL='helen-practical-voice-quota-until-v1',AUTO_SEND='helen-practical-auto-send-v1',SESSION='helen-practical-session-v1';
 const input=$('practical-input'),status=$('practical-status'),mic=$('practical-mic'),voice=$('practical-voice'),aiVoice=$('practical-ai-voice'),deviceVoice=$('practical-device-voice'),autoplay=$('practical-autoplay'),fallback=$('practical-quota-fallback'),autoSend=$('practical-auto-send');
 const partnerCache=globalThis.HelenOfflineAudio?.create({cacheName:'helen-practical-audio-v1',maxClips:30,maxBytes:5*1024*1024});
 const partnerAudio=globalThis.HelenPracticalAudio?.create({pronunciation:globalThis.HelenPronunciation,offlineAudio:partnerCache});
 const captions=globalThis.HelenLiveTranscript?.create();let liveCapture=null,draftTimer;
 let state,session,draft=null,configured=null,checking,busy=false,phase='idle',run=0,controller,attempt,audioAttempt=null,recording=false,storageFailed=false,partnerConfig=null,partnerLoading,speechPhase='idle',speechRun=0;
 const get=key=>{try{return localStorage.getItem(key);}catch{return null;}},put=(key,value)=>{try{localStorage.setItem(key,value);}catch{message('Lựa chọn chỉ giữ trong phiên này.');}};
 let chosenAI=get(AI_VOICE),chosenDevice=get(DEVICE_VOICE) || '';
 try{state=core.restore(JSON.parse(localStorage.getItem(KEY) || 'null'));const saved=get(VOICE);if(['device','elevenlabs'].includes(saved))voice.value=saved;autoplay.checked=get(AUTO)!=='0';}catch{}
 state ||= core.fresh();
 try{session=core.restoreSession(JSON.parse(get(SESSION) || 'null'),state);}catch{}session ||= core.sessionFrom(state);autoSend.checked=get(AUTO_SEND)!=='0';
 fallback.checked=get(FALLBACK)!=='0';let quotaUntil=Number(get(QUOTA_UNTIL)) || 0;
 try{const saved=JSON.parse(get(DRAFT) || 'null');if(saved?.scenario===state.scenario && saved.level===state.level && typeof saved.text==='string' && saved.text.length<=6000 && saved.text.trim()){draft=saved;input.value=saved.text;}}catch{}
 const mobileSettings=matchMedia('(max-width:760px)');$('practical-settings-details').open=!mobileSettings.matches;
 mobileSettings.addEventListener?.('change',event=>{$('practical-settings-details').open=!event.matches;});
 function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
 function travelIcon(){const element=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(element.namespaceURI,'path');element.setAttribute('viewBox','0 0 24 24');element.setAttribute('aria-hidden','true');path.setAttribute('d','M5 19 19 5M5 5h14v14');element.append(path);return element;}
 function message(text,error=false,loading=false){status.classList.toggle('error',error);status.setAttribute('role',error?'alert':'status');if(loading)showLoading(status,text);else finishLoading(status,text);}
 function save(){try{localStorage.setItem(SESSION,JSON.stringify(session));localStorage.setItem(KEY,JSON.stringify(state));storageFailed=false;}catch{storageFailed=true;}}
 function saveDraft(){clearTimeout(draftTimer);draftTimer=null;try{if(draft)localStorage.setItem(DRAFT,JSON.stringify({...draft,text:input.value}));else localStorage.removeItem(DRAFT);}catch{}}
 const comparable=text=>String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 function reviewTranscript(data){
  const browserText=draft?.browserText || (draft?.source==='live'?input.value:undefined),changed=Boolean(browserText && comparable(browserText)!==comparable(data.transcript));
  draft={scenario:state.scenario,level:state.level,text:data.transcript,uncertain:data.uncertain===true || changed,...(browserText?{browserText}:{}),...(data.speechReceipt?{speechReceipt:data.speechReceipt}:{})};input.value=data.transcript;saveDraft();
  message(draft.uncertain?'Có chỗ chưa nghe rõ. Sửa [unclear] hoặc thu âm lại; AI chưa tự đoán từ.':'Kiểm tra câu vừa nghe, sửa nếu cần rồi bấm Confirm & send.');
 }
 function quotaActive(){return voice.value==='elevenlabs' && fallback.checked && quotaUntil>Date.now();}
 function voiceStatus(){
  $('practical-voice-status').textContent=quotaActive()?'Device voice · ElevenLabs đã hết quota. Giữ nguyên giọng AI bạn chọn.':'';
  $('practical-retry-voice').hidden=voice.value!=='elevenlabs' || quotaUntil<=Date.now();
  $('practical-device-voice-field').hidden=voice.value!=='device' && !quotaActive();
 }
 function partnerState(value){
  const captions={idle:'Ready when you are.',requesting:'Let’s get your mic ready.',listening:'I’m listening…',thinking:'Let me think…',loading:'Getting my voice ready…',speaking:'Your turn is next!',blocked:'Tap Hear reply to listen.',error:'You can still read my reply.'};
  $('practical-partner').dataset.state=value;$('practical-partner-caption').textContent=t(captions[value] || captions.idle);
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
  $('practical-ai-voice-field').hidden=voice.value!=='elevenlabs';voiceStatus();
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
  const method=quotaActive()?'device':voice.value;
  if(method==='elevenlabs' && !partnerConfig)await loadPartner();if(ticket!==speechRun || busy)return;
  const voiceId=aiVoice.value==='preferences'?$('voice')?.value:aiVoice.value;
  if(method==='elevenlabs' && !voiceId){message('Chọn một giọng AI hoặc giọng máy để nghe.',true);return;}
  if(button){button.setAttribute('aria-busy','true');button.setAttribute('aria-pressed','true');}
  try{
   const result=await partnerAudio.play(text,{method,voiceId,deviceVoiceId:deviceVoice.value,fallbackOnQuota:fallback.checked,onQuota:()=>{
    quotaUntil=(Math.floor(Date.now()/86400000)+1)*86400000;put(QUOTA_UNTIL,String(quotaUntil));voiceStatus();
   },onState:info=>{
    if(ticket!==speechRun)return;speechPhase=info.state;partnerState(info.state);controls();
    if(info.state==='loading')message(info.message || (info.method==='device'?'Đang chuẩn bị giọng máy…':'Đang chuẩn bị giọng AI…'),false,true);
    else if(info.state==='speaking')message(quotaActive()?'Đang nghe bằng giọng máy vì ElevenLabs hết quota.':'AI đang trả lời bằng giọng nói. Bạn có thể bấm Stop voice để dừng.');
    else if(info.state==='blocked')message('Safari cần một lần chạm để phát tiếng. Bấm Hear reply để nghe.');
    else if(info.state==='error')message(/ElevenLabs rejected|Cannot connect to ElevenLabs/i.test(info.message || '')?'Giọng này chưa phát được. Chọn giọng khác hoặc Device voice.':shortError({message:info.message},'Chưa phát được giọng. Bấm Hear reply để thử lại.'),true);
    else if(info.state==='idle')message(quotaActive()?'Giọng máy đang được dùng. Đến lượt bạn.':'Đến lượt bạn. Bấm Speak hoặc nhập câu trả lời.');
   }});
   if(ticket===speechRun && result?.state==='cancelled'){speechPhase='idle';partnerState('idle');}
  }finally{if(button){button.removeAttribute('aria-busy');button.setAttribute('aria-pressed','false');}controls();}
 }
 function controls(){
  const offline=navigator.onLine===false,ended=Boolean(session.report),fastDraft=phase==='transcribing' && draft?.source==='live',disabled=busy || offline || configured===false || ended,canConfirmNow=fastDraft && !offline && configured!==false && !ended;
  $('practical-send').disabled=(disabled && !canConfirmNow) || !input.value.trim() || /\[unclear\]/i.test(input.value);input.disabled=ended;input.readOnly=busy && !fastDraft;
  $('practical-transcript-review').hidden=!draft || phase==='recording';$('practical-input-label').textContent=phase==='recording'?'Your reply · live draft':draft?'Your words · edit if needed':'Your reply';
  $('practical-send').firstChild.textContent=fastDraft?'Confirm & send now ':draft?'Confirm & send ':'Send reply ';
  $('practical-transcript-note').textContent=fastDraft?'Kiểm tra chữ tạm và gửi ngay để nhận góp ý ngữ pháp/từ vựng. Muốn đánh giá phát âm, hãy chờ nhận diện bản thu xong.':draft?.source==='reviewed-live'?'Câu bạn chỉnh sửa vẫn được giữ. Kiểm tra rồi bấm Confirm & send.':draft?.source==='live'?'Đây là chữ trình duyệt nghe tạm, có thể sai. Kiểm tra và sửa rồi bấm Confirm & send; AI sẽ góp ý dựa trên câu bạn xác nhận.':draft?.browserText && comparable(draft.browserText)!==comparable(input.value)?'Hai bản nhận diện khác nhau. Xem bản chữ khi nói, kiểm tra câu bên dưới rồi bấm Confirm & send.':draft?.uncertain?'Có chỗ chưa rõ. Sửa [unclear] hoặc thu âm lại, rồi bấm Confirm & send. AI chưa đoán từ hay trả lời.':'Kiểm tra câu bên dưới, sửa từ nghe nhầm rồi bấm Confirm & send. AI chưa trả lời ở bước này.';
  $('practical-live-original').hidden=!draft?.browserText;$('practical-live-original-text').textContent=draft?.browserText || '';
  mic.disabled=ended || !core.canSend(session,'') || offline || configured===false || !globalThis.HelenVoiceRecorder?.available() || (busy && !['requesting','recording'].includes(phase));
  mic.setAttribute('aria-pressed',String(recording));mic.setAttribute('aria-label',recording?'Stop recording and send reply':'Record a speaking reply');mic.querySelector('span').textContent=recording?'Send recording':'Speak';
  $('practical-retry-recording').hidden=!audioAttempt;$('practical-retry-recording').disabled=disabled;
  $('practical-cancel').hidden=!busy;$('practical-reset').disabled=busy;$('practical-level').disabled=busy;
  $('practical-scenarios').querySelectorAll('button').forEach(button=>button.disabled=busy);
  $('practical-messages').querySelectorAll('.say').forEach(button=>button.disabled=busy || button.getAttribute('aria-busy')==='true');
  $('practical-use-hint').disabled=busy || ended;
  $('practical-end').disabled=busy || offline || configured===false || !session.turns.length || ended;
  $('practical-session-count').textContent=ended?t('Session complete · bắt đầu New session để luyện tiếp.'):t('{count} replies · {words} words · at least 80 words needed for a band estimate.',{count:session.turns.length,words:core.sessionWords(session)});
  $('practical-recording-time').hidden=phase!=='recording';
  $('practical-messages').setAttribute('aria-busy',String(busy));
  $('practical-replay').disabled=busy || ['loading','speaking'].includes(speechPhase);$('practical-stop-voice').disabled=!['loading','speaking'].includes(speechPhase);
  aiVoice.disabled=busy;deviceVoice.disabled=busy;voice.disabled=busy;fallback.disabled=busy;autoSend.disabled=busy;$('practical-retry-voice').disabled=busy;voiceStatus();
 }
 document.querySelector('#target')?.addEventListener('change',()=>{document.querySelectorAll('.practical-reply-translation,.practical-meaning').forEach(detail=>{if(detail.open || detail.closest('details')?.open)void detail.translateSelectedLanguage?.();});});
 function meaningParagraph(text,translation,sourceLanguage='vi'){
  const paragraph=node('p',undefined,'practical-meaning');let language,version=0;
  paragraph.translateSelectedLanguage=async()=>{
   const to=document.querySelector('#target')?.value || 'vi',ticket=++version;
   if(language===to)return;
   if(to==='en'){finishLoading(paragraph,text);language=to;return;}
   if(to===sourceLanguage && translation){finishLoading(paragraph,translation);language=to;return;}
   showLoading(paragraph,t('Translating meaning…'));
   try{const result=(await window.tr(window.HelenQuizTranslation.chunks(text),'en',to)).join(' ');if(ticket===version && document.querySelector('#target')?.value===to){finishLoading(paragraph,result);language=to;}}
   catch{if(ticket===version)finishLoading(paragraph,t('Translation is unavailable. Please try again.'));}
  };
  const to=document.querySelector('#target')?.value || 'vi';
  if(to==='en'){paragraph.textContent=text;language=to;}else if(to===sourceLanguage && translation){paragraph.textContent=translation;language=to;}
  return paragraph;
 }
 function listen(text){const button=node('button','🔊','say');button.type='button';button.setAttribute('aria-label','Listen to this sentence');button.setAttribute('aria-pressed','false');button.onclick=()=>{void partnerAudio?.unlock({device:voice.value==='device' || quotaActive()});void playReply(text,button);};return button;}
 function render(){
  const item=core.scenario(state.scenario);$('practical-level').value=state.level;$('practical-chat-title').textContent=t(item.title);$('practical-goal').textContent=t(item.goal);$('practical-hint').textContent=item.hint;$('practical-settings-summary').textContent=`${t('Conversation settings')} · ${state.level}`;
  $('practical-scenarios').replaceChildren(...core.scenarios.map(item=>{const button=node('button');button.type='button';button.dataset.scenario=item.id;button.setAttribute('aria-pressed',String(item.id===state.scenario));const icon=node('span',item.id==='travel'?undefined:item.icon);icon.setAttribute('aria-hidden','true');if(item.id==='travel')icon.append(travelIcon());button.append(icon,node('strong',t(item.title)));button.onclick=()=>reset(item.id,state.level);return button;}));
  const cards=state.messages.map(turn=>{
   const card=node('article',undefined,'practical-message '+turn.role),head=node('div',undefined,'practical-message-header');head.append(node('strong',turn.role==='user'?'You':'Speaking partner'));
   if(turn.role==='assistant')head.append(listen(turn.text));card.append(head);
   if(turn.text.length>600){const full=node('details');full.append(node('summary','Read full answer'),node('p',turn.text));card.append(node('p',turn.text.slice(0,240)+'…'),full);}else card.append(node('p',turn.text));
   if(turn.role==='assistant'){
    const detail=node('details'),paragraph=node('p'),sourceLanguage=turn.translationLanguage || 'vi';detail.className='practical-reply-translation';
    detail.append(node('summary',t('Translation')),paragraph);card.append(detail);
    let language,version=0;
    const translate=async()=>{if(!detail.open)return;const to=document.querySelector('#target')?.value || 'vi',ticket=++version;
     if(language===to)return;
     if(to==='en'){paragraph.textContent=turn.text;language=to;return;}
     if(to===sourceLanguage && turn.translation){paragraph.textContent=turn.translation;language=to;return;}
     showLoading(paragraph,t('Translating meaning…'));
     try{const value=(await window.tr(window.HelenQuizTranslation.chunks(turn.text),'en',to)).join(' ');if(ticket===version && (document.querySelector('#target')?.value || 'vi')===to){finishLoading(paragraph,value);language=to;}}
     catch{if(ticket===version)finishLoading(paragraph,t('Translation is unavailable. Please try again.'));}
    };detail.addEventListener('toggle',()=>void translate());detail.translateSelectedLanguage=translate;
   }
   if(turn.feedback && typeof turn.feedback.note==='string'){
    const feedback=node('div',undefined,'practical-feedback');feedback.append(node('h3','A little coaching'),node('p',turn.feedback.note));
    if(turn.feedback.partial)feedback.append(node('p','Một vài chỗ sửa chưa đủ rõ nên chưa áp dụng. Câu trả lời gốc vẫn được giữ.','muted'));
    if(typeof turn.feedback.liveTranscript==='string' && turn.feedback.liveTranscript.length<=6000){const original=node('details');original.append(node('summary','Original live captions · bản tạm'),node('p',turn.feedback.liveTranscript));feedback.append(original);}
    const flow=turn.feedback.speakingFlow;
    if(flow?.source==='transcript' && typeof flow.note==='string'){
     const detail=node('details',undefined,'practical-flow');detail.append(node('summary',`Speaking flow${Number.isSafeInteger(flow.fillerCount) && flow.fillerCount>0?` · ${flow.fillerCount} fillers`:''}`),node('p',flow.note));
     if(typeof flow.strategy==='string')detail.append(node('p',flow.strategy));
     if(Array.isArray(flow.restarts) && flow.restarts.length){detail.append(node('strong','Repeated phrases'));for(const quote of flow.restarts.slice(0,3))if(typeof quote==='string')detail.append(node('blockquote',quote));}
     if(Array.isArray(flow.phrases))for(const item of flow.phrases.slice(0,3))if(typeof item?.text==='string' && typeof item.translation==='string'){detail.append(node('strong',item.text),meaningParagraph(item.text,item.translation,turn.feedback.translationLanguage || 'vi'));if(typeof item.purpose==='string')detail.append(node('p',item.purpose,'muted'));}
     if(typeof flow.notice==='string')detail.append(node('p',flow.notice,'muted'));feedback.append(detail);
    }
    if(typeof turn.feedback.improved==='string'){
     if(turn.feedback.improved.length>600){const full=node('details');full.append(node('summary',t('Full suggested answer')),node('blockquote',turn.feedback.improved));feedback.append(full);}
     else feedback.append(node('strong',t('Try saying')),node('blockquote',turn.feedback.improved));
    }
    if(Array.isArray(turn.feedback.corrections) && turn.feedback.corrections.length){
     const list=node('ul');for(const item of turn.feedback.corrections.slice(0,4))if(typeof item?.original==='string' && typeof item.replacement==='string' && typeof item.reason==='string'){
      const edit=node('li');edit.append(node('strong',item.original+' → '+(item.replacement || '(remove)')),node('p',item.reason));list.append(edit);
     }feedback.append(list);
    }
    if(turn.feedback.phrase && typeof turn.feedback.phrase.text==='string'){const detail=node('details');detail.append(node('summary',t('Useful phrase')),node('strong',turn.feedback.phrase.text),meaningParagraph(turn.feedback.phrase.text,turn.feedback.phrase.translation,turn.feedback.translationLanguage || 'vi'));feedback.append(detail);}
    if(Array.isArray(turn.feedback.collocations) && turn.feedback.collocations.length){const detail=node('details');detail.append(node('summary',t('Vocabulary & collocations')));for(const item of turn.feedback.collocations.slice(0,3))if(typeof item?.text==='string' && typeof item.translation==='string' && typeof item.example==='string'){detail.append(node('strong',item.text),meaningParagraph(item.text,item.translation,turn.feedback.translationLanguage || 'vi'),node('blockquote',item.example));}feedback.append(detail);}
    card.append(feedback);
   }
   card.querySelectorAll('.practical-meaning').forEach(paragraph=>{const detail=paragraph.closest('details');detail?.addEventListener('toggle',()=>{if(detail.open)void paragraph.translateSelectedLanguage();});});
   globalThis.HelenPronunciation?.register(turn);return card;
  });$('practical-messages').replaceChildren(...cards);renderReport();controls();
 }
 function renderReport(){
  const box=$('practical-report'),report=session.report;box.hidden=!report;box.replaceChildren();if(!report)return;
  box.append(node('span','SESSION COMPLETE','section-kicker'),node('h3','Your IELTS speaking estimate'),node('strong',report.overall===null?'Partial assessment':`Estimated band · ${report.overall.toFixed(1)}`,'practical-band'),node('p',report.notice),node('p',report.summary));
  const grid=node('div',undefined,'practical-score-grid'),labels={fluency:'Fluency & coherence',vocabulary:'Lexical resource',grammar:'Grammar range & accuracy',pronunciation:'Pronunciation'};
  for(const [key,label] of Object.entries(labels)){const item=report.criteria?.[key];if(!item)continue;const card=node('article');card.append(node('h4',label),node('strong',typeof item.band==='number'?`Band ${item.band.toFixed(1)}`:'Not enough audio'),node('p',item.feedback));if(item.quote)card.append(node('blockquote',item.quote));grid.append(card);}box.append(grid,node('h4','What to practise next'));
  const steps=node('ol');for(const step of report.nextSteps || [])steps.append(node('li',step));box.append(steps,node('p',`${report.coverage?.turns || 0} replies · ${report.coverage?.words || 0} original words · ${report.coverage?.audioSeconds || 0}s audio`));
 }
 async function endSession(){
  if(busy || session.report)return;
  if(draft || input.value.trim()){message('Gửi hoặc xóa câu đang soạn trước khi kết thúc phiên.',true);input.focus();return;}
  if(core.sessionWords(session)<80){message('Hãy nói thêm để đủ ít nhất 80 từ rồi kết thúc phiên.',true);return;}
  if(navigator.onLine===false){message('Cần Internet để chấm phiên mới. Hội thoại vẫn được giữ.',true);return;}
  stopPartner();const ticket=++run;busy=true;phase='assessing';controller=new AbortController();partnerState('thinking');controls();message('Đang đánh giá 4 tiêu chí IELTS từ lời bạn đã nói…',false,true);
  try{const report=await request({stage:'assess',turns:session.turns},controller.signal);if(ticket===run){session.report=report;save();renderReport();message(storageFailed?'Bộ nhớ đầy. Đánh giá chỉ giữ trong phiên này.':'Đã có đánh giá. Đây là band ước lượng để luyện tập.');$('practical-report').focus();}}
  catch(error){if(ticket===run)message(shortError(error,'Chưa đánh giá được. Hội thoại vẫn giữ nguyên; hãy thử lại.'),true);}
  finally{finish(ticket);}
 }
 function reset(id=state.scenario,level=state.level){
  if(busy)return;
  if((state.messages.length>1 || draft) && !confirm('Bắt đầu phiên mới? Cuộc hội thoại và câu đang soạn sẽ được thay thế.')){$('practical-level').value=state.level;return;}
  stopPartner();
  state=core.fresh(id,level);session=core.sessionFrom(state);draft=null;saveDraft();attempt=null;audioAttempt=null;input.value='';save();render();message(navigator.onLine===false?'Đang ngoại tuyến. Xem lại hội thoại; kết nối mạng để luyện với AI.':'Bấm Speak hoặc nhập câu trả lời để bắt đầu.');
 }
 async function check(){
  void loadPartner();
  if(navigator.onLine===false){message('Đang ngoại tuyến. Xem lại hội thoại; kết nối mạng để luyện với AI.');controls();return;}
  if(checking)return checking;
  checking=(async()=>{
   try{const response=await apiFetch('/api/practical/status',{cache:'no-store'}),data=await response.json();if(response.ok){configured=data.configured===true;globalThis.HelenPronunciation?.register(data);if(Number.isSafeInteger(data.dailyReplyLimit))$('practical-daily-limit').textContent=t('{count} AI replies/day per device. Resets at 00:00 UTC. Provider limits apply.',{count:data.dailyReplyLimit});if(!busy && speechPhase==='idle')message(navigator.onLine===false?'Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.':!configured?'Practical AI chưa được bật. Quản trị viên cần cấu hình Gemini.':draft?'Kiểm tra câu đã nghe rồi bấm Confirm & send.':'Bấm Speak hoặc nhập câu trả lời để bắt đầu.');}}
   catch{if(!busy && speechPhase==='idle')message(navigator.onLine===false?'Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.':'Chưa kết nối được AI. Hội thoại đã lưu vẫn xem được; có mạng thì thử gửi lại.',navigator.onLine!==false);}
   finally{checking=null;controls();}
  })();return checking;
 }
 async function request(value,signal,identity){
  const content={scenario:state.scenario,level:state.level,history:core.context(state),...value,translationLanguage:document.querySelector('#target')?.value || 'vi',interfaceLanguage:globalThis.HelenI18n?.locale || 'vi'},fingerprint=JSON.stringify(content);
  const requestId=identity || (value.audio?crypto.randomUUID():(attempt && attempt.fingerprint===fingerprint?attempt.id:(attempt={fingerprint,id:crypto.randomUUID()}).id));
  const started=Date.now(),ticket=run,copy=value.stage==='transcribe'?'Đang chép lời bản thu':value.stage==='assess'?'Đang đánh giá phiên nói':'AI đang đọc câu trả lời và chuẩn bị góp ý';
  const progress=setInterval(()=>{
   const seconds=Math.floor((Date.now()-started)/1000),label=status.querySelector('.loading-copy');
   if(seconds>=5 && seconds%5===0 && ticket===run && !signal?.aborted && label)label.textContent=`${copy} · ${seconds}s. Bạn có thể bấm Cancel để dừng.`;
  },1000);
  try{
   const response=await apiFetch('/api/practical',{method:'POST',headers:{'Content-Type':'application/json','X-Helen-Device':globalThis.HelenPronunciation.device()},body:JSON.stringify({...content,requestId}),signal,timeoutMs:core.requestBudget(value).clientMs});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(data.error || 'Chưa nhận được phản hồi. Hãy thử lại.'),{code:data.code});
   globalThis.HelenPronunciation?.register(data);return data;
  }finally{clearInterval(progress);}
 }
 async function handleTranscript(data,ticket){
  if(ticket!==run)return;liveCapture?.cancel();liveCapture=null;audioAttempt=null;
  if(draft?.source==='live' && draft.edited){draft.source='reviewed-live';draft.uncertain=true;saveDraft();message('Bản thu đã nhận diện; câu bạn chỉnh vẫn được giữ. Kiểm tra rồi Confirm & send.');return;}
  reviewTranscript(data);
  if(autoSend.checked && !draft.uncertain && !/\[unclear\]/i.test(data.transcript)){
   if(!core.canSend(session,data.transcript)){message('Phiên đã đủ dài. Kết thúc để xem band trước khi luyện tiếp.',true);return;}
   recording=false;phase='replying';controller=new AbortController();partnerState('thinking');controls();message('Đã nghe câu của bạn. AI đang trả lời và góp ý…',false,true);
   const result=await request({text:data.transcript},controller.signal);if(ticket===run){accept(result);return result.reply;}
  }
 }
 function recordingError(error){
  const text=shortError(error,'Chưa xử lý được bản thu. Hãy thử lại.');
  const saved=draft?.source==='live' && input.value.trim();
  message(text+(saved?' Chữ đã giữ. Kiểm tra rồi Confirm & send, hoặc Retry recording.':audioAttempt?' Bản thu còn trong tab này. Bấm Retry recording để gửi lại.':''),true);
 }

 function accept(data){session.turns.push({question:state.messages.at(-1).text,text:data.transcript,...(draft?.speechReceipt?{speechReceipt:draft.speechReceipt}:{})});state=core.add(state,{...data,...(draft?.browserText?{liveTranscript:draft.browserText}:draft?.source==='live'?{liveTranscript:input.value}:{})});attempt=null;audioAttempt=null;draft=null;input.value='';saveDraft();save();render();const list=$('practical-messages');list.scrollTop=list.scrollHeight;message(storageFailed?'Bộ nhớ đầy. Hội thoại chỉ giữ trong phiên này.':'Đã có phản hồi. Bạn có thể nghe, xem bản dịch rồi trả lời tiếp.');}
 function finish(ticket,reply){if(ticket!==run)return;busy=false;recording=false;phase='idle';controller=null;partnerState('idle');controls();if(reply && autoplay.checked)void playReply(reply,$('practical-messages').querySelector('.practical-message.assistant:last-child .say'));}
 function cancel(announce=true){
  liveCapture?.cancel();liveCapture=null;saveDraft();audioAttempt=null;stopPartner();if(!busy)return;++run;controller?.abort();if(recording)globalThis.HelenVoiceRecorder?.cancel();busy=false;recording=false;phase='idle';controller=null;partnerState('idle');controls();if(announce)message('Đã dừng. Câu của bạn vẫn giữ nguyên.');
 }
 $('practical-form').addEventListener('submit',async event=>{
  event.preventDefault();const sendLiveNow=busy && phase==='transcribing' && draft?.source==='live';
  if((busy && !sendLiveNow) || session.report || !input.value.trim())return;
  if(!core.canSend(session,input.value)){message('Phiên đã đủ dài. Bấm End & see band rồi mở New session.',true);return;}
  if(/\[unclear\]/i.test(input.value)){message('Sửa phần [unclear] hoặc thu âm lại trước khi gửi.',true);input.focus();return;}
  if(navigator.onLine===false){message('Cần Internet để gửi câu trả lời cho AI.',true);return;}
  if(sendLiveNow)cancel(false);
  stopPartner();void partnerAudio?.unlock({device:voice.value==='device' || quotaActive()});const ticket=++run,value=input.value.trim();let reply;busy=true;phase='replying';controller=new AbortController();globalThis.HelenAudio?.stop();partnerState('thinking');controls();message('AI đang chuẩn bị câu trả lời và góp ý…',false,true);
  try{const data=await request({text:value},controller.signal);if(ticket===run){accept(data);reply=data.reply;}}
  catch(error){if(ticket===run)message(shortError(error,'Chưa kết nối được AI. Hãy thử lại.'),true);}
  finally{finish(ticket,reply);}
 });
 mic.addEventListener('click',()=>{
  const recorder=globalThis.HelenVoiceRecorder;if(recording){if(phase==='requesting')cancel();else {void partnerAudio?.unlock({device:voice.value==='device' || quotaActive()});recorder?.stop();}return;}if(busy || session.report || !core.canSend(session,'') || !recorder?.available())return;
  if(input.value.trim()){message('Gửi hoặc xóa câu đang soạn trước khi thu bản mới.',true);input.focus();return;}
  audioAttempt=null;stopPartner();const ticket=++run;let reply;busy=true;recording=true;phase='requesting';globalThis.HelenAudio?.stop();partnerState('requesting');controls();
  const task=recorder.start({language:'en-US',mode:'conversation',submit:recorded,onState:info=>{
   if(ticket!==run)return;phase=info.state;if(info.state==='recording')$('practical-recording-time').textContent=`${Math.floor((info.elapsedMs || 0)/60000)}:${String(Math.floor((info.elapsedMs || 0)/1000)%60).padStart(2,'0')} / 3:00`;
   if(info.state==='transcribing'){liveCapture?.stop();saveDraft();}controls();
   partnerState(info.state==='recording'?'listening':info.state==='transcribing'?'thinking':'requesting');
   if(info.state==='transcribing')message('Đang chép lại lời bạn nói, chưa sửa câu…',false,true);
   else if(status.textContent!==info.message)message(info.message);
  }});
  liveCapture=captions?.start({language:'en-US',onChange:info=>{
   if(ticket!==run || !['requesting','recording','transcribing'].includes(phase) || !info.text.trim())return;
   if(phase==='transcribing' && draft?.edited){draft.browserText=info.text;}else{draft={scenario:state.scenario,level:state.level,text:info.text,browserText:info.text,uncertain:true,source:'live'};input.value=info.text;input.scrollTop=input.scrollHeight;}
   if(!draftTimer)draftTimer=setTimeout(()=>{draftTimer=null;saveDraft();},700);
  },onState:value=>{if(ticket===run)$('practical-live-status').textContent=['listening','restarting'].includes(value)?'Live captions · chữ tạm, có thể nghe nhầm.':value==='stopped'?'Đã giữ bản chữ khi nói.':'Phụ đề trực tiếp chưa khả dụng. Bản thu vẫn hoạt động; chữ hiện sau khi nhận diện.';}});
  void partnerAudio?.unlock({device:voice.value==='device' || quotaActive()});
  task.then(async data=>{reply=await handleTranscript(data,ticket);}).catch(error=>{if(ticket===run)recordingError(error);}).finally(()=>{if(ticket===run){liveCapture?.cancel();liveCapture=null;saveDraft();finish(ticket,reply);if(draft)input.focus();}});
 });
 // Recognition still gets audio only. Clear speech proceeds automatically;
 // uncertain speech waits for an edit, without contextual guesses.
 function recorded(value,{signal}={}){
  // Keep only the latest clip in this tab's memory, never in persistent storage.
  audioAttempt={value:{...value,stage:'transcribe'},id:crypto.randomUUID()};
  return request(audioAttempt.value,signal,audioAttempt.id);
 }
 $('practical-retry-recording').onclick=async()=>{
  if(busy || !audioAttempt || navigator.onLine===false || session.report)return;
  stopPartner();void partnerAudio?.unlock({device:voice.value==='device' || quotaActive()});const ticket=++run;let reply;
  busy=true;phase='transcribing';controller=new AbortController();partnerState('thinking');controls();message('Đang gửi lại bản thu và chép lời…',false,true);
  try{const data=await request(audioAttempt.value,controller.signal,audioAttempt.id);reply=await handleTranscript(data,ticket);}
  catch(error){if(ticket===run)recordingError(error);}
  finally{finish(ticket,reply);if(ticket===run && draft)input.focus();}
 };
 $('practical-cancel').onclick=()=>cancel();$('practical-reset').onclick=()=>reset();$('practical-end').onclick=()=>void endSession();
 $('practical-level').onchange=()=>reset(state.scenario,$('practical-level').value);
 $('practical-use-hint').onclick=()=>{input.value=core.scenario(state.scenario).hint;input.focus();controls();};
 input.addEventListener('input',()=>{if(draft){draft.text=input.value;draft.edited=true;saveDraft();}controls();});input.addEventListener('keydown',event=>{if(event.key==='Enter' && (event.ctrlKey || event.metaKey)){event.preventDefault();$('practical-form').requestSubmit();}});
 voice.onchange=()=>{stopPartner();put(VOICE,voice.value);voiceChoices();deviceChoices();};
 aiVoice.onchange=()=>{stopPartner();chosenAI=aiVoice.value;put(AI_VOICE,chosenAI);};deviceVoice.onchange=()=>{stopPartner();chosenDevice=deviceVoice.value;put(DEVICE_VOICE,chosenDevice);};
 autoSend.onchange=()=>put(AUTO_SEND,autoSend.checked?'1':'0');
 autoplay.onchange=()=>{put(AUTO,autoplay.checked?'1':'0');if(!autoplay.checked)stopPartner();};
 fallback.onchange=()=>{stopPartner();put(FALLBACK,fallback.checked?'1':'0');voiceStatus();};
 $('practical-retry-voice').onclick=()=>{stopPartner();quotaUntil=0;put(QUOTA_UNTIL,'0');voiceStatus();void partnerAudio?.unlock({device:voice.value==='device' || quotaActive()});const text=[...state.messages].reverse().find(turn=>turn.role==='assistant')?.text;if(text)void playReply(text,$('practical-retry-voice'));};
 $('practical-replay').onclick=()=>{void partnerAudio?.unlock({device:voice.value==='device' || quotaActive()});const text=[...state.messages].reverse().find(turn=>turn.role==='assistant')?.text;if(text)void playReply(text,$('practical-replay'));};
 $('practical-stop-voice').onclick=()=>{stopPartner();message('Đã dừng giọng. Đến lượt bạn.');};
 document.addEventListener('helen:voices',voiceChoices);globalThis.speechSynthesis?.addEventListener?.('voiceschanged',deviceChoices);
 document.addEventListener('helen:voice-selected',()=>{if(aiVoice.value==='preferences')stopPartner();});
 document.addEventListener('helen:app-update-required',()=>{if(input.value.trim() && !session.report){draft ||= {scenario:state.scenario,level:state.level,text:input.value,uncertain:false};saveDraft();}cancel(false);save();});
 document.addEventListener('helen:page-change',event=>{if(event.detail.page==='practical')void check();else cancel(false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel(false);});
 globalThis.addEventListener('pagehide',()=>cancel(false));
 globalThis.addEventListener('helen:speech-ready',controls);globalThis.addEventListener('offline',()=>{cancel(false);controls();message('Đang ngoại tuyến. Hội thoại đã lưu vẫn xem được.');});
 globalThis.addEventListener('online',()=>{if(globalThis.HelenPages?.current()==='practical')void check();});
 globalThis.addEventListener('storage',event=>{
  if([VOICE,AI_VOICE,DEVICE_VOICE,AUTO,AUTO_SEND,FALLBACK,QUOTA_UNTIL].includes(event.key)){
   stopPartner();if(event.key===VOICE && ['device','elevenlabs'].includes(event.newValue))voice.value=event.newValue;
   if(event.key===AI_VOICE)chosenAI=event.newValue;if(event.key===DEVICE_VOICE)chosenDevice=event.newValue || '';if(event.key===AUTO_SEND)autoSend.checked=event.newValue!=='0';if(event.key===AUTO)autoplay.checked=event.newValue!=='0';if(event.key===FALLBACK)fallback.checked=event.newValue!=='0';if(event.key===QUOTA_UNTIL)quotaUntil=Number(event.newValue)||0;voiceChoices();deviceChoices();return;
  }
  if(event.key!==KEY)return;cancel(false);try{state=core.restore(JSON.parse(event.newValue || 'null')) || core.fresh();session=core.restoreSession(JSON.parse(get(SESSION) || 'null'),state);render();message('Hội thoại đã cập nhật từ tab khác.');}catch{}
 });
 render();voiceChoices();deviceChoices();if(globalThis.HelenPages?.current()==='practical')void check();
})();
