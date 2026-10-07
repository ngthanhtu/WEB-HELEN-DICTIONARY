// Read installed WordNet buffers directly: avoid the legacy reader's many tiny async disk reads.
// Load before listening so a cold Render instance cannot delay the first learning request.
const fs=require('node:fs'),path=require('node:path'),directory=require('wordnet-db').path;
const files=['noun','verb','adj','adv'].map(pos=>{
  const index=fs.readFileSync(path.join(directory,`index.${pos}`)),data=fs.readFileSync(path.join(directory,`data.${pos}`));
  let start=0;while(index[start]===32 || index[start]===10)start=index.indexOf(10,start)+1;
  return {pos,index,data,start};
});
const lemma=value=>value.replace(/_/g,' ').replace(/\((?:a|p|ip)\)$/,'').toLowerCase();
function find(file,word){
  let low=file.start,high=file.index.length;
  while(low<high){
    const midpoint=(low+high)>>1,previous=file.index.lastIndexOf(10,midpoint-1),start=Math.max(file.start,previous+1),end=file.index.indexOf(10,start);
    const line=file.index.toString('utf8',start,end<0?file.index.length:end),first=line.split(' ',1)[0];
    if(first===word)return line;
    if(first<word)low=(end<0?file.index.length:end+1);else high=start;
  }
  return null;
}
function studyMeanings(input){
  const word=String(input).trim().toLowerCase().replace(/\s+/g,' '),key=word.replace(/ /g,'_'),meanings=[];
  for(const file of files){
    const line=find(file,key);if(!line)continue;
    const fields=line.trim().split(/\s+/),count=Number(fields[2]),pointerCount=Number(fields[3]),offsets=fields.slice(6+pointerCount,6+pointerCount+count),senses=[];
    for(const value of offsets){
      const offset=Number(value),end=file.data.indexOf(10,offset),record=file.data.toString('utf8',offset,end<0?file.data.length:end);
      if(!record.startsWith(`${value} `))continue;
      const split=record.indexOf(' | ');if(split<0)continue;
      const tokens=record.slice(0,split).trim().split(/\s+/),length=parseInt(tokens[3],16),words=tokens.slice(4,4+length*2).filter((_,i)=>i%2===0).map(lemma);
      const gloss=record.slice(split+3).trim(),examples=[...gloss.matchAll(/"([^"]+)"/g)].map(match=>match[1]);
      const definition=gloss.split('; "')[0].trim();if(!definition)continue;
      senses.push({definition,example:examples[0] || '',examples,synonyms:[...new Set(words.filter(other=>other!==word))],relationSource:'Princeton WordNet'});
    }
    if(senses.length)meanings.push({pos:{noun:'noun',verb:'verb',adj:'adjective',adv:'adverb'}[file.pos],senses});
  }
  return meanings;
}
module.exports={studyMeanings};
