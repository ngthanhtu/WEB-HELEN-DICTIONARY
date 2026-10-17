(()=>{
  'use strict';
  const localUI=(text,params)=>globalThis.HelenI18n?.t(text,params) || text;
  const core=window.HelenHabits;let storage;try{storage=localStorage;}catch{}let state=core.read(storage),todayWord,persistent=true;
  const current=()=>persistent?core.read(storage):state;
  const $=id=>document.getElementById(id);
  function render(){const value=core.progress(state);$('daily-count').textContent=localUI('{count} practice turns',{count:`${value.count}/${value.goal}`});$('daily-meter').value=Math.min(value.count,value.goal);$('daily-meter').max=value.goal;
    $('daily-streak').textContent=localUI('{count} consecutive days',{count:value.streak});$('daily-goal').value=String(state.goal);
    $('daily-note').textContent=localUI(value.complete?'Đã đạt mục tiêu hôm nay. Hẹn gặp bạn ngày mai!':'Mỗi câu quiz hoặc thẻ tự đánh giá được tính một lượt. Câu sai vẫn là một lượt luyện.');
    $('daily-learning').dataset.complete=String(value.complete);
    if(!persistent)$('daily-note').textContent='Bộ nhớ đầy. Mục tiêu và streak chỉ giữ trong phiên này; hãy xuất bản sao lưu.';
    try{const favorites=JSON.parse(storage.getItem('helen-favorites') || '[]'),cards=window.HelenStudyCore.read(storage).filter(card=>favorites.includes(card.word)),due=window.HelenStudyCore.due(cards).length;
      if(navigator.setAppBadge && due)navigator.setAppBadge(due).catch(()=>{});else navigator.clearAppBadge?.().catch(()=>{});
    }catch{}
  }
  function save(){persistent=core.write(storage,state);}
  $('daily-goal').onchange=()=>{state=core.setGoal(current(),Number($('daily-goal').value));save();render();if(persistent)$('daily-note').textContent=localUI('Mục tiêu mới áp dụng từ ngày kế tiếp nếu hôm nay đã luyện.');};
  document.addEventListener('helen:learning-activity',()=>{state=core.record(current());save();render();});
  for(const name of ['helen:favorites','helen:study-updated'])document.addEventListener(name,render);
  window.addEventListener('storage',event=>{if(event.key===core.KEY){state=core.read(storage);render();}});
  window.addEventListener('pageshow',()=>{state=current();render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){state=current();render();void wordOfDay();}});
  let glossVersion=0;
  async function wordGloss(){
    if(!todayWord || window.HelenPages?.current()!=='study')return;const ticket=++glossVersion,to=document.querySelector('#target')?.value || 'vi',box=$('daily-gloss');
    const definition=todayWord.result?.entries?.[0]?.meanings?.[0]?.senses?.[0]?.definition || todayWord.gloss;
    if(to==='vi'){box.textContent=todayWord.gloss;return;}
    if(to==='en'){box.textContent=definition;return;}
    window.showLoading?.(box,localUI('Translating meaning…'));
    try{const parts=window.HelenQuizTranslation.chunks(definition),translated=(await window.tr(parts,'en',to,{kind:'definition'})).join(' ');if(ticket===glossVersion)window.finishLoading(box,translated);}
    catch{if(ticket===glossVersion)window.finishLoading(box,localUI('This translation has not been saved. Connect to download it.'));}
  }
  document.querySelector('#target')?.addEventListener('change',()=>void wordGloss());
  document.addEventListener('helen:page-change',event=>{if(event.detail.page==='study')void wordGloss();});
  async function wordOfDay(){try{const response=await fetch('/assets/offline-basics.json');if(!response.ok)throw Error();const pack=await response.json(),key=core.day();
      let seed=0;for(const char of key)seed=(seed*31+char.charCodeAt(0))>>>0;todayWord=pack.entries[seed%pack.entries.length];
      $('daily-word').textContent=todayWord.word;void wordGloss();$('word-of-day').hidden=false;
    }catch{$('word-of-day').hidden=true;}}
  $('daily-explore').onclick=async()=>{if(!todayWord)return;try{await window.HelenPWA?.saveWords([todayWord]);}catch{}window.HelenDictionary.lookup(todayWord.word);};
  $('daily-save').onclick=()=>{if(!todayWord)return;try{window.HelenDictionary.addFavorites([todayWord.word]);window.HelenStudy.capture(todayWord.result);$('daily-word-status').textContent='Đã lưu từ và dữ liệu để luyện ngoại tuyến.';}catch(error){$('daily-word-status').textContent=error.message;}};
  render();void wordOfDay();
})();
