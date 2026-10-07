const fs = require('node:fs'),path = require('node:path');
let index;
const masks = {noun:1,verb:2,adjective:4,adverb:8};
function supportsPos(word,pos) {
  if(!masks[pos])return true; // WordNet does not index pronouns, prepositions or interjections.
  if(!index) {
    index = new Map();
    for(const [file,part] of [['noun','noun'],['verb','verb'],['adj','adjective'],['adv','adverb']]) {
      for(const line of fs.readFileSync(path.join(require('wordnet-db').path,`index.${file}`),'utf8').split('\n')) {
        if(!line || /^\s/.test(line))continue;
        const key = line.split(' ',1)[0].replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,'').toLowerCase();
        index.set(key,(index.get(key) || 0) | masks[part]);
      }
    }
  }
  // Unlisted compounds/new vocabulary remain attributed to their original dictionary.
  const parts = index.get(String(word).toLowerCase());return !parts || Boolean(parts & masks[pos]);
}
module.exports = {supportsPos};
