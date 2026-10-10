(()=>{
  'use strict';
  const core=window.HelenStudyCore,host=document.querySelector('#study');if(!core || !host)return;
  const $=selector=>host.querySelector(selector);let storage;try{storage=window.localStorage;}catch{}
  const library=window.HelenStudyLibrary;let learning=library.read(storage);
  const sounds=window.HelenQuizSounds?.create({storage}),soundButton=$('#quiz-sound');
  function soundLabel(){if(!soundButton)return;soundButton.textContent=sounds?.available?(sounds.enabled?'🔊 Quiz sound: on':'🔇 Quiz sound: off'):'Quiz sound unavailable';soundButton.setAttribute('aria-pressed',String(Boolean(sounds?.enabled && sounds.available)));soundButton.disabled=!sounds?.available;}
  if(soundButton)soundButton.onclick=()=>{sounds?.setEnabled(!sounds.enabled);soundLabel();};soundLabel();
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cards=core.read(storage),session=null,preparing=false,controller=null,cancelled=false,volatile=false,translationRequest=0,topicSource=null;
  function endSession(){translationRequest++;sounds?.stop();session=null;delete host.dataset.session;}
  function favorites(){try{const values=JSON.parse(storage.getItem('helen-favorites')||'[]');return Array.isArray(values)?[...new Set(values.filter(v=>typeof v==='string').map(core.answer))].slice(0,500):[];}catch{return [];}}
  const active=()=>{const selected=new Set(favorites());return cards.filter(item=>selected.has(item.word));};
  const usingTopic=()=>Boolean(topicSource && $('#study-scope').value==='topic');
  const audioOptions=word=>({word,device:usingTopic() && document.querySelector('#topic-audio-mode')?.value==='device'});
  function scoped(){if(usingTopic())return topicSource.cards;const deck=learning.decks.find(item=>item.id===$('#study-scope').value);return active().filter(item=>!deck || deck.words.includes(item.word));}
  function saveLibrary(){if(!library.write(storage,learning)){volatile=true;$('#study-status').textContent='Bộ nhớ đầy. Thay đổi bộ từ và kết quả chỉ giữ trong phiên này.';}}
  function save(){volatile=!core.write(storage,cards);if(volatile)$('#study-status').textContent='Bộ nhớ thiết bị đầy. Tiến độ chỉ giữ trong phiên này; hãy giải phóng dung lượng.';}
  function capture(result){
    if(!favorites().includes(core.answer(result?.word)))return false;
    const old=cards.find(item=>item.word===core.answer(result.word)),value=core.card(result,old);
    if(!value)return false;
    const selected=new Set(favorites());cards=[value,...cards.filter(item=>item.word!==value.word && selected.has(item.word))].slice(0,500);save();refresh();return true;
  }
  function refresh(){
    document.dispatchEvent(new CustomEvent('helen:study-updated'));
    renderDecks();
    const list=scoped(),topic=usingTopic(),due=topic?[]:core.due(list),missing=favorites().filter(word=>!active().some(item=>item.word===word));
    const mode=$('#quiz-mode').value;
    const styleLabels={mixed:'Quick quiz',choice:'Multiple choice',cloze:'Fill in the blank',type:'Type the word',matching:'Matching pairs'};
    const ready=mode==='matching'?core.matchingPlan(list,()=>.5).length:core.quizCards(list).filter(item=>mode!=='cloze' || item.senses.some(sense=>!core.cloze(item.word,sense.definition) && sense.examples.some(example=>core.cloze(item.word,example)))).length;host.dataset.quizReady=String(ready>=3);
    $('#quiz-readiness').textContent=ready>=3?`${styleLabels[mode]} ready · ${ready} từ có dữ liệu trong nhóm đang chọn.`:`${styleLabels[mode]} cần ít nhất 3 từ phù hợp · hiện ${ready}/3. ${mode==='cloze'?'Chỉ lấy từ có câu ví dụ chứa đúng từ đã lưu.':mode==='matching'?'Cần các cặp có nghĩa khác nhau.':'Lưu hoặc chuẩn bị thêm từ để bắt đầu.'}`;
    $('#start-quiz').textContent=mode==='mixed'?'Quick quiz':mode==='matching'?'Start matching':mode==='cloze'?'Start fill-in-the-blank':mode==='type'?'Start typing':'Start multiple choice';
    $('#study-count').textContent=`${due.length} cần ôn · ${list.length} sẵn sàng`;
    $('#study-progress').textContent=topic?`${topicSource.title} · ${list.length} từ có thể luyện ngay. Muốn ôn theo lịch, lưu từ vào My words.`:list.length?`${due.length} từ đến hạn. ${missing.length?`${missing.length} từ cần chuẩn bị dữ liệu.`:'Nghĩa, ví dụ và tiến độ đã lưu trên thiết bị.'}`:'Lưu ☆ một từ khi tra cứu để bắt đầu. Từ yêu thích cũ có thể chuẩn bị bên dưới.';
    $('#topic-practice-note').hidden=!topic;$('#topic-practice-note').textContent=topic?'Bạn đang luyện một nhóm từ trong Topics. Chọn kiểu bài bên dưới rồi Start. Quiz không tự thêm 20 từ vào kho cá nhân.':'';
    $('#start-review').disabled=due.length===0 || Boolean(session);
    $('#start-quiz').disabled=ready<3 || Boolean(session);
    $('#prepare-study').hidden=missing.length===0 && !preparing;
    $('#prepare-study').disabled=preparing || Boolean(session);
    $('#study-scope').disabled=Boolean(session);$('#quiz-mode').disabled=Boolean(session);$('#open-review').disabled=due.length===0 || Boolean(session);
    $('#create-deck').disabled=Boolean(session);$('#add-current-deck').disabled=Boolean(session);$('#deck-list').querySelectorAll('button').forEach(button=>button.disabled=Boolean(session));
    $('#tile-due').textContent=`${due.length} từ đến hạn · ${list.length} đã sẵn sàng`;
    $('#tile-decks').textContent=`${learning.decks.length} bộ từ cá nhân`;
    const stats=library.statistics(learning,cards,favorites());$('#tile-progress').textContent=stats.answered?`${stats.accuracy}% đúng · ${stats.answered} lượt trả lời`:'Bắt đầu một lượt luyện tập';renderProgress(stats);
    $('#cancel-prepare').hidden=!preparing;
    if(!topic && !due.length && list.length){const next=Math.min(...list.map(item=>item.dueAt));$('#study-next').textContent=`Lần ôn tiếp: ${new Date(next).toLocaleString('vi-VN',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}.${ready>=3?' Quiz vẫn mở để luyện thêm.':''}`;}else $('#study-next').textContent='';
  }
  function renderDecks(){
    const select=$('#study-scope'),value=select.value;
    select.innerHTML='<option value="all">All saved words</option>'+(topicSource?`<option value="topic">${esc(topicSource.title)} (20)</option>`:'')+learning.decks.map(deck=>`<option value="${esc(deck.id)}">${esc(deck.name)} (${deck.words.filter(word=>favorites().includes(word)).length})</option>`).join('');
    select.value=value==='topic' && topicSource?'topic':learning.decks.some(deck=>deck.id===value)?value:'all';$('#deck-count').textContent=String(learning.decks.length);
    $('#deck-list').innerHTML=learning.decks.length?learning.decks.map(deck=>`<article class="deck-card"><span class="section-kicker">WORD SET</span><h3>${esc(deck.name)}</h3><p>${deck.words.filter(word=>favorites().includes(word)).length} từ đã lưu · ${active().filter(item=>deck.words.includes(item.word)).length} sẵn sàng</p><div class="deck-actions"><button class="word-link" data-practice-deck="${esc(deck.id)}" type="button">Practice</button><button class="word-link" data-edit-deck="${esc(deck.id)}" type="button">Edit</button><button class="text-action" data-delete-deck="${esc(deck.id)}" type="button" aria-label="Delete word set ${esc(deck.name)}">Delete set</button></div></article>`).join(''):'<p class="empty-state">Kho từ đang chờ bộ đầu tiên của bạn. Thử “IELTS Reading” hoặc thêm một bộ mẫu bên dưới.</p>';
    $('#deck-list').querySelectorAll('[data-practice-deck]').forEach(button=>button.onclick=()=>{if(session){setStatus('Kết thúc lượt hiện tại trước khi đổi bộ từ.');return;}select.value=button.dataset.practiceDeck;refresh();$('#quiz-mode').focus();});
    $('#deck-list').querySelectorAll('[data-edit-deck]').forEach(button=>button.onclick=()=>editDeck(button.dataset.editDeck));
    $('#deck-list').querySelectorAll('[data-delete-deck]').forEach(button=>button.onclick=()=>{if(!confirm('Xóa bộ từ này? Từ yêu thích và lịch ôn vẫn được giữ.'))return;learning={...learning,decks:learning.decks.filter(deck=>deck.id!==button.dataset.deleteDeck)};saveLibrary();refresh();$('#create-deck').focus();});
  }
  function renderProgress(stats=library.statistics(learning,cards,favorites())){
    $('#progress-panel').innerHTML=`<h3>Your learning snapshot</h3><div class="progress-metrics"><div><strong>${stats.answered}</strong><span>Answers</span></div><div><strong>${stats.accuracy===null?'—':stats.accuracy+'%'}</strong><span>Accuracy</span></div><div><strong>${stats.reviewed}</strong><span>Words reviewed</span></div><div><strong>${stats.due}</strong><span>Due now</span></div></div><p class="muted">Thống kê theo tối đa 500 lượt trả lời gần nhất trên thiết bị. Đây là kết quả luyện tập, không phải mức thành thạo được chứng nhận.</p><h4>Words to revisit</h4>${stats.difficult.length?stats.difficult.slice(0,12).map(item=>`<button class="word-link" data-revisit="${esc(item.word)}" type="button">${esc(item.word)} · ${item.wrong?item.wrong+' lần sai':'đã đánh dấu'}</button>`).join(' '):'<p>Chưa có từ hay sai. Kết quả sẽ xuất hiện sau khi bạn luyện tập.</p>'}<h4>Recent sessions</h4>${stats.sessions.length?`<ul>${stats.sessions.map(item=>`<li>${esc(item.mode==='review'?'Review':item.mode==='matching'?'Matching pairs':item.mode==='mixed'?'Quick quiz':item.mode)} · ${item.mode==='review'?`${item.total} thẻ`:`${item.correct}/${item.total}`} · ${esc(new Date(item.at).toLocaleString('vi-VN',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}))}</li>`).join('')}</ul>`:'<p>Hoàn thành một phiên để xem kết quả ở đây.</p>'}`;
    $('#progress-panel').querySelectorAll('[data-revisit]').forEach(button=>button.onclick=()=>{if(session){setStatus('Kết thúc lượt hiện tại trước khi mở Review.');return;}start('review',[button.dataset.revisit]);});
  }
  function setStatus(message){if(!volatile)$('#study-status').textContent=message;}
  const focus=()=>$('#study-stage').querySelector('button,input')?.focus({preventScroll:true});
  async function translateFeedback(question,panel=$('#quiz-translation')){
    if(!panel || !window.HelenQuizTranslation || typeof window.tr!=='function')return;
    const request=++translationRequest,target=document.querySelector('#target'),to=target?.value || 'vi';
    const language=target?.selectedOptions?.[0]?.textContent || 'Tiếng Việt';
    if(window.showLoading)window.showLoading(panel,'Translating question…');else panel.textContent='Đang dịch câu hỏi…';
    const rows=await window.HelenQuizTranslation.translate(question,to,window.tr);
    if(request!==translationRequest || !panel.isConnected)return;
    panel.removeAttribute('aria-busy');
    panel.innerHTML=`<h4>Bản dịch · ${esc(language)}</h4>${rows.map(row=>`<p class="${row.error?'quiz-translation-error':'quiz-translated-line'}"><b>${esc(row.label)}:</b> ${esc(row.translation || row.error)}</p>`).join('')}${rows.some(row=>row.error)?'<button class="word-link" id="retry-quiz-translation" type="button">Retry translation</button>':''}`;
    const retry=panel.querySelector('#retry-quiz-translation');if(retry)retry.onclick=()=>translateFeedback(question,panel);
  }
  function showCard(){
    translationRequest++;
    if(!session)return;
    if(session.mode==='matching'){showMatching();return;}
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
          document.dispatchEvent(new CustomEvent('helen:learning-activity'));
          session.index++;session.answered=false;showCard();refresh();
        });panel.querySelector('button')?.focus({preventScroll:true});
      };
      $('.study-audio').onclick=event=>window.speak?.(item.word,event.currentTarget,audioOptions(item.word));
    }else{
      const q=session.questions[session.index];
      for(const question of [q,session.questions[session.index+1]].filter(Boolean))for(const item of window.HelenQuizTranslation.items(question))if(!(document.querySelector('#target').value==='vi' && item.translationVi))window.HelenTranslationWarmup?.prepare(window.HelenQuizTranslation.chunks(item.text),item.kind==='definition'?{kind:'definition'}:{});
      $('#study-stage').innerHTML=`<p class="study-eyebrow">Quiz · ${session.index+1}/${session.items.length}</p><p>${q.type==='cloze'?'Điền từ đã lưu vào chỗ trống.':'Từ đã lưu nào phù hợp với nghĩa này?'}</p><span class="study-pos">${esc(q.pos)}</span><h3 class="study-prompt">${esc(q.prompt)}</h3>${q.type==='cloze'?`<p class="muted">${esc(q.definition)}</p>`:q.context?`<p class="quiz-context">${esc(q.context)}</p>`:''}${q.type==='choice'?`<div class="quiz-options">${q.choices.map(word=>`<button class="word-link" data-choice="${esc(word)}" type="button">${esc(word)}</button>`).join('')}</div>`:'<form id="quiz-form"><label for="quiz-answer">Your answer</label><input id="quiz-answer" autocomplete="off" autocapitalize="none" spellcheck="false" required maxlength="100"><button class="word-link" type="submit">Check answer</button></form>'}<div id="quiz-feedback" role="status"></div>`;
      const respond=value=>{
        if(session?.answered)return;session.answered=true;
        const correct=(q.type==='type'?q.accepted || [q.word]:[q.word]).some(word=>core.answer(value)===core.answer(word));session.correct+=Number(correct);
        sounds?.play(correct);document.dispatchEvent(new CustomEvent('helen:learning-activity'));
        if(!correct)session.mistakes.push(q.word);
        learning=library.attempt(learning,{word:q.word,correct,mode:session.style});saveLibrary();renderProgress();
        $('#study-stage').querySelectorAll('button,input').forEach(node=>node.disabled=true);
        $('#study-stage').querySelectorAll('[data-choice]').forEach(node=>{if(node.dataset.choice===q.word)node.dataset.result='correct';else if(node.dataset.choice===value)node.dataset.result='incorrect';});
        const feedback=$('#quiz-feedback');feedback.className=correct?'quiz-feedback correct':'quiz-feedback incorrect';
        feedback.innerHTML=`<strong>${correct?'✓ Đúng rồi!':'↻ Chưa đúng. Đáp án:'} ${esc(q.word)}</strong><p class="quiz-explanation"><b>${esc(q.word)}</b> (${esc(q.pos)}): ${esc(q.definition || q.prompt)}</p>${q.original?`<p class="study-example">Trong ngữ cảnh: “${esc(q.original)}”</p>`:''}<section class="quiz-translation" id="quiz-translation" aria-label="Question translation" role="status"></section>${!correct?'<p class="quiz-review-hint">Nhớ lại nghĩa và cách dùng trong câu. Từ này đã được thêm vào <b>Review mistakes</b> cuối lượt quiz để bạn ôn lại.</p>':''}<small class="muted">${esc(q.source)}</small><div class="quiz-feedback-actions"><button class="word-link" id="next-question" type="button">${session.index+1===session.items.length?'See results':'Next question'}</button></div>`;
        void translateFeedback(q);
        session.feedbackQuestion=q;feedbackTools(q,feedback);
        $('#next-question').onclick=()=>{session.index++;session.answered=false;showCard();};$('#next-question').focus({preventScroll:true});
      };
      if(q.type==='choice')$('.quiz-options').querySelectorAll('button').forEach(button=>button.onclick=()=>respond(button.dataset.choice));
      else $('#quiz-form').onsubmit=event=>{event.preventDefault();respond($('#quiz-answer').value);};
    }
    focus();
  }
  function feedbackTools(q,panel){
    const tools=document.createElement('div');tools.className='feedback-tools';
    tools.innerHTML=`<button class="say" type="button" data-hear="word" aria-label="Hear ${esc(q.word)}">🔊</button>${q.original?'<button class="word-link" type="button" data-hear="sentence">Hear example</button>':''}<button class="word-link" type="button" data-open-word>View dictionary</button><button class="word-link" type="button" data-difficult>Mark for review</button>`;
    panel.append(tools);
    tools.querySelectorAll('[data-hear]').forEach(button=>button.onclick=()=>window.speak?.(button.dataset.hear==='word'?q.word:q.original,button,audioOptions(q.word)));
    tools.querySelector('[data-open-word]').onclick=()=>{endSession();$('#study-stage').hidden=true;$('#end-study').hidden=true;refresh();window.HelenDictionary?.lookup(q.word);};
    tools.querySelector('[data-difficult]').onclick=event=>{
      if(!favorites().includes(q.word)){
        try{window.HelenDictionary.addFavorites([q.word]);}
        catch(error){setStatus(error.message);return;}
      }
      const result=topicSource?.results.find(item=>item.word===q.word);if(result && !cards.some(item=>item.word===q.word))capture(result);
      learning={...learning,difficult:library.words([...learning.difficult,q.word])};saveLibrary();
      cards=cards.map(item=>item.word===q.word?{...item,dueAt:Date.now()}:item);save();renderProgress();
      event.currentTarget.textContent='✓ Added to Review';event.currentTarget.disabled=true;
    };
  }
  function showMatching(){
    for(const q of session.questions)if(!(document.querySelector('#target').value==='vi' && q.definitionVi))window.HelenTranslationWarmup?.prepare(window.HelenQuizTranslation.chunks(q.definition),{kind:'definition'});
    const order=[...session.questions];for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    if(order.every((item,index)=>item.word===session.questions[index].word))order.reverse();
    $('#study-stage').hidden=false;
    $('#study-stage').innerHTML=`<p class="study-eyebrow">Matching pairs · <span id="matching-count">0/${session.questions.length}</span></p><h3>Find the connection.</h3><p>Chọn một từ và định nghĩa tương ứng. Có thể chọn cột nào trước cũng được.</p><div class="matching-columns"><div class="matching-column" role="group" aria-label="Saved words"><h4>Words</h4>${session.questions.map(q=>`<button class="match-item" data-match-word="${esc(q.word)}" type="button" aria-pressed="false">${esc(q.word)}</button>`).join('')}</div><div class="matching-column" role="group" aria-label="Dictionary meanings"><h4>Meanings</h4>${order.map(q=>`<button class="match-item" data-match-meaning="${esc(q.word)}" type="button" aria-pressed="false"><span class="study-pos">${esc(q.pos)}</span>${esc(q.definition)}</button>`).join('')}</div></div><div id="matching-feedback" role="status"></div>`;
    const select=(kind,word)=>{
      if(!session || session.matched.has(word))return;
      session[kind]=session[kind]===word?null:word;
      $('#study-stage').querySelectorAll('[data-match-word]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.matchWord===session.selectedWord)));
      $('#study-stage').querySelectorAll('[data-match-meaning]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.matchMeaning===session.selectedMeaning)));
      if(!session.selectedWord || !session.selectedMeaning)return;
      const q=session.questions.find(item=>item.word===session.selectedWord),correct=session.selectedWord===session.selectedMeaning;
      learning=library.attempt(learning,{word:q.word,correct,mode:'matching'});saveLibrary();renderProgress();sounds?.play(correct);document.dispatchEvent(new CustomEvent('helen:learning-activity'));
      if(correct){
        session.matched.add(q.word);if(!session.mistakes.includes(q.word))session.correct++;
        $('#study-stage').querySelectorAll('[data-match-word],[data-match-meaning]').forEach(button=>{if(button.dataset.matchWord===q.word || button.dataset.matchMeaning===q.word){button.disabled=true;button.dataset.result='correct';button.setAttribute('aria-pressed','false');button.insertAdjacentHTML('beforeend','<span aria-label="Matched"> ✓</span>');}});
        $('#matching-count').textContent=`${session.matched.size}/${session.questions.length}`;
      }else if(!session.mistakes.includes(q.word))session.mistakes.push(q.word);
      session.selectedWord=null;session.selectedMeaning=null;
      $('#study-stage').querySelectorAll('[aria-pressed]').forEach(button=>button.setAttribute('aria-pressed','false'));
      const panel=$('#matching-feedback');panel.className=`quiz-feedback ${correct?'correct':'incorrect'}`;
      panel.innerHTML=`<strong>${correct?'✓ Matched':'↻ Chưa đúng'} · ${esc(q.word)}</strong><p>${esc(q.definition)}</p>${q.original?`<p class="study-example">“${esc(q.original)}”</p>`:''}<small>${esc(q.source)}</small><section class="quiz-translation" id="quiz-translation" aria-label="Question translation" role="status"></section>${!correct?'<p>Hãy ghép lại. Từ này đã được ghi vào Words to revisit.</p>':''}`;
      session.feedbackQuestion=q;session.answered=true;void translateFeedback(q);feedbackTools(q,panel);
      if(session.matched.size===session.questions.length){panel.insertAdjacentHTML('beforeend','<button class="word-link" id="matching-results" type="button">See results</button>');$('#matching-results').onclick=finish;$('#matching-results').focus({preventScroll:true});}
      else $('#study-stage').querySelector('[data-match-word]:not(:disabled)')?.focus({preventScroll:true});
    };
    $('#study-stage').querySelectorAll('[data-match-word]').forEach(button=>button.onclick=()=>select('selectedWord',button.dataset.matchWord));
    $('#study-stage').querySelectorAll('[data-match-meaning]').forEach(button=>button.onclick=()=>select('selectedMeaning',button.dataset.matchMeaning));focus();
  }
  function finish(){
    const done=session;if(done.topic)document.dispatchEvent(new CustomEvent('helen:topic-completed',{detail:{id:done.topic.id,index:done.topic.index,edition:done.topic.edition || 1,total:done.items.length,correct:done.correct}}));learning=library.completed(learning,{mode:done.mode==='review'?'review':done.style,total:done.items.length,correct:done.correct});saveLibrary();document.dispatchEvent(new CustomEvent('helen:session-completed',{detail:{mode:done.mode,total:done.items.length,correct:done.correct}}));endSession();$('#end-study').hidden=true;
    $('#study-stage').innerHTML=done.mode==='review'?'<h3>Review complete</h3><p>Lịch ôn đã cập nhật. Từ chưa nhớ sẽ đến hạn sau 10 phút.</p>':`<h3>${done.mode==='matching'?'Matching':'Quiz'} complete · ${done.correct}/${done.items.length}</h3><p>${done.mode==='matching'?'Điểm tính theo cặp đúng ngay lần đầu. ':''}Quiz để luyện thêm; lịch ôn giữ theo đánh giá trong Review.</p>${done.mistakes.length?`<p>Từ nên xem lại: ${done.mistakes.map(esc).join(', ')}.</p><button class="word-link" id="review-mistakes" type="button">${done.topic?'Save & review mistakes':'Review mistakes'}</button>`:'<p>Bạn trả lời đúng tất cả câu trong lượt này.</p>'}`;
    if($('#review-mistakes'))$('#review-mistakes').onclick=()=>{if(done.topic){try{window.HelenDictionary.addFavorites(done.mistakes);for(const word of done.mistakes){const result=topicSource?.results.find(item=>item.word===word);if(result && !cards.some(c=>c.word===word))capture(result);}}catch(error){setStatus(error.message);return;}}start('review',done.mistakes);};
    refresh();
  }
  function start(mode,words){
    if(session)return;
    const topic=mode==='quiz' && usingTopic(),list=words?active():scoped(),current=typeof lastResult!=='undefined'?lastResult?.word:document.querySelector('#q')?.value,style=$('#quiz-mode').value;
    const matching=mode==='quiz' && style==='matching';
    const questions=mode==='quiz'?(matching?core.matchingPlan(list):core.quizPlan(list,current,Math.random,style)):[];
    if(mode==='quiz' && questions.length<3){setStatus(style==='cloze'?'Cần ít nhất 3 từ có câu ví dụ chứa đúng từ đã lưu. Chọn Quick quiz hoặc chuẩn bị thêm từ.':matching?'Cần ít nhất 3 cặp từ có nghĩa khác nhau. Thêm từ khác hoặc chọn kiểu luyện tập khác.':'Cần ít nhất 3 từ có dữ liệu câu hỏi trong bộ đã chọn.');return;}
    let items=mode==='review'?(words?list.filter(item=>words.includes(item.word)):core.due(list)):questions.map(q=>list.find(item=>item.word===q.word));
    items=items.slice(0,mode==='quiz'?10:20);if(!items.length)return;
    session={mode:matching?'matching':mode,style,items,index:0,correct:0,mistakes:[],answered:false,questions,matched:new Set(),selectedWord:null,selectedMeaning:null,topic:topic?{id:topicSource.id,index:topicSource.index,edition:topicSource.edition || 1}:null};host.dataset.session=session.mode;
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
          window.HelenPronunciation?.register(data);
          for(const result of data.results)capture(result);
          failures+=data.missing?.length || 0;
          setStatus(`Đã chuẩn bị ${active().length}/${favorites().length} từ. Có thể học ngay các từ đã sẵn sàng.`);
        }catch{if(!cancelled)failures+=remaining.slice(offset,offset+12).length;break;}finally{clearTimeout(timer);controller=null;}
      }
      setStatus(cancelled?'Đã dừng. Các từ đã chuẩn bị vẫn được giữ.':failures?'Một số từ chưa có dữ liệu. Mở lại từ đó trong từ điển để bổ sung; các từ sẵn sàng vẫn học được.':'Đã chuẩn bị xong. Bắt đầu Review hoặc Quiz nhé.');
    }finally{preparing=false;refresh();}
  }
  const editor=document.querySelector('#deck-editor'),editorForm=document.querySelector('#deck-form');let editingId=null,returnFocus,addingWord=null;
  function editDeck(id,selectedWord){
    if(!editor.open)returnFocus=document.activeElement;
    addingWord=selectedWord || null;const deck=learning.decks.find(item=>item.id===id);editingId=deck?.id || null;
    const existing=document.querySelector('#deck-existing');existing.innerHTML='<option value="">Create a new set</option>'+learning.decks.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');existing.value=editingId || '';
    document.querySelector('#deck-editor-title').textContent=deck?'Edit word set':'New word set';document.querySelector('#deck-name').value=deck?.name || '';document.querySelector('#deck-filter').value='';document.querySelector('#deck-editor-error').textContent='';
    const chosen=new Set([...(deck?.words || []),...(selectedWord?[selectedWord]:[])]);
    document.querySelector('#deck-word-options').innerHTML=favorites().length?favorites().map(word=>`<label class="deck-word-option"><input type="checkbox" value="${esc(word)}" ${chosen.has(word)?'checked':''}><span>${esc(word)}</span></label>`).join(''):'<p>Chưa có từ đã lưu. Bạn có thể tạo bộ trống rồi thêm từ sau.</p>';
    if(!editor.open)editor.showModal();document.querySelector('#deck-name').focus();
  }
  document.querySelector('#deck-existing').onchange=event=>editDeck(event.target.value,addingWord);
  function closeEditor(){editor.close();(returnFocus?.isConnected?returnFocus:$('#create-deck'))?.focus();}
  document.querySelector('#cancel-deck-editor').onclick=closeEditor;
  editor.addEventListener('cancel',()=>setTimeout(()=>returnFocus?.focus(),0));
  document.querySelector('#deck-filter').oninput=event=>{const filter=core.answer(event.target.value);document.querySelectorAll('.deck-word-option').forEach(label=>label.hidden=!core.answer(label.textContent).includes(filter));};
  editorForm.onsubmit=event=>{event.preventDefault();try{
    const id=editingId || `set-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const selected=[...document.querySelectorAll('#deck-word-options input:checked')].map(input=>input.value);
    learning=library.setDeck(learning,{id,name:document.querySelector('#deck-name').value,selected});saveLibrary();refresh();closeEditor();
  }catch(error){document.querySelector('#deck-editor-error').textContent=error.message;}};
  $('#create-deck').onclick=()=>editDeck();
  $('#add-current-deck').onclick=()=>{const word=typeof lastResult!=='undefined'?lastResult?.word:null;if(!word){setStatus('Tra một từ thành công trước khi thêm vào bộ.');return;}try{window.HelenDictionary.addFavorites([word]);editDeck(null,word);}catch(error){setStatus(error.message);}};
  $('#open-review').onclick=()=>start('review');
  $('#open-decks').onclick=()=>{$('#study-decks').open=true;$('#create-deck').focus({preventScroll:true});};
  $('#open-progress').onclick=()=>{const panel=$('#progress-panel');panel.hidden=!panel.hidden;$('#open-progress').setAttribute('aria-expanded',String(!panel.hidden));};
  $('#study-scope').onchange=refresh;$('#quiz-mode').onchange=refresh;
  async function assetJSON(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Chưa tải được bộ mẫu. Thử lại khi có mạng.');return await response.json();}finally{clearTimeout(timer);}}
  let starterPromise;
  host.querySelector('.starter-sets').addEventListener('toggle',async event=>{
    if(!event.target.open || $('#starter-list').children.length)return;
    try{
      $('#starter-status').innerHTML=window.loadingHTML?.('Loading starter sets…') || 'Đang tải bộ mẫu…';
      starterPromise ||= assetJSON('/assets/study-starters.json').catch(error=>{starterPromise=null;throw error;});
      const data=await starterPromise;
      $('#starter-list').innerHTML=data.decks.map((deck,index)=>`<article class="starter-card"><h4>${esc(deck.name)}</h4><p>${esc(deck.description)} · ${deck.words.length} từ</p><button class="word-link" data-starter="${index}" type="button">Add starter set</button></article>`).join('');$('#starter-status').textContent='';
      $('#starter-list').querySelectorAll('[data-starter]').forEach(button=>button.onclick=async()=>{
          if(session){setStatus('Kết thúc lượt hiện tại trước khi thêm bộ từ.');return;}
          button.disabled=true;try{
          $('#starter-status').innerHTML=window.loadingHTML?.('Adding word set…') || 'Đang thêm bộ từ…';
          const pack=await assetJSON('/assets/offline-basics.json'),template=data.decks[Number(button.dataset.starter)];
          if(session)throw Error('Kết thúc lượt hiện tại trước khi thêm bộ từ.');
          const results=template.words.map(word=>pack.entries.find(item=>item.word===word)?.result);if(results.some(item=>!item))throw Error('Bộ mẫu thiếu dữ liệu. Hãy cập nhật app rồi thử lại.');
          const existing=learning.decks.find(deck=>deck.name.toLowerCase()===template.name.toLowerCase()),id=existing?.id || `starter-${button.dataset.starter}`;
          const next=library.setDeck(learning,{id,name:template.name,selected:library.words([...(existing?.words || []),...template.words])});
          window.HelenDictionary.addFavorites(template.words);learning=next;saveLibrary();for(const result of results)capture(result);renderDecks();$('#study-scope').value=id;refresh();
          try{await window.HelenPWA?.saveWords(pack.entries.filter(item=>template.words.includes(item.word)));}catch{$('#starter-status').textContent='Đã thêm bộ để luyện. Lưu trang từ điển ngoại tuyến chưa sẵn sàng; tải lại app rồi thử thêm bộ lần nữa.';return;}
          $('#starter-status').textContent='Đã thêm bộ từ. Chọn kiểu luyện tập rồi bắt đầu nhé.';
        }catch(error){$('#starter-status').textContent=error.name==='AbortError'?'Tải bộ mẫu chậm. Hãy thử lại.':error.message;}finally{button.disabled=false;}
      });
    }catch{$('#starter-status').textContent='Chưa tải được bộ mẫu. Kết nối mạng rồi mở lại mục này.';}
  });
  $('#start-review').onclick=()=>start('review');$('#start-quiz').onclick=()=>start('quiz');$('#prepare-study').onclick=prepare;
  $('#cancel-prepare').onclick=()=>{cancelled=true;controller?.abort();};
  $('#end-study').onclick=()=>{endSession();$('#study-stage').hidden=true;$('#end-study').hidden=true;refresh();setStatus('Đã dừng. Những thẻ đã đánh giá vẫn giữ tiến độ.');};
  document.addEventListener('helen:lookup',event=>capture(event.detail?.result));
  document.addEventListener('helen:favorites',event=>{if(event.detail?.result)capture(event.detail.result);if(session && !session.topic && session.items.some(item=>!favorites().includes(item.word))){endSession();$('#study-stage').hidden=true;$('#end-study').hidden=true;setStatus('Danh sách từ đã thay đổi. Bắt đầu lại với các từ đang lưu.');}refresh();});
  window.addEventListener('storage',event=>{if([core.KEY,library.KEY,'helen-favorites'].includes(event.key)){cards=core.read(storage);learning=library.read(storage);endSession();if(editor.open)closeEditor();$('#study-stage').hidden=true;$('#end-study').hidden=true;refresh();setStatus('Đã cập nhật dữ liệu từ tab khác.');}});
  window.addEventListener('pageshow',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  document.addEventListener('helen:page-change',event=>{if(event.detail.page==='study')refresh();});setInterval(()=>{if(!document.hidden && (!window.HelenPages || window.HelenPages.current()==='study'))refresh();},30000);
  document.querySelector('#target')?.addEventListener('change',()=>{if(session?.answered && session.feedbackQuestion)void translateFeedback(session.feedbackQuestion);});
  window.HelenStudy={capture,captureMissing(result){if(!cards.some(c=>c.word===core.answer(result.word)))return capture(result);return false;},practiceTopic(value){
    if(session || preparing)throw Error('Kết thúc lượt học hoặc chuẩn bị dữ liệu hiện tại trước khi đổi nhóm từ.');
    if(!value || !/^[a-z]+$/.test(value.id) || !Number.isInteger(value.index) || value.index<0 || value.index>9 || !Array.isArray(value.results) || value.results.length!==20)throw Error('Nhóm từ chưa đủ dữ liệu.');
    const prepared=value.results.map(result=>core.card(result));if(prepared.some(item=>!item))throw Error('Nhóm từ chưa đủ dữ liệu.');
    topicSource={...value,cards:prepared};renderDecks();$('#study-scope').value='topic';refresh();window.HelenPages.go('/study',{focus:true,scroll:true});$('#quiz-mode').focus({preventScroll:true});
  }};
  document.addEventListener('helen:restore',()=>{cards=core.read(storage);learning=library.read(storage);endSession();$('#study-stage').hidden=true;$('#end-study').hidden=true;refresh();});
  refresh();if(typeof lastResult!=='undefined')capture(lastResult);
})();
