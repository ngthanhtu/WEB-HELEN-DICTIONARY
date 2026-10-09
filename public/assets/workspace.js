(()=>{
  document.querySelectorAll('a[href="#study"],a[href="#library"],a[href="#lookup"]').forEach(link=>link.addEventListener('click',()=>{
    const target=document.querySelector(link.getAttribute('href'));if(!target)return;
    if(target.tagName==='DETAILS')target.open=true;
    if(target.id==='library')target.querySelector('details').open=true;
    requestAnimationFrame(()=>{const focus=target.id==='lookup'?target.querySelector('#q'):target.querySelector('summary');focus?.focus({preventScroll:true});});
  }));
  const preferences=document.querySelector('.preferences');
  document.addEventListener('pointerdown',event=>{if(preferences?.open && !preferences.contains(event.target))preferences.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && preferences?.open){preferences.open=false;preferences.querySelector('summary').focus();}});
})();
