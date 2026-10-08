(function(root){
  'use strict';
  const KEY='helen-quiz-sound';
  function create({AudioContext=root.AudioContext || root.webkitAudioContext,storage}={}){
    if(!storage){try{storage=root.localStorage;}catch{}}
    let enabled=true,context,ticket=0,nodes=[];
    try{enabled=storage?.getItem(KEY)!=='off';}catch{}
    function stop(){ticket++;for(const node of nodes){try{node.stop();}catch{}}nodes=[];}
    function setEnabled(value){enabled=Boolean(value);if(!enabled)stop();try{storage?.setItem(KEY,enabled?'on':'off');}catch{}return enabled;}
    async function play(correct){
      if(!enabled || typeof AudioContext!=='function')return false;
      stop();const current=ticket;
      try{
        if(!context || context.state==='closed')context=new AudioContext();
        // Called directly by the answer click/submit so Safari can unlock audio.
        if(context.state!=='running')await context.resume();
        if(!enabled || current!==ticket || context.state!=='running')return false;
        const tones=correct?[[659.25,0,.18],[783.99,.12,.18],[1046.50,.24,.28]]:[[440,0,.17],[349.23,.14,.23]];
        for(const [frequency,offset,duration] of tones){
          const start=context.currentTime+offset,osc=context.createOscillator(),gain=context.createGain();
          osc.type='sine';osc.frequency.setValueAtTime(frequency,start);
          gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.08,start+.012);gain.gain.exponentialRampToValueAtTime(.001,start+duration);gain.gain.setValueAtTime(0,start+duration+.01);
          osc.connect(gain);gain.connect(context.destination);nodes.push(osc);
          osc.onended=()=>{osc.disconnect();gain.disconnect();nodes=nodes.filter(node=>node!==osc);};
          osc.start(start);osc.stop(start+duration+.02);
        }
        return true;
      }catch{return false;}
    }
    return {available:typeof AudioContext==='function',get enabled(){return enabled;},setEnabled,play,stop};
  }
  root.HelenQuizSounds={create};
  if(typeof module!=='undefined')module.exports={create,KEY};
})(typeof window==='undefined'?globalThis:window);
