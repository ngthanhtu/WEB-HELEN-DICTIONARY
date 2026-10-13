(()=>{
 'use strict';
 const dialog=document.getElementById('app-update-dialog'),button=document.getElementById('confirm-app-update'),note=document.getElementById('app-update-status'),banner=document.getElementById('app-update');
 if(!dialog || !button || !note || !banner)return;
 const build=document.documentElement.dataset.build,valid=value=>typeof value==='string' && /^[a-zA-Z0-9-]{1,40}$/.test(value),KEY='helen-app-build-v1';
 if(!valid(build))return;
 let registration,target=null,busy=false,checking=null,lastCheck=0,retryTimer,retries=0,activationResolve,activationReject;
 const read=()=>{try{return localStorage.getItem(KEY);}catch{return null;}},write=value=>{try{localStorage.setItem(KEY,value);}catch{}};
 const online=()=>navigator.onLine!==false;
 function render(text,error=false){
  note.classList.toggle('error',error);note.setAttribute('role',error?'alert':'status');
  if(busy && typeof showLoading==='function')showLoading(note,text);else {note.textContent=text;note.removeAttribute('aria-busy');}
  button.disabled=busy || !online();button.textContent=busy?'Đang cập nhật…':error?'Thử cập nhật lại · Update app':'Cập nhật ngay · Update app';
  banner.hidden=!target;banner.disabled=busy;
 }
 function show(){
  if(!dialog.open){
   try{dialog.showModal();}catch{dialog.setAttribute('open','');}
   // Native dialog traps focus. Inert also covers browsers with dialog fallback.
   for(const child of document.body.children)if(child!==dialog && !['SCRIPT','STYLE','LINK'].includes(child.tagName))child.inert=true;
   button.focus();
  }
 }
 function offer(value){
  if(!valid(value))return;const first=!target;target=value;show();
  if(first){window.HelenAudio?.stop();document.dispatchEvent(new CustomEvent('helen:app-update-required'));}
  if(!busy)render(online()?'Bấm Update app để cài bản mới nhất rồi tiếp tục sử dụng.':'Cần kết nối Internet để cập nhật. Bật Wi-Fi hoặc dữ liệu di động rồi bấm Update app.');
 }
 dialog.tabIndex=-1;
 dialog.addEventListener('cancel',event=>event.preventDefault());
 dialog.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();(button.disabled?dialog:button).focus();}});
 dialog.addEventListener('close',()=>{if(target)show();});
 dialog.addEventListener('click',event=>{if(event.target===dialog)button.focus();});
 function workerBuild(worker){
  if(!worker || typeof MessageChannel==='undefined')return Promise.resolve(null);
  return new Promise(resolve=>{
   const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);
   channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(valid(event.data?.build)?event.data.build:null);};
   try{worker.postMessage({type:'APP_BUILD'},[channel.port2]);}catch{clearTimeout(timer);channel.port1.close();resolve(null);}
  });
 }
 async function latestBuild(signal){
  const response=await fetch('/api/app-version',{cache:'no-store',signal});if(!response.ok)throw Error('version');
  const data=await response.json();if(!valid(data.build))throw Error('version');return data.build;
 }
 async function inspectWaiting(){
  if(!registration?.waiting || (!navigator.serviceWorker.controller && !registration.active && !target))return;
  const value=await workerBuild(registration.waiting);offer(target || value || build);
 }
 function attach(value){
  if(registration===value){void inspectWaiting();return;}
  registration=value;void inspectWaiting();
  value.addEventListener('updatefound',()=>{
   const worker=value.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')void inspectWaiting();});
  });
 }
 async function check(force=false){
  if(checking || !online() || busy || document.hidden || (!force && Date.now()-lastCheck<20000))return checking;
  lastCheck=Date.now();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  checking=(async()=>{
   try{
    const latest=await latestBuild(controller.signal);retries=0;clearTimeout(retryTimer);
    if(latest!==build || (valid(read()) && read()!==build))offer(latest);
    await inspectWaiting();
    // Request an immediate worker check on visit/resume, rather than waiting
    // for the browser's periodic service-worker update schedule.
    if(registration)void registration.update().catch(()=>{});
   }catch{if(online() && retries<3){const delay=10000*++retries;clearTimeout(retryTimer);retryTimer=setTimeout(()=>void check(true),delay);}
    if(target && !busy)render(online()?'Chưa tải được bản cập nhật. Bấm Update app để thử lại.':'Cần kết nối Internet để cập nhật.',true);}
   finally{clearTimeout(timer);checking=null;}
  })();return checking;
 }
 function bounded(promise,signal){
  return new Promise((resolve,reject)=>{
   const aborted=()=>reject(Error('timeout'));signal.addEventListener('abort',aborted,{once:true});
   if(signal.aborted)aborted();
   Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',aborted));
  });
 }
 async function apply(){
  if(busy || !target)return;
  if(!online()){render('Cần kết nối Internet để cập nhật.',true);return;}
  busy=true;render('Đang tải và kiểm tra bản mới. Từ đã lưu và lịch ôn được giữ nguyên.');
  document.dispatchEvent(new CustomEvent('helen:app-update-required'));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const guard=()=>{if(controller.signal.aborted)throw Error('timeout');};
  try{
   target=await latestBuild(controller.signal);guard();
   if(!navigator.serviceWorker?.controller){write(target);location.reload();return;}
   if(navigator.serviceWorker){
    if(!registration){
     try{attach(await bounded(navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}),controller.signal));}
     catch(error){
      guard();if(navigator.serviceWorker.controller)throw error;
      // Plain web mode can still update when offline installation is blocked.
      write(target);location.reload();return;
     }
    }guard();
    await bounded(registration.update(),controller.signal);guard();
    if(await workerBuild(navigator.serviceWorker.controller)!==target){
     while(!registration.waiting){
      guard();const current=await workerBuild(navigator.serviceWorker.controller);if(current===target)break;
      await new Promise(resolve=>setTimeout(resolve,150));
     }
     guard();
     if(registration.waiting){
      const activated=new Promise((resolve,reject)=>{activationResolve=resolve;activationReject=reject;controller.signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true});});
      registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});await activated;guard();
     }
     const active=await workerBuild(navigator.serviceWorker.controller);guard();
     if(active && active!==target)throw Error('version');
    }
   }
   guard();write(target);location.reload();
  }catch{
   busy=false;render(online()?'Chưa cập nhật xong. Bấm thử lại; dữ liệu học vẫn được giữ.':'Mất kết nối. Bật mạng rồi thử cập nhật lại.',true);
  }finally{clearTimeout(timer);activationResolve=null;activationReject=null;}
 }
 button.addEventListener('click',()=>void apply());banner.addEventListener('click',show);
 navigator.serviceWorker?.addEventListener('controllerchange',()=>{
  if(busy && activationResolve){activationResolve();return;}
  void workerBuild(navigator.serviceWorker.controller).then(value=>{if(value && value!==build)offer(value);});
 });
 window.addEventListener('online',()=>{if(target)render('Đã có mạng. Bấm Update app để tiếp tục.');void check(true);});
 window.addEventListener('offline',()=>{clearTimeout(retryTimer);if(busy)activationReject?.(Error('offline'));if(target && !busy)render('Cần kết nối Internet để cập nhật.',true);});
 window.addEventListener('pageshow',()=>void check());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
 window.HelenAppUpdate={attach,check};
 const previous=read();
 if(valid(previous) && previous!==build && online())offer(build);
 else if(!valid(previous)){
  // Existing installations predate this key. Old shell caches identify the
  // upgrade; first-time visitors already have the current web version.
  void (async()=>{
   let upgrading=false;
   try{upgrading=(await caches.keys()).some(name=>/^helen-[a-zA-Z0-9-]+-shell$/.test(name) && name!==`helen-${build}-shell`);}catch{}
   if(upgrading && online())offer(build);else write(build);
  })();
 }
 void check(true);
})();
