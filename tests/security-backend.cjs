// Disposable production API fixture. No real database or provider calls.
const fs=require('node:fs');const usage=new Map(),histories=new Map(),report={aiCalls:0,ttsCalls:0,quotaChecks:0};
function save(){if(process.env.HELEN_SECURITY_FIXTURE_REPORT)fs.writeFileSync(process.env.HELEN_SECURITY_FIXTURE_REPORT,JSON.stringify(report));}
const reserve=async rules=>{report.quotaChecks++;if(rules.some(r=>(usage.get(r.bucket+':'+r.key)||0)+r.units>r.limit)){save();return false;}for(const r of rules)usage.set(r.bucket+':'+r.key,(usage.get(r.bucket+':'+r.key)||0)+r.units);save();return true;};
require('../lib/database').createDatabase=()=>({
 status:()=>({configured:true,connected:true,aiQuota:{connected:true},persistence:{}}),initialize:async()=>true,close:async()=>{},get:async()=>null,set:async()=>true,vocabulary:async()=>true,translationCache:async()=>[],translationValues:async()=>new Map(),setTranslations:async()=>true,prepareAI:async()=>{},prepareTTS:async()=>{},
 reserveUsage:reserve,reserveTTS:({at,units,device,network,limits})=>{const day=new Date(at).toISOString().slice(0,10);return reserve([{bucket:'tts-day',key:day,units,limit:limits.ttsDay},{bucket:'tts-month',key:day.slice(0,7),units,limit:limits.ttsMonth},{bucket:'tts-device',key:day+device,units,limit:limits.ttsDevice},...(network?[{bucket:'tts-ip',key:day+network,units,limit:limits.ttsNetwork}]:[])]);},
 history:async token=>[...(histories.get(token)||new Map()).values()],saveHistory:async(token,events)=>{const rows=histories.get(token)||new Map();for(const e of events){if(e.action==='clear')rows.clear();else rows.set(e.word,{word:e.word,at:e.at,count:1});}histories.set(token,rows);},metrics:async()=>{}
});
global.fetch=async(url,options={})=>{
 const address=String(url);
 if(address.includes('generateContent')){report.aiCalls++;save();const input=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({reply:'What do you enjoy about your work?',translation:'Bạn thích điều gì ở công việc?',phrase:{text:'gain experience',translation:'tích lũy kinh nghiệm'},feedback:'Hãy bổ sung ví dụ.',corrections:[],collocations:[]})}]},finishReason:'STOP'}]});}
 if(address.includes('/text-to-speech/')){report.ttsCalls++;save();return new Response('fixture-audio',{headers:{'Content-Type':'audio/mpeg'}});}
 if(address.includes('/v1/voices'))return Response.json({voices:[]});
 throw Error('UNEXPECTED_SECURITY_FIXTURE_PROVIDER');
};
save();
