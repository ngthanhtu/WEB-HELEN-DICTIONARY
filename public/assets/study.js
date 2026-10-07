(()=>{
  'use strict';
  const core=window.HelenStudyCore,host=document.querySelector('#study');if(!core || !host)return;
  const $=selector=>host.querySelector(selector),storage=window.localStorage;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cards=core.read(storage),session=null,preparing=false,controller=null,cancelled=false,volatile=false;
  function favorites(){try{const values=JSON.parse(storage.getItem('helen-favorites')||'[]');return Array.isArray(values)?[...new Set(values.filter(v=>typeof v==='string').map(core.answer))].slice(0,100):[];}catch{return [];}}
  const active=()=>{const selected=new Set(favorites());return cards.filter(item=>selected.has(item.word));};
  function save(){volatile=!core.write(storage,cards);if(volatile)$('#study-status').textContent='Bộ nhớ thiết bị đầy. Tiến độ chỉ giữ trong phiên này; hãy giải phóng dung lượng.';}
  function capture(result){
    if(!favorites().includes(core.answer(result?.word)))return false;
    const old=cards.find(item=>item.word===core.answer(result.word)),value=core.card(result,old);
    if(!value)return false;
    const selected=new Set(favorites());cards=[value,...cards.filter(item=>item.word!==value.word && selected.has(item.word))].slice(0,100);save();refresh();return true;
  }
  function refresh(){
    const list=active(),due=core.due(list),missing=favorites().filter(word=>!list.some(item=>item.word===word));
    $('#study-count').textContent=`${due.length} cần ôn · ${list.length} sẵn sàng`;
    $('#study-progress').textContent=list.length?`${due.length} từ đến hạn. ${missing.length?`${missing.length} từ cần chuẩn bị dữ liệu.`:'Nghĩa, ví dụ và tiến độ đã lưu trên thiết bị.'}`:'Lưu ☆ một từ khi tra cứu để bắt đầu. Từ yêu thích cũ có thể chuẩn bị bên dưới.';
    $('#start-review').disabled=due.length===0 || Boolean(session);
    $('#start-quiz').disabled=!list.some(core.quizSense) || Boolean(session);
    $('#prepare-study').hidden=missing.length===0 && !preparing;
    $('#prepare-study').disabled=preparing || Boolean(session);
    $('#cancel-prepare').hidden=!preparing;
    if(!due.length && list.length){const next=Math.min(...list.map(item=>item.dueAt));$('#study-next').textContent=`Lần ôn tiếp: ${new Date(next).toLocaleString('vi-VN',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}. Quiz vẫn mở để luyện thêm.`;}else $('#study-next').textContent='';
  }
  function setStatus(message){if(!volatile)$('#study-status').textContent=message;}
  const focus=()=>$('#study-stage').querySelector('button,input')?.focus({preventScroll:true});
  function showCard(){
    if(!session)return;
    const item=session.items[session.index];if(!item){finish();return;}
    $('#study-stage').hidden=false;
    if(session.mode==='review'){
      $('#study-stage').innerHTML=`<p class="study-eyebrow">Review · ${session.index+1}/${session.items.length}</p><h3>${esc(item.word)}</h3><button class="say study-audio" type="button" aria-label="Hear ${esc(item.word)}">🔊</button><p>Nhớ lại nghĩa trước khi mở thẻ.</p><button class="word-link" id="reveal-study" type="button">Show meanings</button><div id="study-answer" hidden></div>`;
      $('#reveal-study').onclick=()=>{
        $('#reveal-study').hidden=true;const panel=$('#study-answer');panel.hidden=false;
        panel.innerHTML=`${item.senses.map(s=>`<div class="study-sense"><span class="study-pos">${esc(s.pos)}</span><p>${esc(s.definition)}</p>${s.examples[0]?`<p class="study-example">“${esc(s.examples[0])}”</p>`:''}<small>${esc(s.source)}</small></div>`).join('')}<p>Tự đánh giá để lên lịch ôn tiếp theo:</p><div class="study-ratings"><button data-rating="again" type="button">Chưa nhớ <small>10 phút</small></button><button data-rating="hard" type="button">Hơi nhớ <small>${core.grade(item,'hard').interval} ngày</small></button><button data-rating="good" type="button">Đã nhớ <small>${core.grade(item,'good').interval} ngày</small></button></div>`;
        panel.querySelectorAll('[data-rating]').forEach(button=>button.onclick=()=>{
          if(session?.answered)return;session.answered=true;
          const latest=cards.find(value=>value.word===item.word);if(latest){cards=cards.map(value=>value.word===item.word?core.grade(value,button.dataset.rating):value);save();}
          session.index++;session.answered=false;showCard();refresh();
        });panel.querySelector('button')?.focus({preventScroll:true});
      };
      $('.study-audio').onclick=event=>window.speak?.(item.word,event.currentTarget);
    }else{
      const q=session.questions[session.index];
      $('#study-stage').innerHTML=`<p class="study-eyebrow">Quiz · ${session.index+1}/${session.items.length}</p><p>${q.type==='cloze'?'Điền từ đã lưu vào chỗ trống.':'Từ đã lưu nào phù hợp với nghĩa này?'}</p><span class="study-pos">${esc(q.pos)}</span><h3 class="study-prompt">${esc(q.prompt)}</h3>${q.type==='cloze'?`<p class="muted">${esc(q.definition)}</p>`:''}${q.type==='choice'?`<div class="quiz-options">${q.choices.map(word=>`<button class="word-link" data-choice="${esc(word)}" type="button">${esc(word)}</button>`).join('')}</div>`:'<form id="quiz-form"><label for="quiz-answer">Your answer</label><input id="quiz-answer" autocomplete="off" autocapitalize="none" spellcheck="false" required maxlength="100"><button class="word-link" type="submit">Check answer</button></form>'}<div id="quiz-feedback" role="status"></div>`;
      const respond=value=>{
        if(session?.answered)return;session.answered=true;
        const correct=core.answer(value)===core.answer(q.word);session.correct+=Number(correct);
        if(!correct)session.mistakes.push(q.word);
        $('#study-stage').querySelectorAll('button,input').forEach(node=>node.disabled=true);
        const feedback=$('#quiz-feedback');feedback.className=correct?'quiz-feedback correct':'quiz-feedback incorrect';
        feedback.innerHTML=`<strong>${correct?'Đúng rồi!':'Đáp án:'} ${esc(q.word)}</strong>${q.original?`<p>${esc(q.original)}</p>`:''}<p>${esc(q.source)}</p><button class="word-link" id="next-question" type="button">${session.index+1===session.items.length?'See results':'Next question'}</button>`;
        $('#next-question').onclick=()=>{session.index++;session.answered=false;showCard();};$('#next-question').focus({preventScroll:true});
      };
      if(q.type==='choice')$('.quiz-options').querySelectorAll('button').forEach(button=>button.onclick=()=>respond(button.dataset.choice));
      else $('#quiz-form').onsubmit=event=>{event.preventDefault();respond($('#quiz-answer').value);};
    }
    focus();
  }
  function finish(){
    const done=session;session=null;$('#end-study').hidden=true;
    $('#study-stage').innerHTML=done.mode==='review'?'<h3>Review complete</h3><p>Lịch ôn đã cập nhật. Từ chưa nhớ sẽ đến hạn sau 10 phút.</p>':`<h3>Quiz complete · ${done.correct}/${done.items.length}</h3><p>Quiz để luyện thêm; lịch ôn giữ theo đánh giá trong Review.</p>${done.mistakes.length?`<p>Từ nên xem lại: ${done.mistakes.map(esc).join(', ')}.</p><button class="word-link" id="review-mistakes" type="button">Review these words</button>`:'<p>Bạn trả lời đúng tất cả câu trong lượt này.</p>'}`;
    if($('#review-mistakes'))$('#review-mistakes').onclick=()=>start('review',done.mistakes);
    refresh();
  }
  function start(mode,words){
    const list=active();let items=mode==='review'?(words?list.filter(item=>words.includes(item.word)):core.due(list)):list.filter(core.quizSense);
    if(mode==='quiz'){items=[...items];for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}}
    items=items.slice(0,mode==='quiz'?10:20);if(!items.length)return;
    session={mode,items,index:0,correct:0,mistakes:[],answered:false,questions:mode==='quiz'?items.map((item,index)=>core.question(item,list,index)):[]};
    $('#end-study').hidden=false;refresh();showCard();setStatus('');
  }
  async function prepare(){
    if(preparing)return;preparing=true;cancelled=false;refresh();
    $('#study-status').innerHTML=window.loadingHTML?.('Preparing saved words…') || 'Đang chuẩn bị từ đã lưu…';
    let failures=0;
    try{
      const words=favorites().filter(word=>!active().some(item=>item.word===word));
      // Reuse dictionary snapshots, including entries unavailable in the local WordNet dataset.
      if('caches' in window){try{const cache=await caches.open('helen-words-v1');for(const word of words){if(cancelled)break;const response=await cache.match(`${location.origin}/api/lookup?${new URLSearchParams({word,from:'en'})}`);if(response)capture(await response.json());}}catch{}}
      const remaining=words.filter(word=>!active().some(item=>item.word===word));
      if(navigator.onLine===false && remaining.length){setStatus('Ngoại tuyến. Từ đã chuẩn bị vẫn học được; kết nối mạng để thêm từ còn thiếu.');return;}
      for(let offset=0;offset<remaining.length && !cancelled;offset+=12){
        controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4500);
        try{
          const response=await fetch('/api/study/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({words:remaining.slice(offset,offset+12)}),signal:controller.signal});
          const data=await response.json();if(!response.ok || !Array.isArray(data.results))throw Error('unavailable');
          for(const result of data.results)capture(result);
          failures+=data.missing?.length || 0;
          setStatus(`Đã chuẩn bị ${active().length}/${favorites().length} từ. Có thể học ngay các từ đã sẵn sàng.`);
        }catch{if(!cancelled)failures+=remaining.slice(offset,offset+12).length;break;}finally{clearTimeout(timer);controller=null;}
      }
      setStatus(cancelled?'Đã dừng. Các từ đã chuẩn bị vẫn được giữ.':failures?'Một số từ chưa có dữ liệu. Mở lại từ đó trong từ điển để bổ sung; các từ sẵn sàng vẫn học được.':'Đã chuẩn bị xong. Bắt đầu Review hoặc Quiz nhé.');
    }finally{preparing=false;refresh();}
  }
  $('#start-review').onclick=()=>start('review');$('#start-quiz').onclick=()=>start('quiz');$('#prepare-study').onclick=prepare;
  $('#cancel-prepare').onclick=()=>{cancelled=true;controller?.abort();};
  $('#end-study').onclick=()=>{session=null;$('#study-stage').hidden=true;$('#end-study').hidden=true;refresh();setStatus('Đã dừng. Những thẻ đã đánh giá vẫn giữ tiến độ.');};
  document.addEventListener('helen:lookup',event=>capture(event.detail?.result));
  document.addEventListener('helen:favorites',event=>{if(event.detail?.result)capture(event.detail.result);if(session && session.items.some(item=>!favorites().includes(item.word))){session=null;$('#study-stage').hidden=true;$('#end-study').hidden=true;setStatus('Danh sách từ đã thay đổi. Bắt đầu lại với các từ đang lưu.');}refresh();});
  window.addEventListener('storage',event=>{if([core.KEY,'helen-favorites'].includes(event.key)){cards=core.read(storage);session=null;$('#study-stage').hidden=true;$('#end-study').hidden=true;refresh();setStatus('Đã cập nhật dữ liệu từ tab khác.');}});
  window.addEventListener('pageshow',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  host.addEventListener('toggle',refresh);setInterval(()=>{if(!document.hidden && host.open)refresh();},30000);
  refresh();if(typeof lastResult!=='undefined')capture(lastResult);
})();
