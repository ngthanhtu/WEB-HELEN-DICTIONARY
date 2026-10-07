const supplements = require('../data/thesaurus-supplements.json');
const REVISION = 2;
const normalize = text => String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
function words(values, headword = '') {
  const seen = new Set([normalize(headword)]);
  return (values || []).filter(value => typeof value === 'string').map(value => value.replace(/_/g, ' ').trim()).filter(value => {
    const key = normalize(value);
    if (!key || value.length > 100 || /[<>\n{}:]/.test(value) || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
// Parse balanced templates; splitting on a regular expression loses nested qualifiers.
function templates(text) {
  const result = []; let depth = 0, start = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (text.slice(i, i + 2) === '{{') { if (!depth) start = i; depth++; i++; }
    else if (text.slice(i, i + 2) === '}}' && depth) { if (!--depth) result.push({start,end:i + 2,text:text.slice(start + 2,i)}); i++; }
  }
  return result;
}
function parts(text) {
  const result = []; let start = 0, depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.slice(i,i + 2) === '{{' || text.slice(i,i + 2) === '[[') {depth++; i++;}
    else if (text.slice(i,i + 2) === '}}' || text.slice(i,i + 2) === ']]') {depth--; i++;}
    else if (text[i] === '|' && !depth) {result.push(text.slice(start,i));start = i + 1;}
  }
  return [...result,text.slice(start)];
}
function plain(text) {
  for (const item of templates(text).reverse()) {
    const [name,...args] = parts(item.text), positional = args.filter(a => !a.includes('='));
    let value = '';
    if (['l','link','m','mention'].includes(name)) value = positional[2] || positional[1] || '';
    else if (['gloss','non-gloss definition','ngd','def'].includes(name)) value = positional[0] || '';
    else if (['lb','label','context'].includes(name)) value = `(${positional.slice(1).join(', ')})`;
    else if (['w','wikipedia'].includes(name)) value = positional[1] || positional[0] || '';
    text = text.slice(0,item.start) + value + text.slice(item.end);
  }
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,target,label) => label || target)
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/gi,'').replace(/<[^>]*>/g,'')
    .replace(/'{2,5}/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
}
function wiktionaryRelations(wikitext, headword, revision) {
  const groups = []; let english = false, pos = '', current = null, section = '', thesaurusSense = '';
  const sourceUrl = `https://en.wiktionary.org/w/index.php?title=${encodeURIComponent(headword)}${revision ? `&oldid=${revision}` : ''}`;
  function addGroup(definition, scope = 'sense') {
    const group = {pos,definition,scope,synonyms:[],antonyms:[],references:[],source:'Wiktionary',sourceUrl,license:'CC BY-SA 4.0'};
    groups.push(group);return group;
  }
  for (const line of String(wikitext || '').split('\n')) {
    const heading = line.match(/^(={2,6})\s*([^=]+?)\s*\1\s*$/);
    if (heading) {
      const title = heading[2].trim().toLowerCase();
      if (heading[1].length === 2) {english = title === 'english';pos = '';current = null;section = '';}
      if (!english) continue;
      if (['noun','verb','adjective','adverb','pronoun','preposition','conjunction','interjection'].includes(title)) {pos = title;current = null;section = '';}
      else if (['synonyms','antonyms'].includes(title)) {section = title;current = null;}
      else {section = '';current = null;}
      const sense = templates(heading[2]).find(item => parts(item.text)[0] === 'ws sense');
      if(sense)thesaurusSense = plain(parts(sense.text).slice(2).join(', '));
      else if(heading[1].length <= 3)thesaurusSense = '';
      continue;
    }
    if (!english || !pos) continue;
    if (/^#(?![:*#])\s+/.test(line)) current = addGroup(plain(line.replace(/^#\s*/,'')));
    for (const item of templates(line)) {
      const [name,language,...args] = parts(item.text);
      if (language !== 'en') continue;
      const type = ['syn','synonyms','synonym'].includes(name) ? 'synonyms' : ['ant','antonyms','antonym'].includes(name) ? 'antonyms' : null;
      if(name === 'ws' && section) {
        const group = current || (current = addGroup(thesaurusSense,thesaurusSense ? 'sense' : 'partOfSpeech'));
        if(args[0])group[section].push(plain(args[0]));
      }
      if (!type) continue;
      const group = current || (current = addGroup('', 'partOfSpeech'));
      for(const arg of args.filter(a => !a.includes('='))) {
        const word = plain(arg);
        if(/^Thesaurus:/i.test(word))group.references.push(word);
        else group[type].push(word);
      }
    }
    if (section && /^\*/.test(line)) {
      const sense = templates(line).find(item => parts(item.text)[0] === 'sense');
      if (sense) current = addGroup(plain(parts(sense.text).slice(1).join(', ')),'partOfSpeech');
      const group = current || (current = addGroup('', 'partOfSpeech'));
      for (const match of line.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
        if (!match[1].includes(':')) group[section].push(plain(match[2] || match[1]));
      }
      for (const item of templates(line)) {
        const [name,language,word] = parts(item.text);
        if (['l','m','link'].includes(name) && language === 'en' && word) group[section].push(plain(word));
      }
    }
  }
  return groups.map(group => ({...group,synonyms:words(group.synonyms,headword),antonyms:words(group.antonyms,headword)}))
    .filter(group => group.synonyms.length || group.antonyms.length || group.references.length);
}
function supplementaryRelations(word) {
  return (supplements[normalize(word)] || []).map(group => ({...group,source:'Helen Dictionary — biên soạn',scope:'sense',
    synonyms:words(group.synonyms,word),antonyms:words(group.antonyms,word)}));
}
function mergeRelations(word, meanings, extra = [], links = {}, wiki = {groups:[],available:false}) {
  const curated = supplementaryRelations(word);
  return meanings.map(m => {
    const matches = (extra || []).filter(r => r.pos === m.pos);
    const tag = {noun:'n',verb:'v',adjective:'adj',adverb:'adv'}[m.pos];
    const forPos = list => words((list || []).filter(x => tag && x.tags?.includes(tag)).map(x => x.word),word);
    const thesaurus = [...curated,...(wiki.groups || [])].filter(group => group.pos === m.pos);
    const senses = m.senses.map(s => {
      const exact = [...matches.flatMap(r => r.senses),...thesaurus].filter(other => other.definition && normalize(other.definition) === normalize(s.definition));
      // Editorial rules are explicitly scoped to a meaning, never applied to every sense.
      const editorial = curated.filter(group => group.pos === m.pos && group.definitionMatch?.some(text => normalize(s.definition).includes(normalize(text))));
      const additions = [...exact,...editorial];
      return {...s,synonyms:words([...(s.synonyms || []),...additions.flatMap(g => g.synonyms || [])],word),
        antonyms:words([...(s.antonyms || []),...additions.flatMap(g => g.antonyms || [])],word),
        relationSources:words([s.relationSource,...additions.map(g => g.source || g.relationSource)]),
        ...(editorial.length ? {relationNote:editorial.map(g => g.note).filter(Boolean).join(' ')} : {})};
    });
    // Different source definitions stay in their own sense groups. No fuzzy sense matching.
    const additional = matches.flatMap(r => r.senses || []).filter(s => s.synonyms?.length || s.antonyms?.length)
      .filter(s => !senses.some(own => normalize(own.definition) === normalize(s.definition)))
      .map(s => ({...s,pos:m.pos,scope:'sense',source:s.relationSource}));
    return {...m,relationsPending:false,senses,thesaurus:[...thesaurus,...additional],
      synonyms:words([...(m.synonyms || []),...matches.flatMap(r => r.synonyms || [])],word),
      antonyms:words([...(m.antonyms || []),...matches.flatMap(r => r.antonyms || [])],word),
      relatedSynonyms:forPos(links.synonyms),relatedAntonyms:forPos(links.antonyms),
      relationsUnavailable:extra === null && !wiki.available && (links.synonyms === null || links.antonyms === null),
      usageExamples:words(matches.flatMap(r => r.usageExamples || [])).filter(e => !senses.some(s => s.example === e)).slice(0,4)};
  });
}
module.exports = {REVISION,words,wiktionaryRelations,supplementaryRelations,mergeRelations};
