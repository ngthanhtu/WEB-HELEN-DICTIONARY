(function(root) {
  function create({input,list,status,language,fetch:request,api='',onSelect,localWords=()=>[],loading}) {
    let timer,blurTimer,controller,version=0,items=[],active=-1,composing=false,submitted=false,pending='';
    const cache=new Map();
    function message(text,busy=false){
      if(!status)return;
      status.hidden=!text;status.removeAttribute('aria-busy');
      if(busy && loading)loading(status,text);else status.textContent=text;
    }
    function close() {
      clearTimeout(timer);clearTimeout(blurTimer);controller?.abort();version++;items=[];active=-1;submitted=false;pending='';message('');
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
      // Commit a composing keyboard before replacing its draft with the option.
      if(composing){input.blur?.();composing=false;}
      input.value=word;close();onSelect(word);
    }
    function render(values) {
      items=[...new Set(values.filter(word=>typeof word==='string' && word.trim() && word.length<=100))].slice(0,8);active=-1;
      list.replaceChildren();input.removeAttribute('aria-activedescendant');
      for(const [index,word] of items.entries()) {
        const row=input.ownerDocument.createElement('div');row.id=`search-suggestion-${index}`;
        row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.textContent=word;
        row.addEventListener('pointerdown',event=>event.preventDefault());
        row.addEventListener('click',()=>select(index));list.append(row);
      }
      list.hidden=!items.length;input.setAttribute('aria-expanded',String(Boolean(items.length)));
    }
    function schedule({immediate=false,submitted:keepOpen=false}={}) {
      const word=input.value.trim().toLowerCase();
      if(language.value!=='en' || word.length<2 || word.length>48){close();return;}
      // Some mobile/Telex keyboards keep composing until space or backspace.
      // Their input text is already useful for suggestions; only Enter selection
      // must wait for compositionend. Duplicate input/compositionend events must
      // not restart the same request.
      if(pending===word){submitted=keepOpen || submitted;clearTimeout(blurTimer);return;}
      const previous=items;
      clearTimeout(timer);clearTimeout(blurTimer);controller?.abort();version++;pending='';active=-1;submitted=keepOpen;message('');
      const current=version;submitted=keepOpen;
      if(cache.has(word)){render(cache.get(word));return;}
      const known=[...previous,...localWords(),...[...cache.values()].flat()].filter(value=>typeof value==='string' && value.toLowerCase().startsWith(word));
      // Keep matching options visible during forward typing instead of flashing
      // an empty list on every character while the next response is pending.
      render(known);
      pending=word;message('Loading suggestions…',true);
      async function run(attempt=0){
        const ownController=new AbortController();controller=ownController;
        const deadline=setTimeout(()=>ownController.abort(),2500);
        try {
          const response=await request(`${api}/api/suggestions?word=${encodeURIComponent(word)}`,{signal:ownController.signal});
          if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();
          if(current!==version || language.value!=='en' || input.value.trim().toLowerCase()!==word)return;
          const values=Array.isArray(data.suggestions)?data.suggestions:[];
          if(values.length){cache.set(word,values);if(cache.size>100)cache.delete(cache.keys().next().value);render(values);}
          else if(!known.length)render([]);
          pending='';message(values.length || known.length?'':'Chưa có gợi ý gần đúng. Bạn vẫn có thể bấm Search.');
        } catch(error) {
          if(current!==version)return;
          if(attempt===0 && !/HTTP (?:400|401|403|429)/.test(error.message) && root.navigator?.onLine!==false){
            message('Đang kết nối lại gợi ý…',true);timer=setTimeout(()=>run(1),400);
          }else{pending='';message(known.length?'Gợi ý từ dữ liệu đã lưu.':'Chưa kết nối được gợi ý. Bạn vẫn có thể bấm Search.');}
        }finally{clearTimeout(deadline);}
      }
      timer=setTimeout(()=>run(),immediate?0:150);
    }
    input.addEventListener('input',()=>schedule());
    input.addEventListener('focus',()=>{clearTimeout(blurTimer);if(pending!==input.value.trim().toLowerCase())schedule();});
    input.addEventListener('compositionstart',()=>{composing=true;});
    input.addEventListener('compositionend',()=>{if(composing){composing=false;schedule();}});
    input.addEventListener('blur',()=>{blurTimer=setTimeout(()=>{if(!submitted && input.ownerDocument.activeElement!==input)close();},150);});
    // Close after the target receives its click. Closing on pointerdown moves
    // the page before pointerup and can swallow taps on speakers/study buttons.
    input.ownerDocument.addEventListener?.('click',event=>{
      if(event.target===input || list.contains(event.target) || input.closest('form')?.contains(event.target))return;
      close();
    });
    language.addEventListener('change',close);
    input.addEventListener('keydown',event=>{
      if(event.isComposing || composing)return;
      if(event.key==='Escape'){close();return;}
      if(list.hidden || !items.length)return;
      if(event.key==='ArrowDown' || event.key==='ArrowUp') {
        event.preventDefault();highlight((active+(event.key==='ArrowDown'?1:active<0?0:-1)+items.length)%items.length);
      } else if(event.key==='Enter' && active>=0){event.preventDefault();select(active);}
    });
    return {close,suggest:schedule};
  }
  root.HelenAutocomplete={create};
  if(typeof module!=='undefined')module.exports={create};
})(typeof window==='undefined'?globalThis:window);
