'use strict';
const crypto=require('node:crypto');
const fail=(message,code='PRACTICAL_ASSESSMENT')=>Object.assign(Error(message),{status:422,code});
const wordCount=text=>text.trim().split(/\s+/).filter(Boolean).length;
const band=value=>Number.isFinite(value) && value>=0 && value<=9 && value*2===Math.round(value*2);
const text=(value,max)=>typeof value==='string' && value.trim() && value.length<=max;
const criteria=['fluency','vocabulary','grammar','pronunciation'];
const audioSchema={type:'object',properties:{...Object.fromEntries(['fluency','pronunciation'].map(key=>[key,{type:'object',properties:{band:{type:['number','null']},note:{type:'string'}},required:['band','note']}]))},required:['fluency','pronunciation']};
const assessmentSchema={type:'object',properties:{summary:{type:'string'},criteria:{type:'object',properties:Object.fromEntries(criteria.map(key=>[key,{type:'object',properties:{band:{type:['number','null']},feedback:{type:'string'},quote:{type:'string'}},required:['band','feedback','quote']}])),required:criteria},nextSteps:{type:'array',minItems:1,maxItems:3,items:{type:'string'}}},required:['summary','criteria','nextSteps']};
// Acoustic observations are private, device-bound receipts. They are not
// proof of an official score. Never accept client-authored pronunciation bands.
function createSpeechEvidence(secret){
 const key=crypto.createHash('sha256').update('helen-speaking-evidence-v1:'+secret).digest();
 const sign=value=>crypto.createHmac('sha256',key).update(value).digest('base64url');
 function issue(transcript,value,durationMs,device){
  if(!value || !Number.isFinite(durationMs))return null;
  for(const name of ['fluency','pronunciation'])if(!value[name] || value[name].band!==null && !band(value[name].band) || !text(value[name].note,500))return null;
  const payload=Buffer.from(JSON.stringify({v:1,transcript,observations:value,durationMs,device,expires:Date.now()+30*86400000})).toString('base64url');
  return payload+'.'+sign(payload);
 }
 function read(receipt,device){
  if(typeof receipt!=='string' || receipt.length>18000)return null;
  const [payload,signature,...extra]=receipt.split('.');if(!payload || !signature || extra.length)return null;
  const expected=Buffer.from(sign(payload)),actual=Buffer.from(signature);
  if(actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected))return null;
  try{const value=JSON.parse(Buffer.from(payload,'base64url').toString());return value.v===1 && value.device===device && value.expires>Date.now()?value:null;}catch{return null;}
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
 const words=turns.reduce((sum,turn)=>sum+wordCount(turn.answer),0),audioMs=turns.reduce((sum,turn)=>sum+(turn.durationMs || 0),0);
 if(words<80)throw fail(`Cần ít nhất 80 từ để ước lượng band. Hiện có ${words} từ; hãy nói thêm.`, 'PRACTICAL_TOO_SHORT');
 const acoustic=audioMs>=30000 && turns.some(turn=>band(turn.audio?.pronunciation?.band) && band(turn.audio?.fluency?.band));
 return {turns,words,audioMs,acoustic,allSpoken:turns.every(turn=>turn.audio),fillerSummary:require('./speaking-flow').summary(turns.map(turn=>turn.answer))};
}
function validateAssessment(value,session){
 if(!text(value?.summary,900) || !Array.isArray(value.nextSteps) || !value.nextSteps.length || value.nextSteps.length>3 || !value.nextSteps.every(item=>text(item,400)))throw fail('Đánh giá AI chưa đầy đủ. Hãy thử lại.');
 const result={};
 for(const key of criteria){
  const item=value.criteria?.[key];if(!item || !text(item.feedback,650) || typeof item.quote!=='string' || item.quote.length>250 || item.band!==null && !band(item.band))throw fail('Đánh giá AI chưa hợp lệ. Hãy thử lại.');
  if(item.quote && !session.turns.some(turn=>turn.answer.includes(item.quote)))throw fail('Nhận xét chưa khớp lời bạn nói. Hãy thử lại.');
  if(['grammar','vocabulary'].includes(key) && (item.band===null || !item.quote))throw fail('Nhận xét cần dẫn chứng từ câu của bạn. Hãy thử lại.');
  const missing=['fluency','pronunciation'].includes(key) && !session.acoustic;
  result[key]={band:missing?null:item.band,feedback:missing?'Chưa có đủ âm thanh để đánh giá. Hãy ghi âm tổng ít nhất 30 giây trong một phiên.':item.feedback.trim(),quote:item.quote};
 }
 const full=session.acoustic && session.allSpoken && criteria.every(key=>band(result[key].band));
 return {stage:'assess',estimated:true,overall:full?Math.round(criteria.reduce((sum,key)=>sum+result[key].band,0)/4*2)/2:null,summary:value.summary.trim(),criteria:result,nextSteps:value.nextSteps.map(item=>item.trim()),coverage:{turns:session.turns.length,words:session.words,audioSeconds:Math.round(session.audioMs/1000),allSpoken:session.allSpoken},notice:full?'Band ước lượng bởi AI, không phải điểm IELTS chính thức.':'Chỉ đánh giá các tiêu chí có đủ dữ liệu. Band tổng cần một phiên nói bằng micro có đủ âm thanh.'};
}
module.exports={audioSchema,assessmentSchema,createSpeechEvidence,prepareSession,validateAssessment};
