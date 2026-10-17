'use strict';
const i18n=require('../public/assets/i18n');

// These are observations of the transcript, never measurements of pace,
// silence, pronunciation or an IELTS score. Natural discourse markers such
// as "like", "so" and "well" are deliberately not labelled as fillers.
function filler(word){
 if(word===word.toUpperCase())return null; // ER/UM can be names or acronyms.
 const token=word.toLowerCase();
 if(/^u+m+$/.test(token))return 'um';
 if(/^u+h+$/.test(token))return 'uh';
 if(/^e+r+m+$/.test(token))return 'erm';
 if(/^e+r+$/.test(token))return 'er';
 if(/^h+m+$/.test(token))return 'hmm';
 return null;
}
function observe(text){
 const tokens=[...text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)].map(match=>({word:match[0],start:match.index,end:match.index+match[0].length})),counts=new Map();
 const words=tokens.filter(token=>{const type=filler(token.word);if(!type)return true;counts.set(type,(counts.get(type)||0)+1);return false;}),restarts=[];
 for(let i=0;i<words.length && restarts.length<3;i++){
  for(let size=4;size>=2;size--){
   if(i+size*2>words.length)continue;
   if(words.slice(i,i+size).every((word,j)=>word.word.toLowerCase()===words[i+size+j].word.toLowerCase())){
    const quote=text.slice(words[i].start,words[i+size*2-1].end);
    if(quote.length<=160)restarts.push(quote);i+=size*2-1;break;
   }
  }
 }
 return {source:'transcript',wordCount:tokens.length,fillerCount:[...counts.values()].reduce((sum,count)=>sum+count,0),counts:[...counts].map(([text,count])=>({text,count})),restarts};
}
const think={text:'Let me think for a moment.',translation:'Để mình suy nghĩ một chút.',purpose:'Khi cần thêm thời gian nghĩ ý.'};
const phrase={text:'How can I put this?',translation:'Mình nên diễn đạt điều này thế nào nhỉ?',purpose:'Khi đang tìm cách diễn đạt; không dùng cho mọi khoảng nghỉ.'};
const recall={text:'Let me think back to a specific example.',translation:'Để mình nhớ lại một ví dụ cụ thể.',purpose:'Khi cần nhớ một trải nghiệm có thật.'};
const example={text:'Let me give you an example.',translation:'Để mình đưa ra một ví dụ.',purpose:'Khi đã có ý và muốn giải thích rõ hơn.'};
const point={text:'The main point is…',translation:'Ý chính là…',purpose:'Khi muốn quay về ý chính thay vì bắt đầu lại cả câu.'};
function coaching(text,scenario,language='vi',translationLanguage=language){
 const local=(message,params)=>i18n.t(message,params,language);
 const data=observe(text);if(data.fillerCount<3 && !data.restarts.length)return null;
 return {...data,note:data.fillerCount>=3?local('Bản chép lời có {count} lần âm đệm như “um/uh”. Nếu lặp nhiều, hãy ngừng ngắn rồi tiếp tục từng ý; không cần nói liền mọi lúc.',{count:data.fillerCount}):local('Bản chép lời có cụm lặp liền nhau. Nếu bạn đang bắt đầu lại câu, hãy nói từng ý ngắn rồi thêm một ví dụ; cụm lặp để nhấn mạnh có thể vẫn phù hợp.'),
  strategy:local('Khoảng nghỉ tự nhiên là bình thường. Thử dừng 1–2 giây, chọn một cụm phù hợp rồi nói ý chính → lý do → ví dụ. Đừng thay mọi “um” bằng cùng một câu học thuộc.'),
  phrases:[think,scenario==='work' || scenario==='ielts-life'?recall:example,data.restarts.length?point:phrase].map(item=>({...item,translation:i18n.t(item.translation,{},translationLanguage),purpose:local(item.purpose)})),notice:local('Đếm theo bản chép lời, không đo độ dài khoảng nghỉ hoặc phát âm; số lần âm đệm không tự quyết định band.')};
}
function summary(texts){
 const result={source:'originalTranscript',fillerCount:0,counts:[],restarts:[]},counts=new Map();
 for(const text of texts){const data=observe(text);result.fillerCount+=data.fillerCount;for(const item of data.counts)counts.set(item.text,(counts.get(item.text)||0)+item.count);for(const quote of data.restarts)if(result.restarts.length<3)result.restarts.push(quote);}
 result.counts=[...counts].map(([text,count])=>({text,count}));return result;
}
module.exports={observe,coaching,summary};
