/* Only marked interface copy is localized. Learner text, dictionary examples,
   saved translations and speech transcripts are never rewritten by this module. */
(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory(require('./languages'),require('./ui-messages'));
  else {
    const api=factory(root.HelenLanguages,root.HelenUIMessages,root.navigator);root.HelenI18n=api;
    root.document.documentElement.lang=api.locale;
    const start=()=>{
      api.apply(root.document);
      let queued=false;const pending=new Set();
      const observer=new MutationObserver(records=>{
        for(const record of records){
          const parent=record.target.nodeType===3?record.target.parentElement:record.target;
          if(parent?.closest?.('[data-i18n],[data-i18n-control]'))pending.add(parent.closest('[data-i18n],[data-i18n-control]'));
          for(const node of record.addedNodes || [])if(node.nodeType===1)pending.add(node);
        }
        if(queued || !pending.size)return;queued=true;
        queueMicrotask(()=>{queued=false;for(const node of pending)if(node.isConnected)api.apply(node);pending.clear();});
      });
      observer.observe(root.document.body,{childList:true,subtree:true,characterData:true});
    };
    root.document.addEventListener('DOMContentLoaded',start,{once:true});
    root.addEventListener('languagechange',()=>{
      api.setLocale(root.HelenLanguages.deviceLocale(root.navigator));root.document.documentElement.lang=api.locale;
      api.apply(root.document);root.document.dispatchEvent(new CustomEvent('helen:locale-change'));
    });
  }
})(typeof globalThis==='undefined'?this:globalThis,function(languages,messages,navigator){
  'use strict';
  let locale=languages.deviceLocale(navigator || {});
  const lookup=new Map(),sources=new WeakMap();
  for(const row of messages.rows){lookup.set(row[0],row);lookup.set(row[1],row);}
  function t(value,params={},chosen=locale){
    if(typeof value!=='string')return value;
    const source=value.trim();
    let match;if((match=source.match(/^Từ và cụm học thuật: (.+)$/)))return t('Academic words and phrases: {examples}',{examples:match[1]},chosen);
    if((match=source.match(/^(\d+(?:\/\d+)?) lượt luyện$/)))return t('{count} practice turns',{count:match[1]},chosen);
    if((match=source.match(/^(\d+) ngày liên tiếp$/)))return t('{count} consecutive days',{count:match[1]},chosen);
    if((match=source.match(/^(\d+) lượt$/)))return t('{count} turns',{count:match[1]},chosen);
    const row=lookup.get(source),index=messages.locales.indexOf(languages.normalize(chosen) || 'en');
    let translated=row?.[index] || value;
    for(const [name,text] of Object.entries(params))translated=translated.replaceAll(`{${name}}`,String(text));
    return translated;
  }
  function apply(scope){
    const elements=[...(scope.matches?.('[data-i18n],[data-i18n-control],[data-i18n-attributes]')?[scope]:[]),...scope.querySelectorAll('[data-i18n],[data-i18n-control],[data-i18n-attributes]')];
    for(const element of elements){
      let saved=sources.get(element);if(!saved){saved={};sources.set(element,saved);}
      if(element.hasAttribute('data-i18n') || element.hasAttribute('data-i18n-control')){
        // A status/button can be updated by its owner between renders. Adopt a
        // new known UI message, but never restore stale copy over a new value.
        if(!element.children.length){
          const current=element.textContent;if(saved.last!==current){saved.source=lookup.has(current.trim()) || /^(\d+(?:\/\d+)?) (?:lượt luyện|ngày liên tiếp|lượt)$/.test(current.trim())?current:null;}
          if(saved.source){const next=t(saved.source);if(next!==current)element.textContent=next;saved.last=next;}
        }
      }
      for(const attribute of (element.getAttribute('data-i18n-attributes') || '').split(' ').filter(Boolean)){
        const value=element.getAttribute(attribute);if(!value)continue;
        saved[attribute] ||= value;const next=t(saved[attribute]);if(next!==value)element.setAttribute(attribute,next);
      }
    }
  }
  function markUI(scope){
    // Call only when constructing an interface fragment, before adding user
    // words. This keeps dictionary entries and recordings out of localization.
    const document=scope.ownerDocument,walker=document.createTreeWalker(scope,4),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const value=node.textContent,source=value.trim();
      if(!lookup.has(source) || node.parentElement.closest('[data-i18n],script,style,textarea'))continue;
      const marker=document.createElement('span');marker.setAttribute('data-i18n','');marker.textContent=source;
      const before=value.slice(0,value.indexOf(source)),after=value.slice(value.indexOf(source)+source.length);
      node.replaceWith(document.createTextNode(before),marker,document.createTextNode(after));
    }
    scope.querySelectorAll('button,[role="status"]').forEach(element=>element.setAttribute('data-i18n-control',''));
    apply(scope);return scope;
  }
  return {get locale(){return locale;},setLocale(value){locale=languages.normalize(value) || 'en';},t,apply,markUI};
});
