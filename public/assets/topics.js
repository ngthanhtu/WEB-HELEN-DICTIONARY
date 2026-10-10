(()=>{
  'use strict';
  const core=window.HelenTopicsCore,host=document.querySelector('#topic-library');if(!core || !host)return;
  const $=selector=>host.querySelector(selector),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let storage;try{storage=localStorage;}catch{}
  const audioMode=$('#topic-audio-mode');
  let savedAudioMode;try{savedAudioMode=storage?.getItem('helen-topic-audio-mode-v1');}catch{}
  audioMode.value=savedAudioMode==='selected' || !window.HelenDeviceSpeech?.available?'selected':'device';
  audioMode.querySelector('[value="device"]').disabled=!window.HelenDeviceSpeech?.available;
  if(!window.HelenDeviceSpeech?.available)$('#topic-audio-note').textContent='Trình duyệt này chưa hỗ trợ giọng trên thiết bị. Giọng ElevenLabs vẫn dùng được khi có mạng.';
  audioMode.onchange=()=>{window.HelenAudio?.stop();try{storage?.setItem('helen-topic-audio-mode-v1',audioMode.value);}catch{}prepareAudio();};
  let manifest,pack,current,index=0,request=0,loadingManifest,progress=core.read(storage);const packs=new Map(),CACHE='helen-topic-packs-v1';
  const status=message=>{$('#topics-status').removeAttribute('aria-busy');$('#topics-status').textContent=message;};
  async function json(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Chưa tải được bộ từ. Kết nối mạng rồi thử lại.');return await response.json();}catch(error){if(error.name==='TypeError')throw Error(navigator.onLine?'Chưa kết nối được thư viện. Thử lại sau nhé.':'Chủ đề này chưa tải trên thiết bị. Kết nối Internet rồi chọn Save topic offline.');if(error.name==='SyntaxError')throw Error('Chưa đọc được bộ từ. Cập nhật app rồi tải lại nhé.');throw error;}finally{clearTimeout(timer);}}
  async function loadManifest(){
    if(manifest)return; if(loadingManifest)return loadingManifest;
    loadingManifest=(async()=>{window.showLoading?.($('#topics-status'),'Loading topics…');try{const data=await json('/assets/topics/manifest.json');if(data.version!==1 || data.topics?.length!==20 || data.totalWords!==4000)throw Error('Thư viện cần cập nhật.');manifest=data;status('');renderTopics();}catch(error){status(error.name==='AbortError'?'Kết nối chậm. Thử tải lại thư viện nhé.':error.message);$('#topics-grid').innerHTML='<button type="button" class="word-link" id="retry-topics">Retry loading topics</button>';$('#retry-topics').onclick=loadManifest;}finally{loadingManifest=null;}})();return loadingManifest;
  }
  function renderTopics(){
    if(!manifest)return;const filter=$('#topic-filter').value.trim().toLowerCase();
    const list=manifest.topics.filter(t=>`${t.title} ${t.description} ${t.exams.join(' ')}`.toLowerCase().includes(filter));
    $('#topics-grid').innerHTML=list.length?list.map(t=>{const count=Object.keys(progress.lessons).filter(key=>key.startsWith(`${t.id}:`)).length;return `<button class="topic-card" type="button" data-topic="${esc(t.id)}"><span class="section-kicker">${esc(t.exams.join(' · '))}</span><strong>${esc(t.title)}</strong><span>${esc(t.description)}</span><small>200 words · 10 lessons${count?` · ${count}/10 lượt đã luyện`:''}</small><span class="topic-card-action">Explore topic <span aria-hidden="true">↗</span></span></button>`;}).join(''):'<p class="empty-state">Chưa có chủ đề phù hợp. Thử tên chủ đề hoặc IELTS, TOEIC, VSTEP.</p>';
    $('#topics-grid').querySelectorAll('[data-topic]').forEach(button=>button.onclick=()=>openTopic(button.dataset.topic));
  }
  async function openTopic(id){
    const token=++request;current=manifest?.topics.find(t=>t.id===id);if(!current)return;
    pack=null;index=0;$('#topics-catalog').hidden=true;$('#topic-detail').hidden=false;$('#topic-title').textContent=current.title;$('#topic-description').textContent=current.description;$('#topic-words').replaceChildren();$('#topic-lessons').replaceChildren();$('#topic-actions').hidden=true;
    window.showLoading?.($('#topics-status'),'Opening word set…');$('#topic-title').focus({preventScroll:true});
    try{const data=packs.get(id) || core.validate(await json(current.url),id);packs.set(id,data);if(token!==request)return;pack=data;$('#topic-actions').hidden=false;$('#topic-prompts').innerHTML=`<summary>Use it in context</summary><p>Đề luyện tự biên soạn: dùng 3–5 từ trong nhóm để trả lời hoặc viết một đoạn ngắn. Chưa có chấm điểm tự động.</p><ul>${current.prompts.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`;status('');renderLesson();await downloaded();}
    catch(error){if(token!==request)return;status(error.name==='AbortError'?'Kết nối chậm. Thử lại hoặc mở bộ đã tải.':error.message);$('#topic-words').innerHTML='<button class="word-link" type="button" id="retry-pack">Retry opening topic</button>';$('#retry-pack').onclick=()=>openTopic(id);}
  }
  function renderLesson(){
    if(!pack)return;$('#topic-lessons').innerHTML=Array.from({length:10},(_,i)=>`<button type="button" class="word-link" data-lesson="${i}" aria-pressed="${i===index}" aria-label="Lesson ${i+1}${progress.lessons[`${pack.id}:${i}`]?', practised':''}">${i+1}${progress.lessons[`${pack.id}:${i}`]?' ✓':''}</button>`).join('');
    $('#topic-lessons').querySelectorAll('button').forEach(b=>b.onclick=()=>{index=Number(b.dataset.lesson);$('#topic-word-filter').value='';renderLesson();});
    $('#topic-lesson-title').textContent=`Lesson ${index+1} · words ${index*20+1}–${index*20+20}`;
    const last=progress.lessons[`${pack.id}:${index}`];$('#topic-progress').textContent=last?`Lượt gần nhất: ${last.correct}/${last.total} câu đúng. Đây là kết quả một lượt, không phải xác nhận đã thuộc cả 20 từ.`:'20 từ mỗi nhóm. Có thể luyện ngay mà không cần lưu vào kho cá nhân.';
    renderWords();
  }
  function renderWords(){
    if(!pack)return;const filter=$('#topic-word-filter').value.trim().toLowerCase(),list=filter?pack.entries.filter(e=>e.word.includes(filter)):core.lesson(pack,index);
    $('#topic-word-count').textContent=filter?`${list.length} từ khớp trong chủ đề`:'';
    prepareAudio(list);
    $('#topic-words').innerHTML=list.length?list.map(e=>`<article class="topic-word"><div class="topic-word-head"><h3>${esc(e.word)}</h3><span class="study-pos">${esc(e.pos)}</span></div><p>${esc(e.definition)}</p>${e.examples[0]?`<p class="topic-example">“${esc(e.examples[0])}”</p>`:''}<div class="topic-word-actions"><button type="button" class="say" data-hear="${esc(e.word)}" aria-label="Hear ${esc(e.word)}">🔊</button><button type="button" class="eye" data-translate="${esc(e.word)}" aria-expanded="false" aria-label="Translate definition of ${esc(e.word)}">👁</button><button type="button" class="word-link" data-save="${esc(e.word)}" aria-label="Save ${esc(e.word)}">☆ Save</button><button type="button" class="text-action" data-lookup="${esc(e.word)}">Dictionary ↗</button></div><p class="topic-translation" role="status" hidden></p></article>`).join(''):'<p>Không có từ khớp. Thử cách viết khác hoặc mở gợi ý trong Dictionary.</p>';
    $('#topic-words').querySelectorAll('[data-lookup]').forEach(b=>b.onclick=()=>window.HelenDictionary.lookup(b.dataset.lookup));
    $('#topic-words').querySelectorAll('[data-hear]').forEach(b=>b.onclick=()=>window.speak?.(b.dataset.hear,b,{word:b.dataset.hear,device:audioMode.value==='device'}));
    $('#topic-words').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{try{saveWords([pack.entries.find(e=>e.word===b.dataset.save)]);b.textContent='★ Saved';status('Đã lưu từ để ôn theo lịch.');}catch(error){status(error.message);}});
    $('#topic-words').querySelectorAll('[data-translate]').forEach(b=>{
      const e=pack.entries.find(x=>x.word===b.dataset.translate),parts=window.HelenQuizTranslation.chunks(e.definition);
      window.HelenTranslationWarmup?.observe(b,parts,{kind:'definition'});
      b.onclick=async()=>{const p=b.closest('article').querySelector('.topic-translation');if(!p.hidden){p.hidden=true;b.setAttribute('aria-expanded','false');return;}const target=document.querySelector('#target').value || 'vi';p.hidden=false;b.setAttribute('aria-expanded','true');b.disabled=true;window.showLoading?.(p,'Translating meaning…');try{const translated=target==='en'?e.definition:(await window.tr(parts,'en',target,{kind:'definition'})).join(' ');if(document.querySelector('#target').value===target)p.textContent=translated;}catch{if(document.querySelector('#target').value===target)p.textContent='Chưa dịch được. Bấm mắt để đóng rồi thử lại khi có mạng.';}finally{p.removeAttribute('aria-busy');b.disabled=false;}};
    });
  }
  function prepareAudio(entries){if(pack && audioMode.value==='selected' && navigator.onLine!==false)void window.HelenPronunciation?.prepareWords((entries || core.lesson(pack,index)).slice(0,20).map(e=>e.word)).catch(()=>{});}
  function saveWords(entries){window.HelenDictionary.addFavorites(entries.map(e=>e.word));entries.forEach(e=>window.HelenStudy.captureMissing(core.result(e)));}
  async function downloaded(){const id=pack?.id;if(!id)return;let saved=false;try{saved=Boolean(await (await caches.open(CACHE)).match(current.url));}catch{}if(id===pack?.id)$('#download-topic').textContent=saved?'✓ Available offline':'↓ Save topic offline';}
  $('#download-topic').onclick=async event=>{if(!pack)return;const b=event.currentTarget,data=pack,url=current.url;b.disabled=true;try{if(!('caches' in window))throw Error('Trình duyệt chưa hỗ trợ tải ngoại tuyến.');const cache=await caches.open(CACHE);await cache.put(url,new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));if(data.id!==pack?.id)return;b.textContent='✓ Available offline';status(navigator.serviceWorker?.controller?'Đã lưu 200 từ của chủ đề. Định nghĩa và quiz dùng được ngoại tuyến; dịch mới và giọng AI cần mạng.':'Đã lưu bộ từ. Mở lại trang sau khi app cài xong để dùng ngoại tuyến.');}catch(error){status(error.message || 'Chưa lưu được. Kiểm tra dung lượng thiết bị rồi thử lại.');}finally{b.disabled=false;}};
  $('#practice-topic').onclick=()=>{if(!pack)return;try{window.HelenStudy.practiceTopic({id:pack.id,index,title:`${current.title} · Lesson ${index+1}`,results:core.lesson(pack,index).map(core.result)});}catch(error){status(error.message);}};
  $('#save-topic-lesson').onclick=()=>{if(!pack)return;try{saveWords(core.lesson(pack,index));status('Đã lưu nhóm 20 từ. Mở Study → All saved words để ôn theo lịch.');}catch(error){status(error.message);}};
  $('#topic-back').onclick=()=>{request++;$('#topic-detail').hidden=true;$('#topics-catalog').hidden=false;status('');renderTopics();$('#topic-filter').focus({preventScroll:true});};
  $('#topic-filter').oninput=renderTopics;$('#topic-word-filter').oninput=renderWords;
  document.querySelector('#target')?.addEventListener('change',()=>{host.querySelectorAll('.topic-translation').forEach(p=>p.hidden=true);host.querySelectorAll('[data-translate]').forEach(b=>b.setAttribute('aria-expanded','false'));});
  document.addEventListener('helen:topic-completed',event=>{progress=core.completed(progress,event.detail);try{if(!storage)throw Error('storage unavailable');storage.setItem(core.KEY,JSON.stringify(progress));}catch{status('Bộ nhớ đầy. Kết quả chủ đề chỉ giữ trong phiên này.');}renderTopics();renderLesson();});
  document.addEventListener('helen:restore',()=>{progress=core.read(storage);renderTopics();renderLesson();});
  window.addEventListener('storage',e=>{if(e.key===core.KEY){progress=core.read(storage);renderTopics();renderLesson();}});
  document.addEventListener('helen:page-change',e=>{if(e.detail.page==='topics')void loadManifest();});
  if(window.HelenPages.current()==='topics')void loadManifest();
})();
