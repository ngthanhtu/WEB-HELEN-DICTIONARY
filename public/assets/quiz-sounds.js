(function(root){
  'use strict';
  const KEY='helen-quiz-sound';
  function create({AudioContext=root.AudioContext || root.webkitAudioContext,storage}={}){
    if(!storage){try{storage=root.localStorage;}catch{}}
    let enabled=true,context,ticket=0,nodes=[],effects=[],cleanup;
    try{enabled=storage?.getItem(KEY)!=='off';}catch{}
    function releaseEffects(){clearTimeout(cleanup);for(const node of effects){try{node.disconnect();}catch{}}effects=[];}
    function stop(){ticket++;releaseEffects();for(const node of nodes){try{node.stop();}catch{}}nodes=[];}
    function setEnabled(value){enabled=Boolean(value);if(!enabled)stop();try{storage?.setItem(KEY,enabled?'on':'off');}catch{}return enabled;}
    async function play(correct){
      if(!enabled || typeof AudioContext!=='function')return false;
      stop();const current=ticket;
      try{
        if(!context || context.state==='closed')context=new AudioContext();
        // Called directly by the answer click/submit so Safari can unlock audio.
        if(context.state!=='running')await context.resume();
        if(!enabled || current!==ticket || context.state!=='running')return false;
        // A brighter, 3.5x stronger chime with a short echo. Total audible span:
        // correct ~0.94s, incorrect ~0.80s; no feedback loop or external audio.
        const tones=correct?[[659.25,0,.38],[783.99,.14,.42],[1046.50,.28,.50]]:[[440,0,.34],[349.23,.16,.48]];
        const delay=context.createDelay(.2),echo=context.createGain();
        delay.delayTime.setValueAtTime(.14,context.currentTime);echo.gain.setValueAtTime(.24,context.currentTime);
        delay.connect(echo);echo.connect(context.destination);effects=[delay,echo];
        for(const [frequency,offset,duration] of tones){
          const start=context.currentTime+offset,osc=context.createOscillator(),gain=context.createGain();
          osc.type='triangle';osc.frequency.setValueAtTime(frequency,start);
          gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.28,start+.012);gain.gain.setValueAtTime(.28,start+.07);gain.gain.exponentialRampToValueAtTime(.001,start+duration);gain.gain.setValueAtTime(0,start+duration+.01);
          osc.connect(gain);gain.connect(context.destination);gain.connect(delay);nodes.push(osc);
          osc.onended=()=>{osc.disconnect();gain.disconnect();nodes=nodes.filter(node=>node!==osc);if(current===ticket && !nodes.length)cleanup=setTimeout(releaseEffects,180);};
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
