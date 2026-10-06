// Loaded only by the API test child process; no external requests or paid TTS calls.
let quotaCalls = 0, aiCalls=0, translationFailureCalls=0;
global.fetch = async (input, opts = {}) => {
  const url = new URL(input);
  if (url.hostname === 'api.mymemory.translated.net') {
    const text = url.searchParams.get('q'), to = url.searchParams.get('langpair').split('|')[1];
    if(text==='ambiguous-word') return Response.json({responseStatus:200,responseData:{translatedText:text},matches:[{translation:text,match:1},{translation:'từ vay mượn',match:0.99}]});
    if(text==='identity-only' || text==='internet') return Response.json({responseStatus:200,responseData:{translatedText:text},matches:[]});
    if (text === 'empty-with-match') return Response.json({responseStatus:200,responseData:{translatedText:''},matches:[{translation:'',match:1},{translation:`${to}:valid`,match:1}]});
    if (text === 'empty') return Response.json({responseStatus:200,responseData:{translatedText:''}});
    const failed = text === 'quota' && ++quotaCalls <= 1;
    if(text.includes('fallback-definition') || text==='quota-every-provider') return Response.json({responseStatus:503,responseData:{translatedText:''}});
    return Response.json({responseStatus:failed ? 503 : 200, responseData:{translatedText:failed ? 'QUOTA ERROR' : `${to}:${text}`}});
  }
  if (url.hostname === 'api.datamuse.com') {
    if (url.searchParams.has('rel_bga') || url.searchParams.has('rel_bgb')) return Response.json([{word:'the',score:1000},{word:'laboratory',score:100},{word:'.',score:80}]);
    if (url.searchParams.has('sp')) return Response.json(url.searchParams.get('sp') === 'backup' ? [{word:'backup',defs:['n\tAn independent definition.']}] : []);
    const word=url.searchParams.get('rel_syn') || url.searchParams.get('rel_ant');
    if(word === 'fast-result') await new Promise(resolve=>setTimeout(resolve,1500));
    if(word === 'offline') return new Response('',{status:503});
    return Response.json([{word:url.searchParams.has('rel_syn') ? 'cheerful' : 'unhappy',tags:['adj']},{word:'unrelated-noun',tags:['n']}]);
  }
  if (url.hostname === 'api.dictionaryapi.dev') {
    const word = url.pathname.split('/').pop();
    if(word === 'experimence') return new Response('',{status:404});
    if (word === 'slow') await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,3800);opts.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
    if (word === 'offline' || word === 'backup') return new Response('', {status:503});
    return Response.json([{meanings:[{partOfSpeech:'adjective',synonyms:['joyful'],antonyms:['sad'],definitions:[{definition:'Feeling pleasure.',example:'She was happy to see her friend.',synonyms:['glad'],antonyms:[]}]}]}]);
  }
  if (url.hostname === 'en.wiktionary.org') {
    if (url.pathname.endsWith('/experimence')) return new Response('',{status:404});
    if (url.pathname.endsWith('/backup')) return new Response('',{status:503});
    if (url.pathname.endsWith('/slow')) return new Response('',{status:503});
    if (url.pathname.endsWith('/malformed')) return new Response('invalid JSON');
    if (url.pathname.includes('/page/definition/')) return Response.json({en:[{partOfSpeech:'adjective',definitions:[{definition:'Feeling pleasure.'}]}]});
    return Response.json({parse:{wikitext:{'*':''}}});
  }
  if(url.hostname==='generativelanguage.googleapis.com') {
    if(!opts.body) return Response.json({models:[{name:'models/gemini-3.1-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3-pro',supportedGenerationMethods:['generateContent']}]});
    const request=JSON.parse(opts.body), recording=request.contents?.[0]?.parts?.find(part=>part.inlineData)?.inlineData;
    if(recording) {
      const marker=Buffer.from(recording.data,'base64').toString('utf8');
      if(marker.includes('SPEECH_QUOTA')) return Response.json({error:{code:429,message:'PRIVATE_PROVIDER_SPEECH_DETAILS',status:'RESOURCE_EXHAUSTED'}},{status:429});
      const transcript=marker.includes('SPEECH_SILENT') ? '' : 'intermediate';
      return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({transcript,language:'en'})}]},finishReason:'STOP'}]});
    }
    const input=JSON.parse(request.contents[0].parts[0].text);
    if(Array.isArray(input.texts)) {
      if(input.texts.some(item=>item.text==='quota' || item.text==='quota-every-provider')) return Response.json({error:{code:429,message:'Test translation quota',status:'RESOURCE_EXHAUSTED'}},{status:429});
      if(input.texts.some(item=>item.text==='fallback-definition-transient') && ++translationFailureCalls===1) return Response.json({error:{code:503,message:'Transient upstream failure',status:'UNAVAILABLE'}},{status:503});
      const to={Vietnamese:'vi',French:'fr',Japanese:'ja',Spanish:'es','Simplified Chinese':'zh-CN'}[input.targetLanguage] || input.targetLanguage;
      return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify({translations:input.texts.map(item=>({id:item.id,text:item.text==='empty' ? '' : item.text==='identity-only' ? item.text : `${to}:${item.text}`}))})}]},finishReason:'STOP'}]});
    }
    if(input.word==='ai-model-retired' && url.pathname.includes('gemini-flash-lite-latest:')) return Response.json({error:{code:404,message:'Retired model',status:'NOT_FOUND'}},{status:404});
    if(input.word==='ai-quota') return Response.json({error:{code:429,message:'Test quota',status:'RESOURCE_EXHAUSTED'}},{status:429});
    const lesson={title:`Lesson ${++aiCalls}`,dialogue:[
      {speaker:'A',text:`I feel ${input.word} today.`,translation:'Hôm nay tôi thấy vui.'},
      {speaker:'B',text:'What happened?',translation:'Có chuyện gì thế?'},
      {speaker:'A',text:'I met an old friend.',translation:'Tôi gặp một người bạn cũ.'},
      {speaker:'B',text:'That sounds lovely.',translation:'Nghe thật vui.'}],
      scenario:{text:`She is ${input.word} to see her friend.`,translation:'Cô ấy vui khi gặp bạn.'},
      usageNote:input.dictionaryDefinition,videoPrompt:'Create a short animation of two friends meeting in a park.'};
    if(input.word==='loan') {
      lesson.title='Mượn sách ở thư viện';
      lesson.dialogue=[
        {speaker:'Linh',text:'Can I get a loan of this book for a week?',translation:'Tôi có thể mượn cuốn sách này một tuần không?'},
        {speaker:'Anna',text:'Yes. Please bring it back next Friday.',translation:'Được. Vui lòng trả sách vào thứ Sáu tuần sau.'},
        {speaker:'Linh',text:'Is there a fee for the loan?',translation:'Có phí mượn sách không?'},
        {speaker:'Anna',text:'No, the loan is free for members.',translation:'Không, thành viên được mượn miễn phí.'}];
      lesson.scenario={text:'At a library, Linh asks for a loan of a book and agrees to return it next Friday.',translation:'Tại thư viện, Linh xin mượn sách và đồng ý trả vào thứ Sáu tuần sau.'};
      lesson.videoPrompt='Create a 20-second animation in a library. Linh borrows a book from Anna. Show a return-date card for next Friday. End with the caption: loan — something borrowed temporarily and then returned.';
    }
    if(input.word==='ai-invalid') lesson.dialogue=[];
    return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(lesson)}]},finishReason:'STOP'}]});
  }
  if (url.hostname === 'api.elevenlabs.io') {
    if(url.pathname.endsWith('/voices')) return Response.json({voices:[
      {name:'American voice',voice_id:'usVoice',labels:{accent:'american'}},
      {name:'British voice',voice_id:'ukVoice',labels:{accent:'british'}},
      {name:'Unknown voice',voice_id:'unknownVoice',labels:{}},
      {name:'Australian voice',voice_id:'auVoice',labels:{accent:'Australian English'}}
    ]});
    const voice = url.pathname.split('/').pop();
    const text = JSON.parse(opts.body || '{}').text;
    return new Response(text?.length > 200 ? text : voice, {status:voice === 'unavailable' ? 403 : 200});
  }
  throw new Error(`Unexpected upstream: ${url.hostname}`);
};
