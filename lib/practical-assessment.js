'use strict';
const crypto=require('node:crypto');
const i18n=require('../public/assets/i18n');
const fail=(message,code='PRACTICAL_ASSESSMENT')=>Object.assign(Error(message),{status:422,code});
const wordCount=text=>text.trim().split(/\s+/).filter(Boolean).length;
const band=value=>Number.isFinite(value) && value>=0 && value<=9 && value*2===Math.round(value*2);
const text=(value,max)=>typeof value==='string' && value.trim() && value.length<=max;
const criteria=['fluency','vocabulary','grammar','pronunciation'];
const audioSchema={type:'object',properties:{...Object.fromEntries(['fluency','pronunciation'].map(key=>[key,{type:'object',properties:{band:{type:['number','null']},note:{type:'string'}},required:['band','note']}]))},required:['fluency','pronunciation']};
// The model selects a reference; the server supplies the learner's exact words.
// This avoids asking a generative model to reproduce an ASR transcript byte for byte.
const assessmentSchema={type:'object',properties:{summary:{type:'string'},criteria:{type:'object',properties:Object.fromEntries(criteria.map(key=>[key,{type:'object',properties:{band:{type:['number','null']},feedback:{type:'string'},evidenceId:{type:'string'}},required:['band','feedback','evidenceId']}])),required:criteria},nextSteps:{type:'array',minItems:1,maxItems:3,items:{type:'string'}}},required:['summary','criteria','nextSteps']};
const validDuration=value=>Number.isFinite(value) && value>0 && value<=180000;
const validObservations=value=>['fluency','pronunciation'].every(name=>value?.[name] && (value[name].band===null || band(value[name].band)) && text(value[name].note,500));
const scoredAudio=turn=>band(turn.audio?.fluency?.band) && band(turn.audio?.pronunciation?.band);
function referenceExcerpts(turns){
 const evidence=[];
 turns.forEach((turn,turnIndex)=>{
  const words=[...turn.answer.matchAll(/\S+/gu)];let start,end,ordinal=0;
  const append=()=>{if(start===undefined)return;evidence.push({id:`t${turnIndex+1}-e${++ordinal}`,turn:turnIndex+1,start,end,text:turn.answer.slice(start,end)});start=undefined;};
  for(const word of words){
   if(start!==undefined && word.index+word[0].length-start>240)append();
   // A single oversized token is not useful English evidence. Never truncate
   // it into another apparent word or invent a shortened supporting quote.
   if(word[0].length>240){append();continue;}
   if(start===undefined)start=word.index;end=word.index+word[0].length;
   // Group short sentences rather than creating thousands of metadata-heavy
   // excerpts for e.g. "a. a. a." within the bounded session input.
   if(end-start>=120 && /[.!?]["'”’)]?$/.test(word[0]))append();
  }
  append();
 });
 return evidence;
}
// Treat signed and decimal numbers as whole literals. Formatting tolerance must
// not turn -5 into 5, a decimal comma into a decimal point, or a word fragment
// into evidence that the learner never uttered as a complete word.
const tokens=value=>[...value.matchAll(/[+−-]?\p{N}+(?:[.,]\p{N}+)*(?![\p{L}\p{N}])|[\p{L}\p{N}]+(?:['’‘ʼ][\p{L}\p{N}]+)*/gu)].map(match=>({word:match[0].normalize('NFKC').replace(/[’‘ʼ]/g,"'").replace(/−/g,'-').toLowerCase(),start:match.index,end:match.index+match[0].length}));
function originalQuote(quote,answers){
 if(typeof quote!=='string' || !quote.trim() || quote.length>250)return null;
 const wanted=tokens(quote);if(!wanted.length)return null;
 for(const answer of answers){
  const source=tokens(answer);
  for(let index=0;index<=source.length-wanted.length;index++)if(wanted.every((token,offset)=>token.word===source[index+offset].word)){
   const original=answer.slice(source[index].start,source[index+wanted.length-1].end);
   if(original.length<=500)return original;
  }
 }
 return null;
}
function criterionQuote(item,session,acoustic=false){
 if(item.evidenceId!==undefined){
  const excerpt=typeof item.evidenceId==='string' && session.evidence?.find(value=>value.id===item.evidenceId);
  if(!excerpt || acoustic && !scoredAudio(session.turns[excerpt.turn-1]))return null;
  // Old/extra quote fields must still be grounded. An ID must never disguise
  // a paraphrase or invented quotation as something the learner actually said.
  return item.quote===undefined?excerpt.text:originalQuote(item.quote,[excerpt.text]);
 }
 return originalQuote(item.quote,session.turns.filter(turn=>!acoustic || scoredAudio(turn)).map(turn=>turn.answer));
}
// Acoustic observations are private, device-bound receipts. They are not
// proof of an official score. Never accept client-authored pronunciation bands.
function createSpeechEvidence(secret){
 const key=crypto.createHash('sha256').update('helen-speaking-evidence-v1:'+secret).digest();
 const sign=value=>crypto.createHmac('sha256',key).update(value).digest('base64url');
 function issue(transcript,value,durationMs,device){
  if(!text(transcript,6000) || !validDuration(durationMs) || !validObservations(value))return null;
  const payload=Buffer.from(JSON.stringify({v:1,transcript,observations:value,durationMs,device,expires:Date.now()+30*86400000})).toString('base64url');
  return payload+'.'+sign(payload);
 }
 function read(receipt,device){
  if(typeof receipt!=='string' || receipt.length>18000)return null;
  const [payload,signature,...extra]=receipt.split('.');if(!payload || !signature || extra.length)return null;
  const expected=Buffer.from(sign(payload)),actual=Buffer.from(signature);
  if(actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected))return null;
  try{const value=JSON.parse(Buffer.from(payload,'base64url').toString());return value.v===1 && value.device===device && value.expires>Date.now() && text(value.transcript,6000) && validDuration(value.durationMs) && validObservations(value.observations)?value:null;}catch{return null;}
 }
 return {issue,read};
}
function prepareSession(body,evidence,device){
 if(!Array.isArray(body.turns) || !body.turns.length || body.turns.length>100)throw fail('Chưa có đủ nội dung để đánh giá. Hãy nói thêm rồi kết thúc phiên.');
 let length=0;const receipts=new Set();
 const turns=body.turns.map(turn=>{
  if(!turn || !text(turn.text,6000) || !text(turn.question,800))throw fail('Dữ liệu phiên chưa hợp lệ. Mở lại hội thoại rồi thử đánh giá.');
  const spoken=evidence.read(turn.speechReceipt,device);if(spoken && receipts.has(turn.speechReceipt))throw fail('Một đoạn ghi âm không được tính nhiều lần trong cùng phiên.');if(spoken)receipts.add(turn.speechReceipt);const original=spoken?.transcript || turn.text.trim();length+=original.length+turn.question.length;
  if(length>60000)throw fail('Phiên quá dài để đánh giá một lần. Bắt đầu phiên mới ngắn hơn.');
  return {question:turn.question,answer:original,...(spoken?{audio:spoken.observations,durationMs:spoken.durationMs}:{})};
 });
 const words=turns.reduce((sum,turn)=>sum+wordCount(turn.answer),0),audioMs=turns.reduce((sum,turn)=>sum+(turn.durationMs || 0),0),assessedAudioMs=turns.reduce((sum,turn)=>sum+(scoredAudio(turn)?turn.durationMs:0),0);
 if(words<80)throw fail(`Cần ít nhất 80 từ để ước lượng band. Hiện có ${words} từ; hãy nói thêm.`, 'PRACTICAL_TOO_SHORT');
 const acoustic=assessedAudioMs>=30000;
 return {turns,words,audioMs,assessedAudioMs,acoustic,allSpoken:turns.every(turn=>turn.audio),allAcoustic:turns.every(scoredAudio),evidence:referenceExcerpts(turns),fillerSummary:require('./speaking-flow').summary(turns.map(turn=>turn.answer))};
}
function validateAssessment(value,session,language='vi'){
 const local=message=>i18n.t(message,{},language);
 if(!text(value?.summary,900) || !Array.isArray(value.nextSteps) || !value.nextSteps.length || value.nextSteps.length>3 || !value.nextSteps.every(item=>text(item,400)))throw fail('Đánh giá AI chưa đầy đủ. Hãy thử lại.');
 const result={};let partial=false,groundedText=0;
 for(const key of criteria){
  const acoustic=['fluency','pronunciation'].includes(key),missing=acoustic && !session.acoustic;
  // Unsupported acoustic output is not a reason to discard valid language
  // feedback. Ignore it altogether; neither a fabricated quote nor a band leaks.
  if(missing){result[key]={band:null,feedback:local('Chưa có đủ âm thanh để đánh giá. Hãy ghi âm tổng ít nhất 30 giây trong một phiên.'),quote:'',unavailableReason:'insufficient_audio'};continue;}
  const item=value.criteria?.[key],quote=item && criterionQuote(item,session,acoustic);
  const audioOnly=acoustic && item && (item.evidenceId==='' && (item.quote===undefined || item.quote==='') || item.evidenceId===undefined && item.quote==='');
  const valid=item && text(item.feedback,650) && band(item.band) && (quote || audioOnly);
  if(!valid){partial=true;result[key]={band:null,feedback:local('Chưa đủ dẫn chứng để chấm tiêu chí này. Ở phiên mới, hãy trả lời đầy đủ hơn để được đánh giá.'),quote:'',unavailableReason:'insufficient_evidence'};continue;}
  if(!acoustic)groundedText++;
  result[key]={band:item.band,feedback:item.feedback.trim(),quote:quote || ''};
 }
 if(!groundedText)throw fail('Nhận xét cần dẫn chứng từ câu của bạn. Hãy thử lại.');
 const full=session.acoustic && session.allSpoken && session.allAcoustic && criteria.every(key=>band(result[key].band));
 // If a criterion is ungrounded, its invented claim may also be repeated in
 // the free-form summary/steps. Keep only accepted criterion feedback and use
 // neutral server-authored framing for the partial report.
 const notice=local(partial?'Chỉ đánh giá các tiêu chí có đủ dẫn chứng. Chưa đủ dữ liệu để ước lượng band tổng.':full?'Band ước lượng bởi AI, không phải điểm IELTS chính thức.':'Chỉ đánh giá các tiêu chí có đủ dữ liệu. Band tổng cần một phiên nói bằng micro có đủ âm thanh.');
 const summary=partial?notice:value.summary.trim();
 const nextSteps=partial?[local('Ở phiên mới, hãy trả lời một câu hỏi bằng ý chính và một ví dụ cụ thể.')]:value.nextSteps.map(item=>item.trim());
 return {stage:'assess',estimated:true,...(partial?{partial:true}:{}),overall:full?Math.round(criteria.reduce((sum,key)=>sum+result[key].band,0)/4*2)/2:null,summary,criteria:result,nextSteps,coverage:{turns:session.turns.length,words:session.words,audioSeconds:Math.round(session.audioMs/1000),assessedAudioSeconds:Math.round(session.assessedAudioMs/1000),allSpoken:session.allSpoken,allAcoustic:session.allAcoustic},notice};
}
module.exports={audioSchema,assessmentSchema,createSpeechEvidence,prepareSession,validateAssessment};
