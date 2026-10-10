// Published, curated senses also qualify for pronunciation, without a remote lookup.
const fs=require('node:fs'),path=require('node:path'),manifest=require('../public/assets/topics/manifest.json');
const entries=new Map();for(const topic of manifest.topics){const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../public',topic.url),'utf8'));for(const entry of pack.entries)entries.set(entry.word,{word:entry.word,source:entry.source,meanings:[{pos:entry.pos,senses:[{definition:entry.definition,examples:entry.examples,relationSource:entry.source}]}]});}
module.exports={topicEntry:word=>entries.get(word)};
