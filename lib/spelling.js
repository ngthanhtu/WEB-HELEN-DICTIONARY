const fs = require('node:fs/promises');
const path = require('node:path');
let vocabulary;
let knownWords;
// WordNet index frequency is a tie-breaker, never evidence of an exact spelling match.
async function words() {
  return vocabulary ||= Promise.all(['noun','verb','adj','adv'].map(async pos => {
    const text = await fs.readFile(path.join(require('wordnet-db').path, `index.${pos}`), 'utf8');
    return text.split('\n').filter(line => /^[a-z]/.test(line)).map(line => {
      const parts = line.split(/\s+/);
      return {word:parts[0].replace(/_/g,' '),frequency:Number(parts[5 + Number(parts[3])]) || 0};
    }).filter(entry => /^[a-z]+(?:[ -][a-z]+)*$/.test(entry.word));
  })).then(groups => {
    const unique = new Map();
    for (const entry of groups.flat()) unique.set(entry.word, Math.max(unique.get(entry.word) || 0, entry.frequency));
    for (const word of Object.keys(require('./vietnamese').glosses)) if (!unique.has(word)) unique.set(word,0);
    knownWords = new Set(unique.keys());
    return [...unique].map(([word,frequency]) => ({word,frequency}));
  });
}
let completionIndex;
async function autocompleteSuggestions(input) {
  const query=String(input).trim().toLowerCase().replace(/\s+/g,' ');
  if(!/^[a-z]+(?:[ -][a-z]+)*$/.test(query) || query.length<2 || query.length>48)return [];
  completionIndex ||= words().then(items=>items.slice().sort((a,b)=>a.word.localeCompare(b.word,'en')));
  const items=await completionIndex;
  let lo=0,hi=items.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].word.localeCompare(query,'en')<0)lo=mid+1;else hi=mid;}
  const matches=[];
  for(let i=lo;i<items.length && items[i].word.startsWith(query);i++)matches.push(items[i]);
  const compound=entry=>entry.word[query.length]===' ' || entry.word[query.length]==='-';
  const suggestions=matches.sort((a,b)=>Number(b.word===query)-Number(a.word===query) || Number(compound(b))-Number(compound(a)) || b.frequency-a.frequency || a.word.length-b.word.length || a.word.localeCompare(b.word)).slice(0,8).map(item=>item.word);
  return suggestions.length?suggestions:spellingSuggestions(query);
}
// Includes adjacent transpositions, e.g. expreiment -> experiment.
function distance(a,b) {
  const rows = Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=0;i<=a.length;i++) rows[i][0]=i;
  for(let j=0;j<=b.length;j++) rows[0][j]=j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  return rows[a.length][b.length];
}
async function spellingSuggestions(input) {
  const query=String(input).trim().toLowerCase();
  if(!/^[a-z]+(?: [a-z]+)*$/.test(query) || query.length<3 || query.length>48) return [];
  const vocabulary=await words();
  if(knownWords.has(query)) return [];
  const limit=query.length<5?1:2;
  const candidates=[];
  for(const entry of vocabulary) {
    if(entry.word===query || Math.abs(entry.word.length-query.length)>limit) continue;
    const edits=distance(query,entry.word);
    if(edits<=limit) candidates.push({...entry,edits});
  }
  return candidates.sort((a,b)=>a.edits-b.edits || b.frequency-a.frequency || a.word.localeCompare(b.word)).slice(0,8).map(entry=>entry.word);
}
module.exports={spellingSuggestions,autocompleteSuggestions,warmSpellingIndex:()=>autocompleteSuggestions('ex').then(()=>{})};
