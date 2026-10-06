// Loaded only by the API test child process; no external requests or paid TTS calls.
let quotaCalls = 0;
global.fetch = async (input, opts = {}) => {
  const url = new URL(input);
  if (url.hostname === 'api.mymemory.translated.net') {
    const text = url.searchParams.get('q'), to = url.searchParams.get('langpair').split('|')[1];
    if (text === 'empty-with-match') return Response.json({responseStatus:200,responseData:{translatedText:''},matches:[{translation:'',match:1},{translation:`${to}:valid`,match:1}]});
    if (text === 'empty') return Response.json({responseStatus:200,responseData:{translatedText:''}});
    const failed = text === 'quota' && ++quotaCalls <= 2;
    return Response.json({responseStatus:failed ? 429 : 200, responseData:{translatedText:failed ? 'QUOTA ERROR' : `${to}:${text}`}});
  }
  if (url.hostname === 'api.datamuse.com') {
    const word=url.searchParams.get('rel_syn') || url.searchParams.get('rel_ant');
    if(word === 'offline') return new Response('',{status:503});
    return Response.json([{word:url.searchParams.has('rel_syn') ? 'cheerful' : 'unhappy',tags:['adj']},{word:'unrelated-noun',tags:['n']}]);
  }
  if (url.hostname === 'api.dictionaryapi.dev') {
    const word = url.pathname.split('/').pop();
    if (word === 'slow') await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,3800);opts.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
    if (word === 'offline') return new Response('', {status:503});
    return Response.json([{meanings:[{partOfSpeech:'adjective',synonyms:['joyful'],antonyms:['sad'],definitions:[{definition:'Feeling pleasure.',example:'She was happy to see her friend.',synonyms:['glad'],antonyms:[]}]}]}]);
  }
  if (url.hostname === 'en.wiktionary.org') {
    if (url.pathname.endsWith('/slow')) return new Response('',{status:503});
    if (url.pathname.endsWith('/malformed')) return new Response('invalid JSON');
    if (url.pathname.includes('/page/definition/')) return Response.json({en:[{partOfSpeech:'adjective',definitions:[{definition:'Feeling pleasure.'}]}]});
    return Response.json({parse:{wikitext:{'*':''}}});
  }
  if (url.hostname === 'api.elevenlabs.io') {
    const voice = url.pathname.split('/').pop();
    const text = JSON.parse(opts.body || '{}').text;
    return new Response(text?.length > 200 ? text : voice, {status:voice === 'unavailable' ? 403 : 200});
  }
  throw new Error(`Unexpected upstream: ${url.hostname}`);
};
