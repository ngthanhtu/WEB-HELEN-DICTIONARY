(()=>{
  const install=document.querySelector('#install-app'), help=document.querySelector('#install-help');
  const status=document.querySelector('#connection-status'), update=document.querySelector('#app-update');
  let prompt, registration;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  const syncInstall=()=>{install.hidden=standalone();};
  function connection() {
    status.hidden=navigator.onLine;
    status.textContent=navigator.onLine?'':'Đang mất mạng. Có thể mở lại từ và bài AI đã lưu trên thiết bị này.';
  }
  syncInstall();connection();
  matchMedia('(display-mode: standalone)').addEventListener('change',syncInstall);
  window.addEventListener('online',()=>{connection();window.loadVoices?.();window.loadAIStatus?.();});window.addEventListener('offline',connection);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
  window.addEventListener('appinstalled',()=>{prompt=null;install.hidden=true;});
  install.addEventListener('click',async()=>{
    if(prompt) {await prompt.prompt();await prompt.userChoice;prompt=null;return;}
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    document.querySelector('#install-steps').textContent=ios
      ? 'iPhone/iPad: mở website trong Safari → Chia sẻ (Share) → Thêm vào Màn hình chính (Add to Home Screen) → Thêm. Nếu có tùy chọn Open as Web App, hãy bật.'
      : 'Android: mở website bằng Chrome → menu ⋮ → Cài đặt ứng dụng (Install app) hoặc Thêm vào màn hình chính. Trên máy tính: dùng biểu tượng Install trong thanh địa chỉ Chrome/Edge. Nếu chưa thấy, tải lại trang một lần.';
    help.showModal();
  });
  document.querySelector('#close-install').addEventListener('click',()=>help.close());
  if(!('serviceWorker' in navigator)) return;
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
  update.addEventListener('click',()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}});
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(value=>{
    registration=value;
    const offer=()=>{if(value.waiting && navigator.serviceWorker.controller)update.hidden=false;};
    offer();value.addEventListener('updatefound',()=>{const worker=value.installing;worker?.addEventListener('statechange',offer);});
  }).catch(()=>{status.hidden=false;status.textContent='Chưa bật được lưu ngoại tuyến. Website vẫn dùng được khi có Internet.';});
})();
