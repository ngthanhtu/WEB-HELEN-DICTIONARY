(function(root) {
  function create({input,list,language,fetch:request,api='',onSelect}) {
    let timer,controller,version=0,items=[],active=-1,composing=false;
    const cache=new Map();
    function close() {
      clearTimeout(timer);controller?.abort();version++;items=[];active=-1;
      list.replaceChildren();list.hidden=true;input.setAttribute('aria-expanded','false');
      input.removeAttribute('aria-activedescendant');
    }
    function highlight(index) {
      active=index;
      [...list.children].forEach((row,i)=>row.setAttribute('aria-selected',String(i===active)));
      if(active>=0){input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView?.({block:'nearest'});}
      else input.removeAttribute('aria-activedescendant');
    }
    function select(index) {
      const word=items[index];if(!word)return;
      input.value=word;close();onSelect(word);
    }
    function render(values) {
      items=values.filter(word=>typeof word==='string' && word.length<=100).slice(0,8);active=-1;
      list.replaceChildren();input.removeAttribute('aria-activedescendant');
      for(const [index,word] of items.entries()) {
        const row=input.ownerDocument.createElement('div');row.id=`search-suggestion-${index}`;
        row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.textContent=word;
        row.addEventListener('pointerdown',event=>event.preventDefault());
        row.addEventListener('click',()=>select(index));list.append(row);
      }
      list.hidden=!items.length;input.setAttribute('aria-expanded',String(Boolean(items.length)));
    }
    function schedule() {
      close();if(composing || language.value!=='en')return;
      const word=input.value.trim().toLowerCase();if(word.length<2 || word.length>48)return;
      const current=version;
      if(cache.has(word)){render(cache.get(word));return;}
      timer=setTimeout(async()=>{
        controller=new AbortController();
        try {
          const response=await request(`${api}/api/suggestions?word=${encodeURIComponent(word)}`,{signal:controller.signal});
          if(!response.ok)return;const data=await response.json();
          if(current!==version || language.value!=='en' || input.value.trim().toLowerCase()!==word)return;
          const values=Array.isArray(data.suggestions)?data.suggestions:[];
          cache.set(word,values);if(cache.size>100)cache.delete(cache.keys().next().value);
          render(values);
        } catch {} // Suggestions are optional; typing and normal lookup stay available offline.
      },180);
    }
    input.addEventListener('input',schedule);
    input.addEventListener('focus',schedule);
    input.addEventListener('compositionstart',()=>{composing=true;close();});
    input.addEventListener('compositionend',()=>{composing=false;schedule();});
    input.addEventListener('blur',()=>{setTimeout(()=>{if(input.ownerDocument.activeElement!==input)close();},150);});
    language.addEventListener('change',close);
    input.addEventListener('keydown',event=>{
      if(event.isComposing || composing)return;
      if(event.key==='Escape'){close();return;}
      if(list.hidden || !items.length)return;
      if(event.key==='ArrowDown' || event.key==='ArrowUp') {
        event.preventDefault();highlight((active+(event.key==='ArrowDown'?1:active<0?0:-1)+items.length)%items.length);
      } else if(event.key==='Enter' && active>=0){event.preventDefault();select(active);}
    });
    return {close};
  }
  root.HelenAutocomplete={create};
  if(typeof module!=='undefined')module.exports={create};
})(typeof window==='undefined'?globalThis:window);
