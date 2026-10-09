(function(root){
  'use strict';
  const KEY='helen-habits-v1',goals=[5,10,20];
  function day(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function previous(value){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()-1);return day(date);}
  const validDay=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00`)) && day(new Date(`${value}T12:00:00`))===value;
  const empty=()=>({version:1,goal:5,days:{}});
  function sanitize(value){const state=empty();if(value?.version!==1)return state;if(goals.includes(value.goal))state.goal=value.goal;
    for(const key of Object.keys(value.days || {}).filter(validDay).sort().slice(-400)){const item=value.days[key];if(item && Number.isInteger(item.count) && item.count>=0 && goals.includes(item.goal))state.days[key]={count:Math.min(item.count,10000),goal:item.goal};}return state;
  }
  function read(storage){try{return sanitize(JSON.parse(storage.getItem(KEY) || 'null'));}catch{return empty();}}
  function write(storage,value){try{storage.setItem(KEY,JSON.stringify(sanitize(value)));return true;}catch{return false;}}
  function record(value,date=new Date()){const state=sanitize(value),key=day(date),old=state.days[key] || {count:0,goal:state.goal};state.days[key]={count:old.count+1,goal:old.goal};return sanitize(state);}
  function setGoal(value,goal){const state=sanitize(value);if(goals.includes(goal))state.goal=goal;return state;}
  function progress(value,date=new Date()){const state=sanitize(value),key=day(date),today=state.days[key] || {count:0,goal:state.goal};
    let cursor=today.count>=today.goal?key:previous(key),streak=0;
    while(state.days[cursor]?.count>=state.days[cursor]?.goal){streak++;cursor=previous(cursor);}
    return {...today,streak,complete:today.count>=today.goal,percent:Math.min(100,Math.round(today.count/today.goal*100))};
  }
  function merge(a,b){const left=sanitize(a),right=sanitize(b);for(const [key,item] of Object.entries(right.days))if(!left.days[key] || left.days[key].count<item.count)left.days[key]=item;return sanitize(left);}
  const api={KEY,goals,day,previous,empty,sanitize,read,write,record,setGoal,progress,merge};root.HelenHabits=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
