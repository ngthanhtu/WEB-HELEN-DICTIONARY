(function(root){
  'use strict';
  const KEY='helen-learning-library-v1',MAX_DECKS=20;
  const clean=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  const word=value=>clean(value).toLowerCase().replace(/[’‘]/g,"'");
  const words=values=>[...new Set((Array.isArray(values)?values:[]).map(word).filter(v=>v && v.length<=100))].slice(0,100);
  const number=value=>Number.isFinite(value) && value>=0?Math.min(Math.floor(value),1000000):0;
  function empty(){return {version:1,decks:[],attempts:[],sessions:[],difficult:[]};}
  function sanitize(value){
    const state=empty();if(value?.version!==1)return state;
    const ids=new Set(),names=new Set();
    for(const deck of Array.isArray(value.decks)?value.decks:[]){
      const id=clean(deck?.id),name=clean(deck?.name);
      if(!/^[\w-]{1,80}$/.test(id) || !name || name.length>50 || ids.has(id) || names.has(name.toLowerCase()))continue;
      state.decks.push({id,name,words:words(deck.words)});ids.add(id);names.add(name.toLowerCase());if(state.decks.length===MAX_DECKS)break;
    }
    state.attempts=(Array.isArray(value.attempts)?value.attempts:[]).filter(item=>word(item?.word) && word(item.word).length<=100 && typeof item.correct==='boolean' && ['mixed','choice','cloze','type','matching'].includes(item.mode) && Number.isFinite(item.at) && item.at>=0).slice(-500).map(item=>({word:word(item.word),correct:item.correct,mode:item.mode,at:item.at}));
    state.sessions=(Array.isArray(value.sessions)?value.sessions:[]).filter(item=>['review','mixed','choice','cloze','type','matching'].includes(item?.mode) && Number.isFinite(item.at) && item.at>=0).slice(-100).map(item=>({mode:item.mode,total:number(item.total),correct:Math.min(number(item.correct),number(item.total)),at:item.at}));
    state.difficult=words(value.difficult);return state;
  }
  function read(storage){try{return sanitize(JSON.parse(storage?.getItem(KEY)||'null'));}catch{return empty();}}
  function write(storage,state){try{storage.setItem(KEY,JSON.stringify(sanitize(state)));return true;}catch{return false;}}
  function setDeck(state,{id,name,selected=[]}){
    name=clean(name);if(!name || name.length>50)throw Error('Tên bộ từ cần từ 1 đến 50 ký tự.');
    if(state.decks.some(deck=>deck.id!==id && deck.name.toLowerCase()===name.toLowerCase()))throw Error('Tên bộ từ đã có. Hãy chọn tên khác.');
    const existing=state.decks.find(deck=>deck.id===id);
    if(!existing && state.decks.length>=MAX_DECKS)throw Error('Đã có 20 bộ từ. Xóa một bộ trước khi thêm.');
    if(!/^[\w-]{1,80}$/.test(id || ''))throw Error('Bộ từ không hợp lệ.');
    const deck={id,name,words:words(selected)};
    return {...state,decks:existing?state.decks.map(item=>item.id===id?deck:item):[...state.decks,deck]};
  }
  function attempt(state,{word:input,correct,mode},at=Date.now()){
    return sanitize({...state,attempts:[...state.attempts,{word:input,correct,mode,at}]});
  }
  function completed(state,{mode,total,correct},at=Date.now()){
    return sanitize({...state,sessions:[...state.sessions,{mode,total,correct,at}]});
  }
  function statistics(state,cards,selected,now=Date.now()){
    const allowed=new Set(words(selected)),attempts=state.attempts.filter(item=>allowed.has(item.word)),correct=attempts.filter(item=>item.correct).length;
    const difficult=new Map();for(const item of attempts)if(!item.correct)difficult.set(item.word,(difficult.get(item.word)||0)+1);
    for(const item of state.difficult)if(allowed.has(item) && !difficult.has(item))difficult.set(item,0);
    const list=cards.filter(item=>allowed.has(item.word));
    return {answered:attempts.length,correct,accuracy:attempts.length?Math.round(correct/attempts.length*100):null,reviewed:list.filter(item=>item.reviews>0).length,due:list.filter(item=>item.dueAt<=now).length,
      difficult:[...difficult].map(([word,wrong])=>({word,wrong})).sort((a,b)=>b.wrong-a.wrong || a.word.localeCompare(b.word)),sessions:state.sessions.slice(-5).reverse()};
  }
  root.HelenStudyLibrary={KEY,MAX_DECKS,empty,sanitize,read,write,setDeck,attempt,completed,statistics,words};
  if(typeof module!=='undefined')module.exports=root.HelenStudyLibrary;
})(typeof window==='undefined'?globalThis:window);
