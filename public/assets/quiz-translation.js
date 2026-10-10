(function(root){
  'use strict';
  function chunks(text){
    let remaining=String(text || '').trim();const parts=[];
    // Study source sentences can contain 600 characters; translate every part
    // within the existing API's 450-character limit, never silently truncate.
    while(remaining.length>450){let end=remaining.lastIndexOf(' ',450);if(end<1)end=450;parts.push(remaining.slice(0,end));remaining=remaining.slice(end).trimStart();}
    if(remaining)parts.push(remaining);return parts;
  }
  function items(question){
    const definition=question.definition || (question.type!=='cloze'?question.prompt:'');
    return [definition?{id:'definition',label:question.type==='cloze'?'Nghĩa':'Đề bài',text:definition,kind:'definition',...(question.definitionVi?{translationVi:question.definitionVi}:{})}:null,
      question.original?{id:'sentence',label:question.type==='cloze'?'Đề bài (đã điền đáp án)':'Câu ví dụ',text:question.original,kind:'sentence',...(question.originalVi?{translationVi:question.originalVi}:{})}:null].filter(Boolean);
  }
  async function translate(question,to,translateTexts){
    return Promise.all(items(question).map(async item=>{
      try{
        const parts=chunks(item.text),values=to==='vi' && item.translationVi?[item.translationVi]:to==='en'?parts:await translateTexts(parts,'en',to,item.kind==='definition'?{kind:'definition',...(question.definitionVi?{translationVi:question.definitionVi}:{})}:{});
        if(!Array.isArray(values) || values.length!==parts.length || !values.every(value=>typeof value==='string' && value.trim()))throw Error('Chưa nhận được bản dịch. Hãy thử lại.');
        return {...item,translation:values.join(' ')};
      }catch(error){return {...item,error:error?.message || 'Chưa dịch được. Hãy thử lại.'};}
    }));
  }
  root.HelenQuizTranslation={items,chunks,translate};
  if(typeof module!=='undefined')module.exports=root.HelenQuizTranslation;
})(typeof window==='undefined'?globalThis:window);
