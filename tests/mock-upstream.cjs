// Loaded only by the API test child process; no external requests or paid TTS calls.
let quotaCalls = 0;
global.fetch = async (input) => {
  const url = new URL(input);
  if (url.hostname === 'api.mymemory.translated.net') {
    const text = url.searchParams.get('q'), to = url.searchParams.get('langpair').split('|')[1];
    if (text === 'empty-with-match') return Response.json({responseStatus:200,responseData:{translatedText:''},matches:[{translation:'',match:1},{translation:`${to}:valid`,match:1}]});
    if (text === 'empty') return Response.json({responseStatus:200,responseData:{translatedText:''}});
    const failed = text === 'quota' && ++quotaCalls <= 2;
    return Response.json({responseStatus:failed ? 429 : 200, responseData:{translatedText:failed ? 'QUOTA ERROR' : `${to}:${text}`}});
  }
  if (url.hostname === 'api.elevenlabs.io') {
    const voice = url.pathname.split('/').pop();
    return new Response(voice, {status:voice === 'unavailable' ? 403 : 200});
  }
  throw new Error(`Unexpected upstream: ${url.hostname}`);
};
