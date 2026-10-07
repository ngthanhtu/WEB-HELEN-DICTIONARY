// Original teaching examples; not copied from Oxford or another dictionary.
const curated = {
  premium:[['noun phrase','insurance premium','The insurance premium is paid every month.'],['verb + noun','pay a premium','Customers may pay a premium for faster delivery.'],['adjective + noun','premium quality','The shop sells premium quality coffee.'],['adjective + noun','premium price','The limited edition sells at a premium price.'],['prepositional phrase','at a premium','Office space is at a premium in the city centre.']],
  experiment: [
    ['verb + noun','conduct an experiment','The students conducted an experiment to test their prediction.'],
    ['verb + noun','carry out an experiment','We carried out an experiment under controlled conditions.'],
    ['adjective + noun','controlled experiment','A controlled experiment compares results under carefully managed conditions.'],
    ['adjective + noun','scientific experiment','The scientific experiment produced unexpected results.'],
    ['verb + preposition','experiment with','Try experimenting with different materials.']
  ],
  experience:[['verb + noun','gain experience','You can gain experience by volunteering.'],['adjective + noun','practical experience','The course combines theory with practical experience.'],['adjective + noun','work experience','She has several years of work experience.']],
  environment:[['adjective + noun','natural environment','We should protect the natural environment.'],['adjective + noun','working environment','A quiet working environment helps me concentrate.'],['verb + noun','protect the environment','We can reduce waste to protect the environment.']],
  decision:[['verb + noun','make a decision','We need to make a decision today.'],['adjective + noun','informed decision','Read the evidence before making an informed decision.']],
  research:[['verb + noun','conduct research','The team conducts research into renewable energy.'],['adjective + noun','scientific research','Scientific research can help us understand the problem.']],
  evidence:[['verb + noun','provide evidence','The report provides evidence of a change.'],['adjective + noun','convincing evidence','We need convincing evidence before drawing a conclusion.']],
  progress:[['verb + noun','make progress','You are making progress with your pronunciation.'],['adjective + noun','steady progress','The team made steady progress throughout the week.']],
  mistake:[['verb + noun','make a mistake','Everyone makes mistakes when learning.'],['adjective + noun','common mistake','This is a common mistake among beginners.']],
  advice:[['verb + noun','give advice','She gave me useful advice about studying.'],['verb + noun','take advice','It can help to take advice from an experienced teacher.']],
  attention:[['verb + noun','pay attention','Please pay attention to the instructions.'],['verb + noun','draw attention to','The report draws attention to the risks.']],
  opportunity:[['verb + noun','take an opportunity','Take the opportunity to practise with a partner.'],['adjective + noun','excellent opportunity','The project is an excellent opportunity to learn.']],
  responsibility:[['verb + noun','take responsibility','We all need to take responsibility for our actions.'],['adjective + noun','shared responsibility','Protecting the environment is a shared responsibility.']]
};
function teachingCollocations(word) {
  return (curated[word] || []).map(([pattern,phrase,example])=>({pattern,phrase,example,source:'Helen Dictionary — biên soạn'}));
}
// Frequent adjacent words are corpus suggestions, not sense-specific dictionary collocations.
const stop = new Set('a an the this that these those i you he she it we they me us them my your his her its our their all any each every one two first other another some no not and or but if as than then so of in on at to for from by with without into is are was were be been being am have has had do does did can could would should may might will shall which who whom whose what when where why how there here very more most much such also only'.split(' '));
function corpusPhrases(word, entries, before) {
  if(!Array.isArray(entries)) return [];
  return entries.filter(entry=>typeof entry.word==='string' && /^[a-z]+$/i.test(entry.word) && !stop.has(entry.word.toLowerCase()) && entry.word.toLowerCase()!==word && Number(entry.score)>0)
    .slice(0,6).map(entry=>({pattern:before?'Từ đứng trước':'Từ đứng sau',phrase:before?`${entry.word} ${word}`:`${word} ${entry.word}`,source:'Datamuse — cụm từ thường đứng cạnh nhau'}));
}
function exampleCombinations(word,meanings) {
  const key=word.toLowerCase(),seen=new Set(),items=[];
  if(!/^[a-z]+$/.test(key))return items;
  for(const meaning of meanings || [])for(const sense of meaning.senses || [])for(const example of [...new Set([sense.example,...(sense.examples || [])].filter(text=>typeof text==='string' && text))]) {
    const matches=[...example.matchAll(/[a-z]+(?:['-][a-z]+)*/gi)],tokens=matches.map(match=>match[0]);
    for(let index=0;index<tokens.length;index++)if(tokens[index].toLowerCase()===key) {
      for(const before of [true,false]) {
        const adjacent=tokens[index+(before?-1:1)];
        if(!adjacent || stop.has(adjacent.toLowerCase()))continue;
        const left=before?index-1:index,right=left+1;
        if(!/^\s+$/.test(example.slice(matches[left].index+tokens[left].length,matches[right].index)))continue;
        const phrase=before?`${adjacent} ${tokens[index]}`:`${tokens[index]} ${adjacent}`;
        if(seen.has(phrase.toLowerCase()))continue;seen.add(phrase.toLowerCase());
        items.push({pattern:'From dictionary examples',phrase,example,source:sense.relationSource || 'Dictionary example'});
        if(items.length>=8)return items;
      }
    }
  }
  return items;
}
module.exports={teachingCollocations,corpusPhrases,exampleCombinations};
