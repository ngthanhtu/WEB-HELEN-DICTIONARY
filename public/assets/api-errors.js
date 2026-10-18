/* Safe, local error messages. A provider quota is not a personal daily limit. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.HelenApiErrors=api;
})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const messages=Object.freeze({
    REQUEST_RATE_LIMIT:'Too many requests at once. Wait a minute and try again.',
    USAGE_UNAVAILABLE:'The request limit service is temporarily unavailable. Your content is kept; try again shortly.',
    PRACTICAL_QUOTA:'The AI provider is limiting requests. Your conversation is kept; try again later.',
    PRACTICAL_MODEL:'The AI model is unavailable. Your conversation is kept; the administrator needs to check the model configuration.',
    PRACTICAL_AUTH:'AI access is not authorized. Your conversation is kept; the administrator needs to check the API key permissions.',
    PRACTICAL_CONFIG:'The AI configuration needs attention. Your conversation is kept; the administrator needs to check the service.',
    PRACTICAL_BUSY:'AI is temporarily busy. Your conversation is kept; try again in a few minutes.',
    PRACTICAL_TIMEOUT:'AI took too long. Your conversation is kept; try again.',
    PRACTICAL_SERVICE:'Cannot reach AI right now. Your conversation is kept; try again shortly.',
    PRACTICAL_OUTPUT:'AI returned incomplete or inconsistent feedback. Your conversation is kept; try again.',
    PRACTICAL_OUTPUT_LIMIT:'AI returned incomplete or inconsistent feedback. Your conversation is kept; try again.'
  });
  function fromResponse(data={},response={}){
    if(!data || typeof data!=='object' || Array.isArray(data))data={};
    return Object.assign(Error(typeof data.error==='string'?data.error:''),{
      status:response.status,code:typeof data.code==='string'?data.code:undefined,
      scope:data.scope,resetAt:data.resetAt,retryAfter:data.retryAfter
    });
  }
  function message(error={}, {fallback='Please try again.',offline=false,locale='en',now=Date.now(),translate=text=>text}={}){
    if(offline)return translate('You are offline. Saved content is still available.');
    let source=messages[error.code];
    if(error.code==='USAGE_LIMIT')source=error.scope==='shared'?'The website has reached its shared AI limit today, not your personal allowance. Your conversation is kept.':error.scope==='network'?'This network has reached its AI limit today. Your conversation is kept.':error.scope==='device'?'This device has reached its daily AI limit. Your conversation is kept.':error.scope==='unknown'?'An AI usage limit has been reached. Your content is kept.':error.message;
    if(!source && error.status===429)source=messages.REQUEST_RATE_LIMIT;
    const raw=typeof error.message==='string'?error.message:'';
    if(!source)source=raw && !/^(?:Failed to fetch|fetch failed|Load failed|NetworkError|Translation service is unavailable|Unexpected token|Unexpected end|SyntaxError|TypeError)/i.test(raw)?raw:fallback;
    let result=translate(source);
    const reset=typeof error.resetAt==='string'?Date.parse(error.resetAt):NaN;
    if(error.code==='USAGE_LIMIT' && Number.isFinite(reset) && reset>now && reset-now<=32*86400000){
      let time;try{time=new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(reset);}catch{time=new Date(reset).toISOString();}
      result+=' '+translate('Try again after {time}.',{time});
    }
    return result;
  }
  return Object.freeze({message,fromResponse});
});
