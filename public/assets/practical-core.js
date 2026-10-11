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
 function scenario(id){return scenarios.find(item=>item.id===id);}
 function validTurn(turn){return turn && ['user','assistant'].includes(turn.role) && typeof turn.text==='string' && turn.text.trim() && turn.text.length<=(turn.role==='user'?6000:800);}
 function restore(value){
  if(!value || !scenario(value.scenario) || !levels.includes(value.level) || !Array.isArray(value.messages) || value.messages.length>25 || !value.messages.every(validTurn))return null;
  if(!value.messages.length || value.messages[0].role!=='assistant' || value.messages.at(-1).role!=='assistant' || value.messages.some((item,i)=>item.role!==(i%2?'user':'assistant')))return null;
  return {scenario:value.scenario,level:value.level,messages:value.messages.map(item=>({role:item.role,text:item.text.trim(),...(typeof item.translation==='string' && item.translation.length<=900?{translation:item.translation}:{}),...(item.feedback && typeof item.feedback==='object'?{feedback:item.feedback}:{}),...(Array.isArray(item.pronunciation)?{pronunciation:item.pronunciation.slice(0,3)}:{})}))};
 }
 function fresh(id='coffee',level='B1'){
  const item=scenario(id) || scenarios[0];return {scenario:item.id,level:levels.includes(level)?level:'B1',messages:[{role:'assistant',text:item.opening,translation:item.translation}]};
 }
 function context(state){return state.messages.slice(-11).map(({role,text})=>({role,text}));}
 function add(state,response){
  if(!response || typeof response.transcript!=='string' || !response.transcript.trim() || typeof response.reply!=='string' || !response.reply.trim())throw Error('Chưa nhận được phản hồi. Hãy thử lại.');
  const messages=[...state.messages,{role:'user',text:response.transcript,feedback:{improved:response.improved,note:response.feedback,phrase:response.phrase,corrections:response.corrections || [],collocations:response.collocations || []}},{role:'assistant',text:response.reply,translation:response.translation,pronunciation:response.pronunciation}];
  // Keep the opening and the latest twelve complete exchanges, never half a turn.
  return {...state,messages:messages.length>25?[messages[0],...messages.slice(-24)]:messages};
 }
 function sessionFrom(state){return {scenario:state.scenario,level:state.level,turns:state.messages.filter(turn=>turn.role==='user').map((turn,i)=>({text:turn.text,question:state.messages[i*2].text})),report:null};}
 function restoreSession(value,state){
  if(!value || value.scenario!==state.scenario || value.level!==state.level || !Array.isArray(value.turns) || value.turns.length>100 || !value.turns.every(turn=>validTurn({role:'user',text:turn.text}) && validTurn({role:'assistant',text:turn.question}) && (!turn.speechReceipt || typeof turn.speechReceipt==='string' && turn.speechReceipt.length<=18000)))return sessionFrom(state);
  const last=state.messages.at(-2);if(last && value.turns.at(-1)?.text!==last.text)return sessionFrom(state);
  return {...value,report:value.report?.stage==='assess'?value.report:null};
 }
 function sessionWords(session){return session.turns.reduce((sum,turn)=>sum+turn.text.trim().split(/\s+/).length,0);}
 function canSend(session,text){return !session.report && session.turns.length<100 && session.turns.reduce((sum,turn)=>sum+turn.text.length+turn.question.length,0)+text.length+800<=60000;}
 return {scenarios,levels,scenario,restore,fresh,context,add,sessionFrom,restoreSession,sessionWords,canSend};
});
