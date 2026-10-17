/* One allowlist shared by the browser, translation API and recording service. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.HelenLanguages=api;
})(typeof globalThis==='undefined'?this:globalThis,function(){
  'use strict';
  const names=Object.freeze({en:'English',vi:'Tiếng Việt',ko:'한국어',ja:'日本語','zh-CN':'简体中文',es:'Español',fr:'Français'});
  const english=Object.freeze({en:'English',vi:'Vietnamese',ko:'Korean',ja:'Japanese','zh-CN':'Simplified Chinese',es:'Spanish',fr:'French'});
  const speech=Object.freeze({en:'en-US',vi:'vi-VN',ko:'ko-KR',ja:'ja-JP','zh-CN':'zh-CN',es:'es-ES',fr:'fr-FR'});
  function normalize(value){
    if(typeof value!=='string' || value.length>40)return null;
    const code=value.trim().replace(/_/g,'-').toLowerCase();
    if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code))return null;
    const base=code.split('-')[0],key=base==='zh'?'zh-CN':base;
    return Object.hasOwn(names,key)?key:null;
  }
  function deviceLocale(navigator={}){
    const preferences=[...(Array.isArray(navigator.languages)?navigator.languages:[]),navigator.language];
    return preferences.map(normalize).find(Boolean) || 'en';
  }
  function preferences(storage,navigator={}){
    const locale=deviceLocale(navigator),get=key=>{try{return storage?.getItem(key);}catch{return null;}};
    return {locale,from:normalize(get('helen-from')) || 'en',to:normalize(get('helen-target')) || locale};
  }
  return Object.freeze({names,english,speech,normalize,deviceLocale,preferences});
});
