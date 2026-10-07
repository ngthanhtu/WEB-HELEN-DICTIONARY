// Generated at build time, parsed before the HTTP server starts: no index-building pause on a lookup.
const index = require('../data/word-pos.json').entries;
const masks = {noun:1,verb:2,adjective:4,adverb:8};
function supportsPos(word,pos) {
  if(!Object.hasOwn(masks,pos))return true; // WordNet does not index pronouns, prepositions or interjections.
  // Unlisted compounds/new vocabulary remain attributed to their original dictionary.
  const key = String(word).toLowerCase();return !Object.hasOwn(index,key) || Boolean(index[key] & masks[pos]);
}
module.exports = {supportsPos};
