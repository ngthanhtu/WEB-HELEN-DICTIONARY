// All image paths, size and defaults come from appearance.json.
// The native cursor is kept until both pictures have successfully loaded.
(async()=>{
  const root=document.documentElement, overlay=document.querySelector('#pet-cursor');
  const pointer=overlay?.querySelector('.pet-pointer'), cursorImage=pointer?.querySelector('img');
  const mascot=document.querySelector('#pet-mascot'), mascotImage=mascot?.querySelector('img');
  const control=document.querySelector('#pet-control'), toggle=document.querySelector('#pet-toggle');
  if(!overlay || !pointer || !cursorImage || !mascot || !mascotImage || !control || !toggle) return;
  let config;
  try {const response=await fetch('/assets/appearance.json',{cache:'no-cache'});if(!response.ok) return;config=await response.json();} catch {return;}
  if(config?.enabled!==true || !['cursor','mascot'].includes(config.mode)) return;
  function imageURL(value) {
    if(typeof value!=='string' || !value.trim()) throw Error('Missing pet image');
    const url=new URL(value,location.href);
    if(!['http:','https:'].includes(url.protocol)) throw Error('Invalid pet image');
    return url.href;
  }
  try {config.idleImage=imageURL(config.idleImage);config.pressedImage=imageURL(config.pressedImage || config.idleImage);} catch {return;}
  const size=Math.min(48,Math.max(24,Number(config.size) || 32));
  const delay=Number(config.pressedHoldMs), hold=Number.isFinite(delay)?Math.min(400,Math.max(0,delay)):180;
  root.style.setProperty('--pet-size',`${size}px`);
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  let enabled=true, ready=false, mode='off', frame=0, lastPosition, pressed=false, pressedUntil=0, timer;
  try {enabled=localStorage.getItem('helen-pet-enabled')!=='false';} catch {}
  const hideCursor=()=>{overlay.hidden=true;root.removeAttribute('data-pet-cursor-active');};
  const resetPicture=()=>{clearTimeout(timer);pressed=false;cursorImage.src=config.idleImage;mascotImage.src=config.idleImage;};
  function showPosition() {
    if(!ready || !enabled || mode!=='cursor' || !lastPosition) return;
    const {x,y}=lastPosition;
    pointer.style.transform=`translate(${x}px,${y}px)`;
    pointer.classList.toggle('is-left',x>innerWidth-size-8);
    pointer.classList.toggle('is-above',y>innerHeight-size-8);
    overlay.hidden=false;root.dataset.petCursorActive='true';
  }
  function applyMode() {
    hideCursor();resetPicture();
    mode=!enabled || !ready?'off':config.mode==='mascot'?'mascot':fine.matches?'cursor':config.touchMode==='mascot'?'mascot':'off';
    mascot.hidden=mode!=='mascot';toggle.checked=enabled;
    control.hidden=!ready || (!fine.matches && config.mode==='cursor' && config.touchMode!=='mascot');
    document.querySelector('#pet-label').textContent=!fine.matches || config.mode==='mascot'?'Dog mascot':'Dog cursor';
    if(mode==='cursor') showPosition();
  }
  function preload(src) {return new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src=src;});}
  // Decorative assets never block dictionary, voice or Gemini requests.
  try {await Promise.all([preload(config.idleImage),preload(config.pressedImage)]);} catch {hideCursor();return;}
  ready=true;control.hidden=false;cursorImage.src=config.idleImage;mascotImage.src=config.idleImage;applyMode();
  toggle.addEventListener('change',()=>{enabled=toggle.checked;try{localStorage.setItem('helen-pet-enabled',String(enabled));}catch{}applyMode();});
  fine.addEventListener('change',applyMode);
  document.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse') return;
    lastPosition={x:event.clientX,y:event.clientY};
    if(!frame) frame=requestAnimationFrame(()=>{frame=0;showPosition();});
  },{passive:true});
  document.addEventListener('pointerdown',event=>{
    if(mode!=='cursor' || event.pointerType!=='mouse' || event.button!==0) return;
    clearTimeout(timer);pressed=true;pressedUntil=performance.now()+hold;
    lastPosition={x:event.clientX,y:event.clientY};showPosition();cursorImage.src=config.pressedImage;
  },{passive:true});
  const release=()=>{if(!pressed)return;pressed=false;timer=setTimeout(()=>{if(!pressed)cursorImage.src=config.idleImage;},Math.max(0,pressedUntil-performance.now()));};
  document.addEventListener('pointerup',release,{passive:true});
  document.addEventListener('pointercancel',()=>{resetPicture();hideCursor();},{passive:true});
  document.documentElement.addEventListener('mouseleave',()=>{hideCursor();resetPicture();});
  window.addEventListener('blur',()=>{hideCursor();resetPicture();});
  document.addEventListener('keydown',event=>{if(event.key==='Tab')hideCursor();});
  mascot.addEventListener('click',()=>{mascotImage.src=mascotImage.src===config.pressedImage?config.idleImage:config.pressedImage;});
})();
