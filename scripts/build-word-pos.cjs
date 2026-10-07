const fs = require('node:fs'),path = require('node:path');
const directory = require('wordnet-db').path, entries = Object.create(null);
for(const [file,mask] of [['noun',1],['verb',2],['adj',4],['adv',8]]) {
  for(const line of fs.readFileSync(path.join(directory,`index.${file}`),'utf8').split('\n')) {
    if(!line || /^\s/.test(line))continue;
    const key = line.split(' ',1)[0].replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,'').toLowerCase();
    entries[key] = (entries[key] || 0) | mask;
  }
}
const license=fs.readFileSync(path.join(path.dirname(require.resolve('wordnet-db/package.json')),'LICENSE'),'utf8');
fs.writeFileSync(path.join(__dirname,'../data/word-pos.json'),JSON.stringify({source:'Princeton WordNet 3.1',copyright:'WordNet 3.1 Copyright 2011 by Princeton University. All rights reserved.',license,entries})+'\n');
console.log(`Built ${Object.keys(entries).length} word POS entries; server can load the index before accepting requests.`);
