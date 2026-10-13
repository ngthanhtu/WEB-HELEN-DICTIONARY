'use strict';
const crypto=require('node:crypto'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
// One autocommit UPDATE atomically guards and debits all counters on one row.
const SQL=`UPDATE helen_tts_usage SET day_units=IF(day_key=?,day_units,0)+?,month_units=IF(month_key=?,month_units,0)+?,devices=JSON_SET(IF(day_key=?,devices,JSON_OBJECT()),?,IF(day_key=?,COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(devices,?)) AS UNSIGNED),0),0)+?),day_key=?,month_key=? WHERE id=1 AND day_key<=? AND month_key<=? AND IF(day_key=?,day_units,0)+?<=? AND IF(month_key=?,month_units,0)+?<=? AND IF(day_key=?,COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(devices,?)) AS UNSIGNED),0),0)+?<=?`;
// Store an independent server-derived network counter in the same JSON row.
// Both paths and all ceilings are checked by one atomic UPDATE, not a second
// reservation or another network round trip before the voice starts.
const NETWORK_SQL=SQL.replace(')+?),day_key=',')+?, ?,IF(day_key=?,COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(devices,?)) AS UNSIGNED),0),0)+?),day_key=')+' AND IF(day_key=?,COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(devices,?)) AS UNSIGNED),0),0)+?<=?';
function windowAt(at){const day=new Date(at).toISOString().slice(0,10),month=day.slice(0,7);return {day,month,end:new Date(day+'T00:00:00Z').getTime()+86400000};}
function parameters({at,units,device,limits,network}){
 if(!Number.isSafeInteger(units) || units<1 || !/^[a-f0-9]{64}$/.test(device))throw Error('INVALID_TTS_BUDGET');
 if(network!==undefined && (!/^[a-f0-9]{64}$/.test(network) || !Number.isSafeInteger(limits.ttsNetwork) || limits.ttsNetwork<1))throw Error('INVALID_TTS_BUDGET');
 const {day,month}=windowAt(at),path='$.'+JSON.stringify(hash(`${day}:${device}`));
 const networkPath=network?'$.'+JSON.stringify(hash(`${day}:network:${network}`)):null;
 return [day,units,month,units,day,path,day,path,units,...(network?[networkPath,day,networkPath,units]:[]),day,month,day,month,day,units,limits.ttsDay,month,units,limits.ttsMonth,day,path,units,limits.ttsDevice,...(network?[day,networkPath,units,limits.ttsNetwork]:[])];
}
function legacy(rows,at){
 const {day,month,end}=windowAt(at),devices={};let dayUnits=0,monthUnits=0;
 for(const row of rows){const units=Number(row.units);if(!Number.isSafeInteger(units) || units<0)throw Error('INVALID_LEGACY_BUDGET');
  if(row.bucket==='tts-day' && row.key_hash===hash(day))dayUnits=units;
  if(row.bucket==='tts-month' && row.key_hash===hash(month))monthUnits=units;
  if(row.bucket==='tts-device' && new Date(row.expires_at).getTime()===end && /^[a-f0-9]{64}$/.test(row.key_hash))devices[row.key_hash]=units;
 }
 return [day,month,dayUnits,monthUnits,JSON.stringify(devices)];
}
module.exports={SQL,NETWORK_SQL,parameters,legacy,windowAt,hash};
