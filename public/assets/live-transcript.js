(function(root){
 'use strict';
 // Optional browser captions never replace the full audio recording or become
 // verified acoustic evidence. Result slots are replaced, not concatenated.
 function create(){
  const Recognition=root.SpeechRecognition || root.webkitSpeechRecognition;let active=null;
  function start({language='en-US',onChange,onState}={}){
   cancel();const session={base:'',slots:[],running:true,closed:false,restarts:0};active=session;
   const text=()=>[session.base,...session.slots.map(item=>item.text)].filter(Boolean).join(' ').trim().slice(0,6000);
   const state=value=>{if(!session.closed)try{onState?.(value);}catch{}};
   const changed=()=>{if(!session.closed)try{onChange?.({text:text(),provisional:true,source:'browser'});}catch{}};
   function close(){root.clearTimeout(session.restart);root.clearTimeout(session.finish);session.closed=true;if(active===session)active=null;}
   const handle={get text(){return text();},stop(){
    if(session.closed)return;session.running=false;root.clearTimeout(session.restart);state('stopped');
    try{session.recognition?.stop();}catch{}changed();session.finish=root.setTimeout(close,1000);
   },cancel(){if(session.closed)return;changed();session.running=false;close();try{session.recognition?.abort();}catch{}}};
   session.handle=handle;
   if(!Recognition){state('unsupported');session.running=false;close();return handle;}
   function listen(){
    if(!session.running || session.closed || active!==session)return;
    const recognition=new Recognition();session.recognition=recognition;session.slots=[];session.started=root.performance?.now?.() ?? Date.now();
    recognition.lang=language;recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=1;
    recognition.onstart=()=>state('listening');
    recognition.onresult=event=>{
     if(session.closed || session.recognition!==recognition)return;
     const results=event.results || [];session.slots.length=results.length;
     for(let i=event.resultIndex || 0;i<results.length;i++)session.slots[i]={text:typeof results[i]?.[0]?.transcript==='string'?results[i][0].transcript.trim():'',final:results[i]?.isFinal===true};
     changed();
    };
    recognition.onerror=event=>{
     if(session.closed)return;
     if(event.error==='no-speech')return; // Pauses are normal in a three-minute answer.
     if(event.error==='aborted' && !session.running)return;
     session.running=false;state(event.error==='not-allowed' || event.error==='service-not-allowed'?'permission':'unavailable');changed();close();
    };
    recognition.onend=()=>{
     if(session.closed || session.recognition!==recognition)return;
     session.base=text();session.slots=[];changed();
     if(!session.running){close();return;}
     if((root.performance?.now?.() ?? Date.now())-session.started<800){if(++session.restarts>2){session.running=false;state('unavailable');close();return;}}else session.restarts=0;
     // Some mobile recognizers end after a pause even with continuous=true.
     // Restart only while the main recorder is active; permission/network
     // errors stop captions and never stop or restart the audio recorder.
     state('restarting');session.restart=root.setTimeout(listen,250);
    };
    try{recognition.start();}catch{session.running=false;state('unavailable');close();}
   }
   listen();return handle;
  }
  function cancel(){active?.handle.cancel();}
  return {available:()=>Boolean(Recognition),start,cancel};
 }
 root.HelenLiveTranscript={create};
})(typeof globalThis==='undefined'?this:globalThis);
