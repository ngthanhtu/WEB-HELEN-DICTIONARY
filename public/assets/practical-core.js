(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object' && module.exports)module.exports=api;else root.HelenPracticalCore=api;
})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const scenarios=[
  {id:'coffee',title:'At a café',icon:'☕',role:'a café barista',goal:'Gọi món, hỏi giá và yêu cầu thay đổi đồ uống.',opening:'Hi! What would you like to order today?',translation:'Chào bạn! Hôm nay bạn muốn gọi món gì?',hint:'I would like an iced latte, please.'},
  {id:'travel',title:'Travel & directions',icon:'✦',role:'a helpful local resident',goal:'Hỏi đường, phương tiện và thời gian di chuyển.',opening:'Hello! Are you looking for somewhere nearby?',translation:'Chào bạn! Bạn đang tìm một địa điểm gần đây à?',hint:'Could you tell me how to get to the train station?'},
  {id:'work',title:'A job interview',icon:'▤',role:'a friendly job interviewer',goal:'Giới thiệu bản thân, kinh nghiệm và điểm mạnh.',opening:'Thanks for coming. Could you tell me a little about yourself?',translation:'Cảm ơn bạn đã đến. Bạn có thể giới thiệu một chút về bản thân không?',hint:'I recently graduated, and I enjoy working with a team.'},
  {id:'ielts-life',title:'Everyday speaking',icon:'◉',role:'a supportive English speaking partner asking IELTS Part 1-style questions',goal:'Nói về học tập, công việc, sở thích và nơi sống.',opening:'What do you enjoy doing in your free time, and why?',translation:'Bạn thích làm gì vào thời gian rảnh, và vì sao?',hint:'I enjoy reading because it helps me relax after work.'},
  {id:'opinions',title:'Share your opinion',icon:'◇',role:'a speaking partner asking IELTS Part 3-style discussion questions',goal:'Nêu quan điểm, giải thích và đưa ví dụ cụ thể.',opening:'How has technology changed the way people learn?',translation:'Công nghệ đã thay đổi cách mọi người học như thế nào?',hint:'I think technology makes learning more accessible. For example…'},
  {id:'free-talk',title:'Free conversation',icon:'✦',role:'a friendly English conversation partner',goal:'Chọn chủ đề của bạn và luyện một cuộc hội thoại tự nhiên.',opening:'What would you like to talk about today?',translation:'Hôm nay bạn muốn nói về chủ đề gì?',hint:'I would like to talk about a trip I am planning.'}
 ];
 const levels=['A2','B1','B2'];
 // One shared deadline contract for the server, composer and recorder.
 function requestBudget(input={}){
  const longAnswer=typeof input.text==='string' && input.text.trim().split(/\s+/).length>=120;
  const serverMs=input.stage==='transcribe'?(input.durationMs>30000?30000:12000):input.stage==='assess'?20000:longAnswer?25000:10000;
  return {serverMs,clientMs:serverMs+5000};
 }
 function scenario(id){return scenarios.find(item=>item.id===id);}
 function validTurn(turn){return turn && ['user','assistant'].includes(turn.role) && typeof turn.text==='string' && turn.text.trim() && turn.text.length<=(turn.role==='user'?6000:800);}
 function restore(value){
  if(!value || !scenario(value.scenario) || !levels.includes(value.level) || !Array.isArray(value.messages) || value.messages.length>25 || !value.messages.every(validTurn))return null;
  if(!value.messages.length || value.messages[0].role!=='assistant' || value.messages.at(-1).role!=='assistant' || value.messages.some((item,i)=>item.role!==(i%2?'user':'assistant')))return null;
  return {scenario:value.scenario,level:value.level,messages:value.messages.map(item=>({role:item.role,text:item.text.trim(),...(typeof item.translation==='string' && item.translation.length<=900?{translation:item.translation,translationLanguage:typeof item.translationLanguage==='string'?item.translationLanguage:'vi'}:{}),...(item.feedback && typeof item.feedback==='object'?{feedback:item.feedback}:{}),...(Array.isArray(item.pronunciation)?{pronunciation:item.pronunciation.slice(0,3)}:{})}))};
 }
 function fresh(id='coffee',level='B1'){
  const item=scenario(id) || scenarios[0];return {scenario:item.id,level:levels.includes(level)?level:'B1',messages:[{role:'assistant',text:item.opening,translation:item.translation,translationLanguage:'vi'}]};
 }
 function context(state){return state.messages.slice(-11).map(({role,text})=>({role,text}));}
 function add(state,response){
  if(!response || typeof response.transcript!=='string' || !response.transcript.trim() || typeof response.reply!=='string' || !response.reply.trim())throw Error('Chưa nhận được phản hồi. Hãy thử lại.');
  const messages=[...state.messages,{role:'user',text:response.transcript,feedback:{translationLanguage:response.translationLanguage || 'vi',improved:response.improved,note:response.feedback,phrase:response.phrase,corrections:response.corrections || [],collocations:response.collocations || [],...(typeof response.liveTranscript==='string' && response.liveTranscript.length<=6000?{liveTranscript:response.liveTranscript}:{}),...(response.speakingFlow?{speakingFlow:response.speakingFlow}:{}),...(response.coachingPartial?{partial:true}:{})}},{role:'assistant',text:response.reply,translation:response.translation,translationLanguage:response.translationLanguage || 'vi',pronunciation:response.pronunciation}];
  // Keep the opening and the latest twelve complete exchanges, never half a turn.
  return {...state,messages:messages.length>25?[messages[0],...messages.slice(-24)]:messages};
 }
 function sessionFrom(state){return {scenario:state.scenario,level:state.level,turns:state.messages.filter(turn=>turn.role==='user').map((turn,i)=>({text:turn.text,question:state.messages[i*2].text})),report:null};}
 function validReport(report){
  const score=value=>value===null || Number.isFinite(value) && value>=0 && value<=9 && Number.isInteger(value*2);
  const text=(value,max)=>typeof value==='string' && value.trim() && value.length<=max;
  if(!report || report.stage!=='assess' || !score(report.overall) || !text(report.summary,900) || !text(report.notice,2000) || !Array.isArray(report.nextSteps) || report.nextSteps.length<1 || report.nextSteps.length>3 || !report.nextSteps.every(step=>text(step,400)))return false;
  if(!['fluency','vocabulary','grammar','pronunciation'].every(key=>{const item=report.criteria?.[key];return item && score(item.band) && text(item.feedback,1200) && typeof item.quote==='string' && item.quote.length<=1000;}))return false;
  const coverage=report.coverage;
  if(!coverage || !Number.isInteger(coverage.turns) || coverage.turns<1 || coverage.turns>100 || !Number.isInteger(coverage.words) || coverage.words<80 || coverage.words>60000 || !Number.isFinite(coverage.audioSeconds) || coverage.audioSeconds<0 || coverage.audioSeconds>18000)return false;
  return report.overall===null || coverage.allSpoken===true && coverage.allAcoustic!==false && coverage.audioSeconds>=30 && ['fluency','vocabulary','grammar','pronunciation'].every(key=>report.criteria[key].band!==null);
 }
 function restoreSession(value,state){
  if(!value || value.scenario!==state.scenario || value.level!==state.level || !Array.isArray(value.turns) || value.turns.length>100 || !value.turns.every(turn=>validTurn({role:'user',text:turn.text}) && validTurn({role:'assistant',text:turn.question}) && (!turn.speechReceipt || typeof turn.speechReceipt==='string' && turn.speechReceipt.length<=18000)))return sessionFrom(state);
  const last=state.messages.at(-2);if(last && value.turns.at(-1)?.text!==last.text)return sessionFrom(state);
  // A stale/corrupt report must never crash the composer or delete the journal.
  return {...value,report:validReport(value.report)?value.report:null};
 }
 function sessionWords(session){return session.turns.reduce((sum,turn)=>sum+turn.text.trim().split(/\s+/).length,0);}
 function canSend(session,text){return !session.report && session.turns.length<100 && session.turns.reduce((sum,turn)=>sum+turn.text.length+turn.question.length,0)+text.length+800<=60000;}
 return {scenarios,levels,scenario,restore,fresh,context,add,sessionFrom,restoreSession,sessionWords,canSend,requestBudget};
});
