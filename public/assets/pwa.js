(()=>{
  const install=document.querySelector('#install-app'), help=document.querySelector('#install-help');
  const status=document.querySelector('#connection-status'), update=document.querySelector('#app-update');
  if(!install || !help || !status || !update)return;
  let prompt, registration, reloading=false, latest=null, pendingSave=false;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  const syncInstall=()=>{install.hidden=standalone();};
  const showDialog=dialog=>{if(dialog.showModal)dialog.showModal();else {dialog.setAttribute('open','');dialog.hidden=false;}};
  const closeDialog=dialog=>{if(dialog.close)dialog.close();else {dialog.removeAttribute('open');dialog.hidden=true;}};
  function connection() {
    status.hidden=navigator.onLine;
    status.textContent=navigator.onLine?'':'Ngoại tuyến: mở từ, bản dịch, bài AI và âm thanh đã lưu. Micro và nội dung mới cần mạng.';
  }
  syncInstall();connection();
  matchMedia('(display-mode: standalone)').addEventListener('change',syncInstall);
  window.addEventListener('online',()=>{connection();window.loadVoices?.();window.loadAIStatus?.();window.HelenVoiceRecorder?.refresh?.();refreshLibrary();});
  window.addEventListener('offline',()=>{connection();refreshLibrary();});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;syncInstall();});
  window.addEventListener('appinstalled',()=>{prompt=null;install.hidden=true;});
  install.addEventListener('click',async()=>{
    if(prompt) {
      try {await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')install.hidden=true;}
      catch {status.hidden=false;status.textContent='Chưa cài được. Mở menu trình duyệt → Thêm vào màn hình chính.';}
      prompt=null;return;
    }
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    document.querySelector('#install-steps').textContent=ios
      ? 'Cài miễn phí, không cần App Store. Mở trong Safari → Chia sẻ → Thêm vào Màn hình chính → Thêm. Bật Open as Web App nếu có.'
      : 'Cài miễn phí từ web. Chrome → menu ⋮ → Cài đặt ứng dụng hoặc Thêm vào màn hình chính → xác nhận Cài đặt. Không cần CH Play.';
    showDialog(help);
  });
  document.querySelector('#close-install').addEventListener('click',()=>closeDialog(help));
  const library=document.createElement('details');library.className='offline-library';
  library.innerHTML='<summary>Saved offline <span id="offline-count">(0)</span></summary><p id="offline-summary" role="status">Đang kiểm tra dữ liệu trên thiết bị…</p><div class="offline-word-list"></div><button class="word-link" id="download-offline-pack" type="button" disabled>Download offline pack</button><p class="offline-note">Lưu tối đa 100 mục tra. Bấm mắt hoặc tạo AI khi có mạng để lưu thêm bản dịch và bài học. Từ mới và micro cần Internet.</p>';
  document.querySelector('.app-tools').insertAdjacentElement('afterend',library);
  // Keep the primary audio action visible beside the learning tools, even when
  // Saved offline is collapsed or service-worker installation has not finished.
  const audioPanel=document.createElement('section');audioPanel.id='offline-pronunciation';audioPanel.className='offline-audio';audioPanel.setAttribute('aria-label','Offline pronunciation');
  audioPanel.innerHTML='<div class="offline-audio-heading"><span class="offline-audio-icon" aria-hidden="true">🔊</span><div><h3>Offline pronunciation</h3><p id="offline-audio-summary" role="status">Âm thanh đã nghe được lưu tự động trên thiết bị.</p></div></div><div class="offline-actions"><button class="btn" id="download-favorite-audio" type="button">↓ Save favorite audio</button><button class="word-link" id="cancel-favorite-audio" type="button" hidden>Stop</button><button class="word-link" id="clear-offline-audio" type="button">Clear audio</button></div><p id="offline-audio-progress" role="status"></p><details class="offline-audio-help"><summary>How it works</summary><p class="offline-note">Lưu giọng của tối đa 10 từ yêu thích mỗi lượt, dùng hạn mức ElevenLabs. Chỉ tải giọng đang chọn; từ và câu đã nghe mở lại không cần mạng. Tối đa 100 âm thanh / 20 MiB. Xoá âm thanh không xoá từ hoặc lịch ôn.</p></details>';
  (document.querySelector('.learning-tools') || library).insertAdjacentElement('afterend',audioPanel);
  const packButton=library.querySelector('#download-offline-pack'), summary=library.querySelector('#offline-summary'), list=library.querySelector('.offline-word-list');
  const packDialog=document.createElement('dialog');packDialog.className='offline-dialog';
  packDialog.innerHTML='<h2>Offline pack</h2><p>Tải bộ từ tiếng Anh thông dụng và nghĩa tiếng Việt về thiết bị này? Chỉ tải khi bạn xác nhận; không gọi dịch vụ AI hay giọng đọc.</p><p>Các câu định nghĩa chỉ có bản dịch nếu bạn đã bấm mắt khi có mạng.</p><div class="offline-actions"><button class="btn" id="confirm-offline-pack" type="button">Download</button><button class="word-link" id="cancel-offline-pack" type="button">Cancel</button></div>';
  document.body.append(packDialog);
  const audioStore=window.HelenOfflineAudio,audioButton=audioPanel.querySelector('#download-favorite-audio'),audioSummary=audioPanel.querySelector('#offline-audio-summary'),audioProgress=audioPanel.querySelector('#offline-audio-progress'),audioStop=audioPanel.querySelector('#cancel-favorite-audio'),audioClear=audioPanel.querySelector('#clear-offline-audio');
  let audioController=null,audioVoice='',audioWords=[];
  const audioDialog=document.createElement('dialog');audioDialog.className='offline-dialog';
  audioDialog.innerHTML='<h2>Save favorite audio</h2><p id="offline-audio-confirm-copy"></p><p>Dùng hạn mức ElevenLabs. Không đổi giọng tự động. Mỗi lượt tải tối đa 10 từ; bạn có thể dừng bất cứ lúc nào.</p><div class="offline-actions"><button class="btn" id="confirm-favorite-audio" type="button">Download</button><button class="word-link" id="cancel-audio-dialog" type="button">Cancel</button></div>';
  document.body.append(audioDialog);
  const favoriteWords=()=>{try{const value=JSON.parse(localStorage.getItem('helen-favorites') || '[]');return Array.isArray(value)?value:[];}catch{return [];}};
  const chosenVoice=()=>typeof selectedVoice==='string'?selectedVoice:document.querySelector('#voice').value;
  async function refreshAudio(){
    const clips=await audioStore?.inventory() || [],bytes=clips.reduce((sum,clip)=>sum+clip.bytes,0);
    audioSummary.textContent=audioStore?.available?`${clips.length} âm thanh · ${(bytes/1024/1024).toFixed(1)} MiB · ${clips.filter(clip=>clip.voice===chosenVoice()).length} cho giọng đang chọn.`:'Trình duyệt chưa hỗ trợ lưu âm thanh ngoại tuyến.';
    // Explain missing prerequisites on tap instead of leaving a dead disabled
    // button. Only an active download prevents another batch.
    audioButton.disabled=Boolean(audioController);
    audioClear.disabled=Boolean(audioController) || !clips.length;
  }
  document.querySelector('#voice').addEventListener('change',refreshAudio);
  document.addEventListener('helen:voices',refreshAudio);
  document.addEventListener('helen:favorites',refreshAudio);
  document.addEventListener('helen:audio-saved',refreshAudio);
  window.addEventListener('pageshow',refreshAudio);
  window.addEventListener('storage',event=>{if(['helen-favorites','helen-voice'].includes(event.key))refreshAudio();});
  refreshAudio();
  audioDialog.querySelector('#cancel-audio-dialog').onclick=()=>closeDialog(audioDialog);
  audioButton.onclick=async()=>{
    if(audioController)return;
    if(!audioStore?.available){audioProgress.textContent='Trình duyệt chưa hỗ trợ lưu âm thanh. Hãy dùng Safari hoặc Chrome qua HTTPS.';return;}
    if(!navigator.onLine){audioProgress.textContent='Cần có mạng để tải âm thanh mới. Những âm thanh đã lưu vẫn nghe được.';return;}
    if(!favoriteWords().length){audioProgress.textContent='Bấm ☆ cạnh một từ để lưu vào Từ yêu thích, rồi chọn Save favorite audio.';return;}
    audioVoice=chosenVoice();if(!audioVoice){audioProgress.textContent='Chọn một giọng trong ô Voice phía trên, rồi thử lại.';return;}
    const label=document.querySelector('#voice').selectedOptions?.[0]?.textContent || audioVoice;
    audioWords=[...favoriteWords()];const planned=await audioStore.plan(audioWords,audioVoice);
    if(!planned.remaining){audioProgress.textContent='Đã lưu giọng đọc của tất cả từ yêu thích cho giọng này.';return;}
    audioDialog.querySelector('#offline-audio-confirm-copy').textContent=`Tải ${planned.words.length} từ bằng ${label} (${planned.words.join(', ')}). ${planned.cached} từ đã có âm thanh; ${planned.remaining} từ còn cần tải.`;
    showDialog(audioDialog);
  };
  audioStop.onclick=()=>audioController?.abort();
  window.addEventListener('pagehide',()=>audioController?.abort());
  audioClear.onclick=()=>{
    const dialog=document.createElement('dialog');dialog.className='offline-dialog';
    dialog.innerHTML='<h2>Clear saved audio?</h2><p>Chỉ xoá âm thanh trên thiết bị này. Từ đã lưu, bài AI và lịch ôn được giữ.</p><div class="offline-actions"><button class="btn" type="button">Clear audio</button><button class="word-link" type="button">Cancel</button></div>';
    const [clear,cancel]=dialog.querySelectorAll('button');cancel.onclick=()=>{closeDialog(dialog);dialog.remove();};
    clear.onclick=async()=>{clear.disabled=true;const removed=await audioStore.clear();audioProgress.textContent=removed?'Đã xoá âm thanh. Từ và lịch ôn được giữ.':'Chưa xoá được. Hãy thử lại.';closeDialog(dialog);dialog.remove();await refreshAudio();};
    document.body.append(dialog);showDialog(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  };
  audioDialog.querySelector('#confirm-favorite-audio').onclick=async()=>{
    if(audioController)return;
    closeDialog(audioDialog);audioController=new AbortController();audioStop.hidden=false;audioButton.disabled=true;audioClear.disabled=true;
    try{
      const outcome=await audioStore.download({words:audioWords,voice:audioVoice,signal:audioController.signal,online:()=>navigator.onLine,
        fetchAudio:(text,voice,signal)=>window.HelenPronunciation.request(text,voice,{word:text,signal}),
        onProgress:progress=>{if(!progress.done)showLoading(audioProgress,`Saving ${progress.saved+1}/${progress.total}: ${progress.text}`);}
      });
      audioProgress.textContent=`Đã lưu ${outcome.saved}/${outcome.total} âm thanh.${outcome.cancelled?' Đã dừng.':''}${outcome.message?` ${outcome.message}`:''}`;
    }catch{audioProgress.textContent='Chưa tải được. Âm thanh đã lưu vẫn được giữ; hãy thử lại.';}
    finally{audioController=null;audioStop.hidden=true;audioProgress.removeAttribute('aria-busy');await refreshAudio();}
  };
  library.addEventListener('toggle',()=>{if(library.open)refreshLibrary();});
  library.querySelector('#download-offline-pack').addEventListener('click',()=>showDialog(packDialog));
  packDialog.querySelector('#cancel-offline-pack').addEventListener('click',()=>closeDialog(packDialog));
  function workerMessage(data) {
    return new Promise((resolve,reject)=>{
      const worker=navigator.serviceWorker?.controller || registration?.active;
      if(!worker || typeof MessageChannel==='undefined') {reject(new Error('Ngoại tuyến chưa sẵn sàng. Tải lại trang một lần.'));return;}
      const channel=new MessageChannel(), timer=setTimeout(()=>{channel.port1.close();reject(new Error('Chưa lưu được dữ liệu. Hãy thử lại.'));},3000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      try {worker.postMessage(data,[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
    });
  }
  window.HelenPWA={saveWords:async entries=>{
    const outcome=await workerMessage({type:'SAVE_OFFLINE_PACK',pack:{version:1,entries}});
    await refreshLibrary();return outcome;
  }};
  function localCount(key,field) {
    try {const values=JSON.parse(localStorage.getItem(key) || '[]');return Array.isArray(values)?values.filter(value=>value && (field?value[field]:value.data)).length:0;}catch{return 0;}
  }
  async function refreshLibrary() {
    await refreshAudio();
    try {
      const {words=[]}=await workerMessage({type:'OFFLINE_WORDS'});
      library.querySelector('#offline-count').textContent=`(${words.length})`;
      summary.textContent=`${words.length} mục tra · ${localCount('helen-translations','values')} bản dịch · ${localCount('helen-ai-contexts')} bài AI đã lưu trên thiết bị này.`;
      list.replaceChildren();
      words.forEach(item=>{
        const button=document.createElement('button');button.type='button';button.className='word-link';
        button.textContent=item.from==='en'?item.word:`${item.query} → ${item.word}`;
        button.title=item.partial?'Đã lưu định nghĩa; dữ liệu bổ sung có thể chưa đầy đủ.':'Mở dữ liệu đã lưu';
        button.onclick=()=>{
          const q=document.querySelector('#q'), from=document.querySelector('#from'), form=document.querySelector('#form');
          q.value=item.query || item.word;from.value=item.from || 'en';
          if(form.requestSubmit)form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
        };list.append(button);
      });
      if(!words.length)list.textContent='Tra một từ khi có mạng hoặc tải bộ từ bên dưới.';
      packButton.disabled=false;
    } catch(error) {summary.textContent=error.message;}
  }
  async function saveCurrent() {
    if(pendingSave || !latest || latest.result?.savedOnDevice)return;
    const current=latest;pendingSave=true;
    try {await workerMessage({type:'SAVE_LOOKUP',...current});if(library.open)await refreshLibrary();}
    catch { /* The worker will retry the first result once installation finishes. */ }
    finally {pendingSave=false;if(latest!==current)saveCurrent();}
  }
  document.addEventListener('helen:lookup',event=>{if(event.detail?.result && event.detail.url){latest=event.detail;saveCurrent();}});
  // The first lookup may finish before this deferred script and the worker start.
  function captureCurrent() {
    if(typeof lastResult!=='undefined' && lastResult?.entries?.length) {
      latest={result:lastResult,url:`/api/lookup?word=${encodeURIComponent(lastResult.query || lastResult.word)}&from=${encodeURIComponent(lastResult.from || 'en')}`};saveCurrent();
    }
  }
  packDialog.querySelector('#confirm-offline-pack').addEventListener('click',async()=>{
    closeDialog(packDialog);packButton.disabled=true;
    if(typeof showLoading==='function')showLoading(summary,'Downloading offline words…');else summary.textContent='Đang tải bộ từ ngoại tuyến…';summary.setAttribute('aria-busy','true');
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),6500);
    try {
      if(!navigator.onLine)throw new Error('Cần có mạng để tải bộ từ lần đầu.');
      const response=await fetch('/assets/offline-basics.json',{signal:controller.signal});if(!response.ok)throw new Error('Chưa tải được bộ từ. Hãy thử lại.');
      const pack=await response.json(), outcome=await workerMessage({type:'SAVE_OFFLINE_PACK',pack});
      await refreshLibrary();summary.textContent=`Đã thêm ${outcome.added} từ dùng ngoại tuyến. Những từ đã lưu được giữ nguyên.`;
    } catch(error) {summary.textContent=controller.signal.aborted?'Kết nối chậm. Hãy thử tải bộ từ lại.':error.message;}
    finally {clearTimeout(timer);packButton.disabled=false;summary.removeAttribute('aria-busy');}
  });
  if(!('serviceWorker' in navigator)) {
    status.hidden=false;status.textContent='Trình duyệt này chưa hỗ trợ lưu từ ngoại tuyến. Hãy mở bằng Chrome hoặc Safari.';packButton.disabled=true;summary.textContent='Lưu từ ngoại tuyến chưa sẵn sàng.';return;
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();else {captureCurrent();refreshLibrary();}});
  update.addEventListener('click',()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}});
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(value=>{
    registration=value;
    const offer=()=>{
      if(!value.waiting || !navigator.serviceWorker.controller)return;
      update.hidden=false;
      const refreshing=performance.getEntriesByType?.('navigation')[0]?.type==='reload';
      if(refreshing && !document.querySelector('#study')?.dataset.session){reloading=true;value.waiting.postMessage({type:'ACTIVATE_UPDATE'});}
    };
    offer();value.addEventListener('updatefound',()=>{const worker=value.installing;worker?.addEventListener('statechange',offer);});
    return navigator.serviceWorker.ready;
  }).then(value=>{registration=value;captureCurrent();refreshLibrary();}).catch(()=>{
    status.hidden=false;status.textContent='Chưa bật được lưu ngoại tuyến. Kết nối mạng rồi tải lại trang.';
    summary.textContent='Ngoại tuyến chưa sẵn sàng.';packButton.disabled=true;
  });
  captureCurrent();
})();
