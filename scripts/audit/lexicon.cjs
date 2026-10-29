// Exhaustive structural audit of the installed WordNet dataset; no external API calls.
const fs = require('node:fs'), path = require('node:path');
const directory = require('wordnet-db').path;
const records = new Map(), lemmas = new Set(), errors = [];
const counts = {synsets:0,headwords:0,synonymPairs:0,antonymPointers:0,sourceTargetChecks:0};
for (const file of ['noun','verb','adj','adv']) {
  for (const line of fs.readFileSync(path.join(directory,`data.${file}`),'utf8').split('\n')) {
    if (!/^\d{8} /.test(line)) continue;
    const fields = line.split(' | ')[0].trim().split(/\s+/), offset = Number(fields[0]), pos = fields[2] === 's' ? 'a' : fields[2];
    const size = parseInt(fields[3],16), words = fields.slice(4,4 + size * 2).filter((_,i) => i % 2 === 0);
    words.forEach(word => lemmas.add(word.replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,'')));
    const start = 4 + size * 2, length = Number(fields[start]), pointers = [];
    for (let i = 0; i < length; i++) {
      const index = start + 1 + i * 4;
      if (fields[index] === '!') pointers.push({offset:Number(fields[index + 1]),pos:fields[index + 2],packed:parseInt(fields[index + 3],16)});
    }
    records.set(`${pos}:${offset}`,{words,pointers});counts.synsets++;counts.synonymPairs += size * (size - 1);
  }
}
for (const [key,record] of records) for (const pointer of record.pointers) {
  counts.antonymPointers++;
  const target = records.get(`${pointer.pos === 's' ? 'a' : pointer.pos}:${pointer.offset}`);
  const sourceIndex = pointer.packed >> 8, targetIndex = pointer.packed & 255;
  if (!target || sourceIndex > record.words.length || targetIndex > (target?.words.length || 0)) errors.push({key,pointer});
  else counts.sourceTargetChecks++;
}
counts.headwords = lemmas.size;
const result = {dataset:'Princeton WordNet 3.1',...counts,errors,scope:'Checks every local synset and antonym pointer. Structural integrity, not a guarantee that every word has an antonym or that external dictionaries are exhaustive.'};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exitCode = 1;
