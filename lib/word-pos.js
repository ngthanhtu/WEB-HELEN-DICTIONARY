const fs = require('node:fs'),path = require('node:path');
let index;
function supportsPos(word,pos) {
  if(!index) {
    index = new Map();
    for(const [file,part] of [['noun','noun'],['verb','verb'],['adj','adjective'],['adv','adverb']]) {
      for(const line of fs.readFileSync(path.join(require('wordnet-db').path,`index.${file}`),'utf8').split('\n')) {
        if(!line || /^\s/.test(line))continue;
        const key = line.split(' ',1)[0].replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,'').toLowerCase();
        if(!index.has(key))index.set(key,new Set());index.get(key).add(part);
      }
    }
  }
  // Unlisted compounds/new vocabulary remain attributed to their original dictionary.
  const parts = index.get(String(word).toLowerCase());return !parts || parts.has(pos);
}
module.exports = {supportsPos};
