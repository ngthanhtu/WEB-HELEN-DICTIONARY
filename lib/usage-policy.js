'use strict';
const crypto=require('node:crypto');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const error=(message,status,code)=>Object.assign(new Error(message),{status,code});
function createPronunciationPolicy(secret,{now=Date.now}={}) {
  const key=crypto.createHmac('sha256',secret || crypto.randomBytes(32)).update('Helen pronunciation v1').digest();
  const sign=value=>crypto.createHmac('sha256',key).update(value).digest('base64url');
  function issue(text) {const payload=`${Math.floor(now()/1000)+604800}.${digest(text)}`;return `${payload}.${sign(payload)}`;}
  function verify(text,proof) {
    if(typeof proof!=='string' || proof.length>160)return false;
    const parts=proof.split('.');if(parts.length!==3 || !/^\d{10}$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1]) || !/^[\w-]{43}$/.test(parts[2]))return false;
    const expiry=Number(parts[0]);
    if(expiry<now()/1000 || expiry>now()/1000+604801 || parts[1]!==digest(text))return false;
    return crypto.timingSafeEqual(Buffer.from(parts[2]),Buffer.from(sign(`${parts[0]}.${parts[1]}`)));
  }
  // Only dictionary/lesson fields are eligible. Translations and video prompts aren't read aloud.
  function texts(data) {
    const values=new Set(),add=value=>{if(typeof value==='string' && value.trim() && value.trim().length<=2000)values.add(value.trim());};
    const combinations=value=>{for(const group of ['teaching','examples','corpus'])for(const item of value?.[group] || []){add(item.phrase);add(item.example);}};
    const entry=value=>{add(value.word);for(const meaning of value.meanings || []){for(const example of meaning.usageExamples || [])add(example);for(const sense of meaning.senses || []){
      add(sense.definition);add(sense.example);for(const example of sense.examples || [])add(example);for(const example of sense.usageExamples || [])add(typeof example==='string'?example:example.text);
    }}combinations(value.collocations);};
    for(const value of data.entries || [])entry(value);
    for(const value of data.results || [])for(const item of value.entries || [])entry(item);
    combinations(data);
    if(data.provider==='Gemini' && Array.isArray(data.dialogue)){for(const value of [...(data.examples || []),...data.dialogue])add(value.text);add(data.scenario?.text);}
    return [...values].slice(0,250);
  }
  return {issue,verify,texts,attach:data=>({...data,pronunciation:texts(data).map(text=>({text,proof:issue(text),word:data.word || ''}))})};
}
function createUsagePolicy({database,env=process.env,now=Date.now}) {
  const limit=(name,fallback)=>{const value=Number(env[name]);return Number.isSafeInteger(value) && value>0?value:fallback;};
  const limits={ttsDay:limit('TTS_DAILY_CHARACTER_LIMIT',2000),ttsMonth:limit('TTS_MONTHLY_CHARACTER_LIMIT',9000),ttsDevice:limit('TTS_DEVICE_DAILY_CHARACTER_LIMIT',750),aiDay:limit('AI_DAILY_REQUEST_LIMIT',100),mwDay:limit('MW_DAILY_REQUEST_LIMIT',950),practicalDay:limit('PRACTICAL_DAILY_GENERATION_LIMIT',600),practicalDeviceDay:limit('PRACTICAL_DEVICE_DAILY_REPLY_LIMIT',100),practicalSpeechDay:limit('PRACTICAL_DEVICE_DAILY_TRANSCRIPTION_LIMIT',200),practicalAssessmentDay:limit('PRACTICAL_DEVICE_DAILY_ASSESSMENT_LIMIT',10)};
  limits.practicalNetworkDay=limit('PRACTICAL_IP_DAILY_REPLY_LIMIT',300);
  limits.practicalSpeechNetworkDay=limit('PRACTICAL_IP_DAILY_TRANSCRIPTION_LIMIT',600);
  limits.practicalAssessmentNetworkDay=limit('PRACTICAL_IP_DAILY_ASSESSMENT_LIMIT',30);
  limits.ttsNetwork=limit('TTS_IP_DAILY_CHARACTER_LIMIT',1500);
  limits.historyDay=limit('HISTORY_DAILY_EVENT_LIMIT',100000);
  limits.historyDevice=limit('HISTORY_DEVICE_DAILY_EVENT_LIMIT',500);
  limits.historyNetwork=limit('HISTORY_IP_DAILY_EVENT_LIMIT',2000);
  async function reserve(kind,units,device='',network='') {
    if(env.NODE_ENV!=='production')return;
    const date=new Date(now()),day=date.toISOString().slice(0,10),month=day.slice(0,7);
    const dayEnd=new Date(`${day}T00:00:00Z`).getTime()+86400000,monthEnd=Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1);
    const practical=['practical','practical-speech','practical-assessment'].includes(kind),transcribing=kind==='practical-speech',assessing=kind==='practical-assessment';
    const rules=practical?[{bucket:'practical-day',key:day,limit:limits.practicalDay,expiresAt:dayEnd},{bucket:assessing?'practical-assess-device':transcribing?'practical-speech-device':'practical-reply-device',key:`${day}:${device}`,limit:assessing?limits.practicalAssessmentDay:transcribing?limits.practicalSpeechDay:limits.practicalDeviceDay,expiresAt:dayEnd}]:kind==='tts'?[{bucket:'tts-day',key:day,limit:limits.ttsDay,expiresAt:dayEnd},{bucket:'tts-month',key:month,limit:limits.ttsMonth,expiresAt:monthEnd},{bucket:'tts-device',key:`${day}:${device}`,limit:limits.ttsDevice,expiresAt:dayEnd}]:[{bucket:kind==='mw'?'mw-day':'ai-day',key:day,limit:kind==='mw'?limits.mwDay:limits.aiDay,expiresAt:dayEnd}];
    if(kind==='history')rules.splice(0,rules.length,{bucket:'history-day',key:day,limit:limits.historyDay,expiresAt:dayEnd},{bucket:'history-device',key:`${day}:${device}`,limit:limits.historyDevice,expiresAt:dayEnd});
    if(network && (practical || kind==='history' || kind==='tts'))rules.push({bucket:kind==='history'?'history-ip':kind==='tts'?'tts-ip':assessing?'practical-assess-ip':transcribing?'practical-speech-ip':'practical-reply-ip',key:`${day}:network:${network}`,limit:kind==='history'?limits.historyNetwork:kind==='tts'?limits.ttsNetwork:assessing?limits.practicalAssessmentNetworkDay:transcribing?limits.practicalSpeechNetworkDay:limits.practicalNetworkDay,expiresAt:dayEnd});
    const accepted=kind==='tts' && database.reserveTTS?await database.reserveTTS({at:date.getTime(),units,device,limits,...(network?{network}:{})}):kind==='ai' && database.reserveAI?await database.reserveAI({at:date.getTime(),units,limit:limits.aiDay}):await database.reserveUsage(rules.map(rule=>({...rule,key:digest(rule.key),units})),{isolatedAI:practical});
    if(!accepted)throw error(kind==='history'?'Đã đạt hạn mức đồng bộ hôm nay. Lịch sử vẫn lưu trên thiết bị; sẽ thử lại sau.':kind==='tts'?'Đã hết lượt giọng AI. Chọn giọng máy để tiếp tục nghe.':assessing?'Đã hết lượt đánh giá hôm nay. Kết quả đã lưu vẫn xem được; đặt lại lúc 07:00 giờ Việt Nam.':practical?'Đã đạt hạn mức luyện nói hôm nay cho thiết bị hoặc mạng này. Hãy quay lại sau khi hạn mức đặt lại lúc 07:00 giờ Việt Nam.':'Đã hết lượt AI hôm nay. Tra từ và ôn tập vẫn dùng được.',429,'USAGE_LIMIT');
  }
  return {limits,reserve};
}
module.exports={createPronunciationPolicy,createUsagePolicy,error};
