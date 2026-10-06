const fs = require('node:fs/promises');
const path = require('node:path');
let vocabulary;
// WordNet index frequency is a tie-breaker, never evidence of an exact spelling match.
async function words() {
  return vocabulary ||= Promise.all(['noun','verb','adj','adv'].map(async pos => {
    const text = await fs.readFile(path.join(require('wordnet-db').path, `index.${pos}`), 'utf8');
    return text.split('\n').filter(line => /^[a-z]/.test(line)).map(line => {
      const parts = line.split(/\s+/);
      return {word:parts[0].replace(/_/g,' '),frequency:Number(parts[5 + Number(parts[3])]) || 0};
    }).filter(entry => /^[a-z]+(?: [a-z]+)*$/.test(entry.word));
  })).then(groups => {
    const unique = new Map();
    for (const entry of groups.flat()) unique.set(entry.word, Math.max(unique.get(entry.word) || 0, entry.frequency));
    return [...unique].map(([word,frequency]) => ({word,frequency}));
  });
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
  const limit=query.length<5?1:2;
  const candidates=[];
  for(const entry of await words()) {
    if(entry.word===query || Math.abs(entry.word.length-query.length)>limit) continue;
    const edits=distance(query,entry.word);
    if(edits<=limit) candidates.push({...entry,edits});
  }
  return candidates.sort((a,b)=>a.edits-b.edits || b.frequency-a.frequency || a.word.localeCompare(b.word)).slice(0,8).map(entry=>entry.word);
}
module.exports={spellingSuggestions};
