(function(root){
  'use strict';
  const study=root.HelenStudyCore || (typeof require==='function'?require('./study-core'):null),library=root.HelenStudyLibrary || (typeof require==='function'?require('./study-library'):null),habits=root.HelenHabits || (typeof require==='function'?require('./habit-core'):null);
  const topics=root.HelenTopicsCore || (typeof require==='function'?require('./topics-core'):null),MAX_BYTES=5*1024*1024;
  const favorites=value=>[...new Set((Array.isArray(value)?value:[]).filter(word=>typeof word==='string' && word.trim() && word.length<=100 && !/[\x00-\x1f<>]/.test(word)).map(study.answer))];
  function normalize(value){
    if(value?.format!=='helen-learning-backup' || value.version!==1 || !Array.isArray(value.favorites) || value.favorites.length>500 || !Array.isArray(value.study?.cards) || value.study.cards.length>500 || value.library?.version!==1 || value.habits?.version!==1)throw Error('Không phải bản sao lưu Helen hợp lệ.');
    const selected=favorites(value.favorites);if(selected.length!==value.favorites.length)throw Error('Bản sao lưu có từ không hợp lệ hoặc trùng nhau.');
    const cards=study.read({getItem:()=>JSON.stringify({version:1,cards:value.study.cards})}).filter(card=>selected.includes(card.word));
    return {format:'helen-learning-backup',version:1,createdAt:typeof value.createdAt==='string'?value.createdAt:'',favorites:selected,study:{version:1,cards},library:library.sanitize(value.library),habits:habits.sanitize(value.habits),topics:topics.sanitize(value.topics)};
  }
  function snapshot(storage){let selected=[];try{selected=favorites(JSON.parse(storage.getItem('helen-favorites') || '[]'));}catch{}
    return normalize({format:'helen-learning-backup',version:1,createdAt:new Date().toISOString(),favorites:selected,study:{version:1,cards:study.read(storage)},library:library.read(storage),habits:habits.read(storage),topics:topics.read(storage)});
  }
  function parse(text){if(typeof text!=='string' || new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Bản sao lưu tối đa 5 MB.');let value;try{value=JSON.parse(text);}catch{throw Error('File JSON không đọc được.');}return normalize(value);}
  function merge(current,incoming){
    const a=normalize(current),b=normalize(incoming),selected=favorites([...a.favorites,...b.favorites]);if(selected.length>500)throw Error('Sau khi nhập sẽ vượt 500 từ. Giảm số từ rồi thử lại.');
    const cards=new Map(a.study.cards.map(card=>[card.word,card]));for(const card of b.study.cards){const old=cards.get(card.word);if(!old || (card.lastReviewedAt || 0)>(old.lastReviewedAt || 0) || card.lastReviewedAt===old.lastReviewedAt && card.reviews>old.reviews)cards.set(card.word,card);}
    let sets=library.sanitize(a.library);for(const deck of b.library.decks){const old=sets.decks.find(value=>value.name.toLowerCase()===deck.name.toLowerCase());let id=old?.id || deck.id;
      if(!old && sets.decks.some(value=>value.id===id)){let suffix=1;while(sets.decks.some(value=>value.id===`import-${suffix}`))suffix++;id=`import-${suffix}`;}
      sets=library.setDeck(sets,{id,name:deck.name,selected:[...(old?.words || []),...deck.words]});
    }
    const unique=(left,right,key)=>{const seen=new Set();return [...left,...right].filter(item=>{const id=key(item);if(seen.has(id))return false;seen.add(id);return true;}).sort((x,y)=>x.at-y.at);};
    sets=library.sanitize({...sets,attempts:unique(a.library.attempts,b.library.attempts,value=>JSON.stringify(value)),sessions:unique(a.library.sessions,b.library.sessions,value=>JSON.stringify(value)),difficult:[...a.library.difficult,...b.library.difficult]});
    return normalize({...a,favorites:selected,study:{version:1,cards:[...cards.values()]},library:sets,habits:habits.merge(a.habits,b.habits),topics:topics.merge(a.topics,b.topics)});
  }
  function restore(storage,value){const next=merge(snapshot(storage),value),writes=[['helen-favorites',next.favorites],[study.KEY,next.study],[library.KEY,next.library],[habits.KEY,next.habits],[topics.KEY,next.topics]],old=writes.map(([key])=>[key,storage.getItem(key)]);
    try{for(const [key,data] of writes)storage.setItem(key,JSON.stringify(data));}
    catch{for(const [key,data] of old)try{if(data===null)storage.removeItem(key);else storage.setItem(key,data);}catch{}throw Error('Bộ nhớ đầy. Chưa nhập dữ liệu; hãy giữ file sao lưu và giải phóng dung lượng.');}return next;
  }
  const safeCell=value=>/^[\s]*[=+@-]|^[\t\r\n]/.test(value)?`'${value}`:value;
  const html=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function license(source){if(/WordNet/i.test(source))return 'https://wordnet.princeton.edu/license-and-commercial-use';if(/Wiktionary/i.test(source))return 'https://creativecommons.org/licenses/by-sa/4.0/';return 'See source terms; source license applies';}
  function rows(value){const cards=new Map(value.study.cards.map(card=>[card.word,card]));return value.favorites.flatMap(word=>{
    const card=cards.get(word);return card?.senses.length?card.senses.map(sense=>[word,sense.pos,sense.definition,sense.examples[0] || '',sense.source,license(sense.source)]):[[word,'','','','','']];
  });}
  function csv(value){return '\uFEFF'+[['Word','Part of speech','Definition','Example','Source','License'],...rows(normalize(value))].map(row=>row.map(cell=>`"${safeCell(String(cell)).replace(/"/g,'""')}"`).join(',')).join('\r\n');}
  function anki(value){const grouped=new Map();for(const [word,pos,definition,example,source,terms] of rows(normalize(value))){if(!grouped.has(word))grouped.set(word,[]);grouped.get(word).push([pos,definition,example,source,terms].filter(Boolean).map(html).join('<br>'));}
    return '#separator:tab\n#html:true\n'+[...grouped].map(([word,senses])=>`${html(safeCell(word))}\t${senses.join('<hr>')}`).join('\n');}
  const api={MAX_BYTES,snapshot,parse,normalize,merge,restore,csv,anki};root.HelenBackup=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
