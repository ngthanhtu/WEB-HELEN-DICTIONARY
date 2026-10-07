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
    status.textContent=navigator.onLine?'':'Ngoại tuyến: mở từ, bản dịch và bài AI đã lưu. Micro và giọng ElevenLabs cần mạng.';
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
  if(!('serviceWorker' in navigator)) {
    status.hidden=false;status.textContent='Trình duyệt này chưa hỗ trợ lưu từ ngoại tuyến. Hãy mở bằng Chrome hoặc Safari.';return;
  }
  const library=document.createElement('details');library.className='offline-library';
  library.innerHTML='<summary>Saved offline <span id="offline-count">(0)</span></summary><p id="offline-summary" role="status">Đang kiểm tra dữ liệu trên thiết bị…</p><div class="offline-word-list"></div><button class="word-link" id="download-offline-pack" type="button" disabled>Download offline pack</button><p class="offline-note">Lưu tối đa 100 mục tra. Bấm mắt hoặc tạo AI khi có mạng để lưu thêm bản dịch và bài học. Từ mới, micro và ElevenLabs cần Internet.</p>';
  document.querySelector('.app-tools').insertAdjacentElement('afterend',library);
  const packButton=library.querySelector('#download-offline-pack'), summary=library.querySelector('#offline-summary'), list=library.querySelector('.offline-word-list');
  const packDialog=document.createElement('dialog');packDialog.className='offline-dialog';
  packDialog.innerHTML='<h2>Offline pack</h2><p>Tải bộ từ tiếng Anh thông dụng và nghĩa tiếng Việt về thiết bị này? Chỉ tải khi bạn xác nhận; không gọi dịch vụ AI hay giọng đọc.</p><p>Các câu định nghĩa chỉ có bản dịch nếu bạn đã bấm mắt khi có mạng.</p><div class="offline-actions"><button class="btn" id="confirm-offline-pack" type="button">Download</button><button class="word-link" id="cancel-offline-pack" type="button">Cancel</button></div>';
  document.body.append(packDialog);
  library.addEventListener('toggle',()=>{if(library.open)refreshLibrary();});
  library.querySelector('#download-offline-pack').addEventListener('click',()=>showDialog(packDialog));
  packDialog.querySelector('#cancel-offline-pack').addEventListener('click',()=>closeDialog(packDialog));
  function workerMessage(data) {
    return new Promise((resolve,reject)=>{
      const worker=navigator.serviceWorker.controller || registration?.active;
      if(!worker || typeof MessageChannel==='undefined') {reject(new Error('Ngoại tuyến chưa sẵn sàng. Tải lại trang một lần.'));return;}
      const channel=new MessageChannel(), timer=setTimeout(()=>{channel.port1.close();reject(new Error('Chưa lưu được dữ liệu. Hãy thử lại.'));},3000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      try {worker.postMessage(data,[channel.port2]);}catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
    });
  }
  function localCount(key,field) {
    try {const values=JSON.parse(localStorage.getItem(key) || '[]');return Array.isArray(values)?values.filter(value=>value && (field?value[field]:value.data)).length:0;}catch{return 0;}
  }
  async function refreshLibrary() {
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
