/* Separate destinations, one persistent app shell: moving pages keeps a quiz
   and a dictionary result alive without fetching them again. */
(()=>{
  'use strict';
  const pages={'/':'dictionary','/study':'study','/topics':'topics','/words':'words','/history':'history','/offline':'offline'};
  const titles={dictionary:'Dictionary',study:'Study',topics:'Topics',words:'My words',history:'History',offline:'Offline'};
  const legacy={'#lookup':'/','#study':'/study','#library':'/words'};
  const path=value=>value==='/'?'/':value.toLowerCase().replace(/\/$/,'');
  const destination=()=>legacy[location.hash] || path(location.pathname);
  let active=pages[destination()] || 'dictionary',ready=false;
  document.documentElement.dataset.page=active;
  function render({focus=false,scroll=false,notify=true,restore=true}={}){
    document.documentElement.dataset.page=active;
    document.title=`${titles[active]} · Helen Dictionary`;
    const current=document.getElementById(`page-${active}`);
    document.querySelectorAll('[data-app-page]').forEach(page=>page.hidden=page.dataset.appPage!==active);
    document.querySelectorAll('.main-nav [data-page-link]').forEach(link=>{
      if(pages[path(new URL(link.href,location.origin).pathname)]===active)link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('.skip-link')?.setAttribute('href',`#page-${active}`);
    const preferences=document.querySelector('.preferences');if(preferences)preferences.open=false;
    if(scroll)window.scrollTo({top:0,behavior:'instant'});
    if(focus){const target=current?.querySelector('h1') || current;if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
    if(notify)document.dispatchEvent(new CustomEvent('helen:page-change',{detail:{page:active,restore}}));
  }
  function go(value,options={}){
    const url=new URL(value,location.origin),next=pages[path(url.pathname)];
    if(url.origin!==location.origin || !next)return false;
    const changed=active!==next;active=next;
    if(location.pathname!==url.pathname || location.hash)window.history.pushState({helenPage:active},'',url.pathname+url.search);
    if(ready)render({...options,notify:changed});
    else document.documentElement.dataset.page=active;
    return true;
  }
  window.HelenPages={go,current:()=>active};
  document.addEventListener('DOMContentLoaded',()=>{
    ready=true;if(legacy[location.hash])window.history.replaceState({helenPage:active},'',legacy[location.hash]);
    render({notify:false});
  },{once:true});
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-page-link]');
    if(!link || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.download || (link.target && link.target!=='_self'))return;
    if(go(link.href,{focus:true,scroll:true}))event.preventDefault();
  });
  window.addEventListener('popstate',()=>{active=pages[destination()] || 'dictionary';render({focus:true,scroll:true});});
  window.addEventListener('hashchange',()=>{
    if(legacy[location.hash])go(legacy[location.hash],{focus:true,scroll:true});
  });
})();
