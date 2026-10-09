(()=>{
  document.addEventListener('helen:page-change',event=>{
    if(event.detail.page!=='dictionary')window.cancelSpeech?.();
  });
  const preferences=document.querySelector('.preferences');
  document.addEventListener('pointerdown',event=>{if(preferences?.open && !preferences.contains(event.target))preferences.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && preferences?.open){preferences.open=false;preferences.querySelector('summary').focus();}});
})();
