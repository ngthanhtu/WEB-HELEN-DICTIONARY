// Helen Dictionary backend v4 (Merriam-Webster optional + Wiktionary). Node 18+
require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const path = require('path');
const { wordnetMeanings } = require('./lib/lexicon');
const { spellingSuggestions, warmSpellingIndex } = require('./lib/spelling');
const { voiceMetadata } = require('./lib/voice-labels');
const { teachingCollocations, corpusPhrases } = require('./lib/collocations');
const { createTranslationService } = require('./lib/translation');
const { createSpeechService } = require('./lib/speech-ai');
const { createContextService, languages: contextLanguages } = require('./lib/context-ai');
const { REVISION, words: relationWords, wiktionaryRelations, mergeRelations } = require('./lib/thesaurus');
const { createDatabase } = require('./lib/database');
const { supportsPos } = require('./lib/word-pos');
// Injected variables take precedence; .env takes precedence over legacy env.
require('dotenv').config({ path: [path.join(__dirname, '.env'), path.join(__dirname, 'env')], quiet: true });
// Avoid loading the large SDK during the first mobile translation or recording request.
if(process.env.GEMINI_API_KEY)require('@google/genai');
const app = express();
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
if (process.env.NODE_ENV === 'production') {
  const { rateLimit } = require('express-rate-limit');
  const limit = count => rateLimit({windowMs:60_000, limit:count, standardHeaders:'draft-8', legacyHeaders:false,
    message:{error:'Bạn thao tác quá nhanh. Hãy đợi một phút rồi thử lại.'}});
  app.use('/api/tts', limit(12));
  app.use('/api/lookup', limit(30));
  app.use('/api/spelling', limit(30));
  app.use('/api/translate', limit(60));
  app.post('/api/context', limit(6));
  app.post('/api/speech', limit(10));
}
const PORT = process.env.PORT || 3000;
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah (premade); users can explicitly select another voice
const database = createDatabase();
const contexts=createContextService({apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL,store:database});
const translations=createTranslationService({apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL,store:database});
const speech=createSpeechService({apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL});
const cache = new Map(); // successful results only
const memo = async (k, fn) => {
  if (cache.has(k)) return cache.get(k);
  const key = require('node:crypto').createHash('sha256').update(KEY || '').digest('hex') + k;
  const old = await database.get('tts-v1',key);
  if (old?.value?.audio && typeof old.value.audio === 'string') {
    const buffer = Buffer.from(old.value.audio,'base64');cache.set(k,buffer);return buffer;
  }
  const value = await fn();cache.set(k,value);
  if (cache.size > 1000) cache.delete(cache.keys().next().value);
  // Cache successful short pronunciations; recordings and credentials are never persisted.
  if (value.length <= 300000) void database.set('tts-v1',key,{audio:value.toString('base64')});
  return value;
};

// Short microphone clips are larger than normal dictionary JSON requests.
app.use('/api/speech',express.json({limit:'2mb'}));
app.use(express.json());
app.use((error,req,res,next)=>{
  if(!req.path.startsWith('/api/speech')) return next(error);
  if(error.type==='entity.too.large') return res.status(413).json({error:'Bản ghi âm quá dài. Hãy nói một từ hoặc cụm từ ngắn.',code:'SPEECH_AUDIO'});
  if(error.type==='entity.parse.failed') return res.status(400).json({error:'Không đọc được bản ghi âm. Hãy bấm micro để ghi lại.',code:'SPEECH_AUDIO'});
  next(error);
});
app.use(require('compression')());
app.get('/healthz', (req, res) => res.json({ status: 'ok', version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'local', voiceConfigured: Boolean(KEY), aiConfigured:contexts.configured,speechConfigured:speech.configured,database:database.status() }));
app.get('/api/history/status',(req,res) => res.json(database.status()));
function deviceToken(req,res,next) {
  if (req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({error:'Yêu cầu không hợp lệ.'});
  const token = req.get('X-Helen-Device');
  if (!/^[a-f0-9]{64}$/.test(token || '')) return res.status(401).json({error:'Mở lại website để đồng bộ lịch sử.',code:'HISTORY_DEVICE'});
  req.deviceToken = token;res.set('Cache-Control','no-store');next();
}
if (process.env.NODE_ENV === 'production') app.use('/api/history',require('express-rate-limit').rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Đợi một phút rồi đồng bộ lại lịch sử.'}}));
app.get('/api/history',deviceToken,async(req,res) => {
  try {res.json({history:await database.history(req.deviceToken)});}
  catch(error) {res.status(error.status || 503).json({error:error.message,code:error.code});}
});
app.post('/api/history',deviceToken,async(req,res) => {
  const events = req.body.events;
  if (!Array.isArray(events) || !events.length || events.length > 100 || !events.every(event => event && /^[a-f0-9-]{36}$/.test(event.id || '') && ['search','clear'].includes(event.action) && typeof event.at === 'string' && Number.isFinite(Date.parse(event.at)) && Date.parse(event.at) <= Date.now() + 60000 && Date.parse(event.at) >= 0 && (event.action === 'clear' || typeof event.word === 'string' && event.word.trim() && event.word.length <= 100 && !/[\x00-\x1f<>]/.test(event.word)))) return res.status(400).json({error:'Dữ liệu lịch sử không hợp lệ.',code:'HISTORY_INVALID'});
  try {await database.saveHistory(req.deviceToken,events.map(event => ({...event,word:event.word?.trim()})));res.json({saved:true});}
  catch(error) {res.status(error.status || 503).json({error:error.message,code:error.code});}
});
app.get('/api/speech/status',(req,res)=>res.json({configured:speech.configured,provider:'Gemini'}));
app.post('/api/speech',async(req,res)=>{
  try {res.json(await speech.transcribe(req.body));}
  catch(error) {res.status(error.status || 503).json({error:error.message || 'Chưa nhận diện được. Hãy thử lại hoặc gõ từ.',code:error.code || 'SPEECH_SERVICE'});}
});
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/manifest.webmanifest',(req,res)=>res.type('application/manifest+json').sendFile(path.join(__dirname,'public','manifest.webmanifest')));
app.get('/sw.js',(req,res)=>{
  const version=process.env.RENDER_GIT_COMMIT?.replace(/[^a-zA-Z0-9]/g,'').slice(0,12) || 'mobile-v1';
  res.set('Cache-Control','no-cache').type('text/javascript').send(require('fs').readFileSync(path.join(__dirname,'public','sw.js'),'utf8').replace('__BUILD_VERSION__',version));
});
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), { dotfiles: 'deny', index: false }));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { dotfiles: 'deny', index: false }));
for (const image of ['Helennn.jpg', 'pexels-mart-production-7550534.jpg']) {
  app.get(`/${image}`, (req, res, next) => {
    res.sendFile(path.join(__dirname, image), error => {
      if (!error) return;
      if (error.code === 'ENOENT') {
        // Supports users who downloaded only the HTML/JS files. Pin the image version.
        return res.redirect(302, `https://raw.githubusercontent.com/ngthanhtu/WEB-HELEN-DICTIONARY/bb47b87/${encodeURIComponent(image)}`);
      }
      next(error);
    });
  });
}
app.get('/Helen1.jpg', (req, res) => res.sendFile(path.join(__dirname, 'Helen1.jpg')));

// fetch with timeout; returns Response or null on timeout/network error
async function get(url, opts = {}, ms = 3000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal, headers: { 'User-Agent': 'HelenDictionary/1.0 (learning project)', ...(opts.headers || {}) } }); }
  catch (error) { console.warn(`Upstream ${new URL(url).hostname}: ${error.name}`); return null; } finally { clearTimeout(t); }
}

const translate = (text, from, to, deadline) => translations.translate(text, from, to, { deadline });

const clean = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Definitions: Wiktionary REST (fast). Returns array, [] if not found, null if network error.
async function definitions(word) {
  const r = await get(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, {}, 5000);
  if (!r) return null;
  if (r.status === 404) return [];
  if (!r.ok) return null;
  let data;
  try { data = await r.json(); } catch { return null; }
  const en = Array.isArray(data.en) ? data.en : [];
  return en.map(m => ({
    pos: (m.partOfSpeech || '').toLowerCase(),
    senses: m.definitions.map(d => ({ definition: clean(d.definition), example: clean(((d.parsedExamples || [])[0] || {}).example || (d.examples || [])[0]) })).filter(s => s.definition).slice(0, 5),
    synonyms: []
  })).filter(m => m.senses.length);
}

// IPA: first English {{IPA|en|...}} in the page wikitext. Bounded to 2s so it never slows the search.
async function wikiDetails(word) {
  const deadline = Date.now() + 4500;
  const page = async (title, budget) => {
    const response = await get(`https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext%7Crevid&redirects=1&format=json&origin=*`, {}, budget);
    if (!response?.ok) return null;
    try {return (await response.json()).parse;}catch {return null;}
  };
  const parsed = await page(word,3500);
  if (!parsed) return {ipa:'',groups:[],available:false};
  try {
    const wt = parsed.wikitext['*'];
    const m = wt.match(/\{\{IPA\|en\|(\/[^|}]+\/|\[[^|}]+\])/);
    let groups = wiktionaryRelations(wt,word,parsed.revid);
    const references = [...new Set(groups.flatMap(group=>group.references || []))].filter(title=>/^Thesaurus:[\p{L}\p{N} '\u2019-]{1,100}$/u.test(title));
    const remaining = deadline-Date.now();
    if(remaining>100 && references.length) {
      const extra = await Promise.all(references.slice(0,6).map(async title => {
        const data = await page(title,remaining);
        return data?.wikitext?.['*'] ? wiktionaryRelations(data.wikitext['*'],title,data.revid) : [];
      }));groups.push(...extra.flat());
    }
    groups = groups.map(group=>({...group,synonyms:relationWords(group.synonyms,word).filter(value=>supportsPos(value,group.pos)),antonyms:relationWords(group.antonyms,word).filter(value=>supportsPos(value,group.pos))})).filter(group=>group.synonyms.length || group.antonyms.length);
    return {ipa:m ? m[1] : '',groups,available:Boolean(wt.trim())};
  } catch { return {ipa:'',groups:[],available:false}; }
}

// Optional better source: Merriam-Webster Learner's Dictionary (free key, non-commercial, 1000 queries/day).
// Simple English definitions + examples, like Cambridge. Enabled when MW_LEARNERS_KEY is set.
const MW_KEY = process.env.MW_LEARNERS_KEY;
const mwText = s => String(s || '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
const findVis = o => { if (Array.isArray(o)) { if (o[0] === 'vis' && o[1] && o[1][0]) return o[1][0].t; for (const x of o) { const v = findVis(x); if (v) return v; } } else if (o && typeof o === 'object') { for (const k in o) { const v = findVis(o[k]); if (v) return v; } } return ''; };
async function mwDefs(word) {
  if (!MW_KEY) return null;
  const r = await get(`https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(word)}?key=${MW_KEY}`, {}, 3500);
  if (!r || !r.ok) return null;
  let j; try { j = await r.json(); } catch { return null; }
  const es = Array.isArray(j) ? j.filter(e => e && typeof e === 'object' && e.meta && String(e.meta.id).split(':')[0].toLowerCase() === word && e.shortdef && e.shortdef.length) : [];
  if (!es.length) return null;
  const byPos = {};
  es.forEach(e => { const p = (e.fl || 'word').toLowerCase(); (byPos[p] = byPos[p] || []);
    e.shortdef.forEach((d, i) => byPos[p].push({ definition: mwText(d), example: i === 0 ? mwText(findVis(e.def)) : '' })); });
  return Object.entries(byPos).map(([pos, senses]) => ({ pos, senses: senses.slice(0, 6), synonyms: [] }));
}

// Free Dictionary API: optional related words, usage examples, and definition fallback.
async function relatedDictionary(word, timeout = 5000) {
  const r = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {}, timeout);
  if (r?.status === 404) return [];
  if (!r || !r.ok) return null;
  try {
    const data = await r.json();
    if (!Array.isArray(data)) return null;
    const unique = values => relationWords(values.map(clean),word);
    return data.flatMap(entry => (entry.meanings || []).map(m => ({
      pos: String(m.partOfSpeech || '').toLowerCase(),
      senses: (m.definitions || []).filter(d => d.definition).map(d => ({definition:clean(d.definition), example:clean(d.example),examples:d.example?[clean(d.example)]:[],synonyms:unique(d.synonyms||[]),antonyms:unique(d.antonyms||[]),relationSource:'Free Dictionary API'})),
      synonyms: unique(m.synonyms || []),
      antonyms: unique(m.antonyms || []),
      usageExamples: unique((m.definitions || []).map(d => d.example))
    }))).filter(m => m.senses.length);
  } catch { return null; }
}

// Exact-word Datamuse definitions provide another independent dictionary fallback.
async function datamuseDefinitions(word) {
  const r = await get(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=10`, {}, 5000);
  if (!r || !r.ok) return null;
  try {
    const data = await r.json();
    const exact = Array.isArray(data) && data.find(entry => String(entry.word).toLowerCase() === word);
    const byPos = {};
    for (const definition of exact?.defs || []) {
      if (typeof definition !== 'string') continue;
      const [tag, ...parts] = definition.split('\t');
      const pos = {n:'noun',v:'verb',adj:'adjective',adv:'adverb'}[tag] || 'word';
      const text = clean(parts.join(' '));
      if (text) (byPos[pos] ||= []).push({definition:text,example:''});
    }
    return Object.entries(byPos).map(([pos,senses]) => ({pos,senses:senses.slice(0,5),synonyms:[]}));
  } catch { return null; }
}

// Datamuse complements dictionary entries with explicit synonym/antonym relations.
async function wordRelations(word) {
  const load = async relation => {
    const r = await get(`https://api.datamuse.com/words?${relation}=${encodeURIComponent(word)}&md=p&max=100`, {}, 3500);
    if (!r || !r.ok) return null;
    try {
      const data = await r.json();
      return Array.isArray(data) ? data.filter(x => typeof x.word === 'string' && x.word.toLowerCase() !== word).map(x => ({word:clean(x.word), tags:Array.isArray(x.tags) ? x.tags : []})) : null;
    } catch { return null; }
  };
  const [synonyms, antonyms] = await Promise.all([load('rel_syn'), load('rel_ant')]);
  return {synonyms, antonyms};
}

const lookups = new Map();
// Local suggestions stay responsive while remote dictionaries verify exact matches.
app.get('/api/spelling', async (req,res) => {
  const word=String(req.query.word||'').trim().toLowerCase();
  if(word.length>100) return res.status(400).json({error:'Use at most 100 characters.'});
  res.json({word,suggestions:await spellingSuggestions(word).catch(()=>[])});
});
async function collocations(word) {
  const teaching = teachingCollocations(word);
  if (!/^[a-z]{2,48}$/.test(word)) return {teaching,corpus:[],unavailable:false};
  const results = await Promise.all(['rel_bgb','rel_bga'].map(async relation => {
    const response = await get(`https://api.datamuse.com/words?${relation}=${encodeURIComponent(word)}&max=40`, {}, 2500);
    if (!response?.ok) return null;
    try { return await response.json(); } catch { return null; }
  }));
  const known = new Set(teaching.map(item=>item.phrase));
  return {teaching,corpus:[...corpusPhrases(word,results[0],true),...corpusPhrases(word,results[1],false)].filter(item=>!known.has(item.phrase)),unavailable:results.some(data=>!Array.isArray(data))};
}
function beginLookup(word) {
  if (lookups.has(word)) return lookups.get(word);
  const lexical = process.env.HELEN_DISABLE_WORDNET === '1' ? Promise.resolve([]) : wordnetMeanings(word).catch(() => null);
  // Let local disk reads finish before starting remote DNS lookups on libuv's shared worker pool.
  const sources = lexical.then(() => {
    const related = relatedDictionary(word), relations = wordRelations(word), wiki = wikiDetails(word), phrases = collocations(word);
    return {related,relations,wiki,phrases,candidates:[
      [definitions(word), 'Wiktionary'], [related, 'Free Dictionary API'],
      [mwDefs(word), "Merriam-Webster's Learner's Dictionary"], [datamuseDefinitions(word), 'Datamuse']
    ]};
  });
  const first = lexical.then(async meanings => {
    if (meanings?.length) return {word,ipa:'',source:'Princeton WordNet',meanings:mergeRelations(word,meanings).map(m=>({...m,relationsPending:true}))};
    const {candidates} = await sources;
    return Promise.any(candidates.map(async ([result, source]) => {
    const meanings = await result;
    if (!meanings?.length) throw new Error('No usable definitions');
    return {word, ipa:'', source, meanings:meanings.map(m => ({...m, relationsPending:true}))};
    }));
  }).catch(async () => {
    const {candidates} = await sources;
    const results = await Promise.all(candidates.map(([p]) => p));
    // Do not retry a confirmed missing word for another 15 seconds.
    if (results.some(r => Array.isArray(r))) {
      const error = new Error('No exact match found.'); error.status=404; throw error;
    }
    const error = new Error('Cannot reach dictionary services. Please try again.');
    error.status = results.some(r => Array.isArray(r)) ? 404 : 502;
    throw error;
  }).then(entry=>({...entry,collocations:{teaching:teachingCollocations(word),corpus:[],pending:true}}));
  const complete = first.then(async entry => {
    const {related,relations,wiki,phrases} = await sources;
    const [extra, links, wikiData, combinations] = await Promise.all([related, relations, wiki, phrases]);
    const meanings = mergeRelations(word,entry.meanings,extra,links,wikiData);
    const entries=[{...entry,ipa:wikiData.ipa,meanings,relatedSource:[extra?.length?'Free Dictionary API':null,links.synonyms!==null||links.antonyms!==null?'Datamuse':null,wikiData.groups.length?'Wiktionary (CC BY-SA 4.0)':null].filter(Boolean).join(', ')||null}];
    entries[0].collocations=combinations;
    cache.set(`d|${word}`,entries);
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    void database.set(`dictionary-v${REVISION}`,word,entries,meanings.some(m => m.relationsUnavailable) || combinations.unavailable ? 300000 : 86400000);
    void database.vocabulary(word,entries,REVISION);
    return entries;
  });
  // Observe background failures even if the caller only requests the early result.
  complete.catch(()=>{}).finally(()=>lookups.delete(word));
  const task={first,complete}; lookups.set(word,task); return task;
}
app.get('/api/lookup', async (req, res) => {
  const raw=String(req.query.word||'').trim(), from=String(req.query.from||'en');
  if (!raw) return res.status(400).json({error:'Type a word to search.'});
  if (raw.length>100) return res.status(400).json({error:'Use at most 100 characters for a lookup.'});
  let word;
  try {
    word=(from==='en'?raw:await translations.translate(raw,from,'en',{kind:'lookup'})).trim().toLowerCase();
    let entries=cache.get(`d|${word}`), enriching=false;
    const durable = entries ? null : await database.get(`dictionary-v${REVISION}`,word);
    if (durable?.value?.[0]?.meanings?.length) {
      entries=durable.value;cache.set(`d|${word}`,entries);
      if (!durable.fresh) void beginLookup(word).complete.catch(()=>{});
    }
    if (!entries) {
      const task=beginLookup(word);
      if (req.query.details==='1') entries=await task.complete;
      else {
        const entry=await task.first;
        // Give already-fast supplementary sources one event-loop turn to finish.
        entries=await Promise.race([task.complete,new Promise(resolve=>setTimeout(()=>resolve(null),100))]);
        if (!entries) { entries=[entry]; enriching=true; }
      }
    }
    res.json({query:raw,from,word,entries,enriching,lexicalRevision:REVISION});
  } catch(e) {
    const suggestions=e.status===404 ? await spellingSuggestions(word).catch(()=>[]) : [];
    res.status(e.status||502).json({error:e.message || 'Lookup failed. Try again.',...(e.code?{code:e.code}:{}),query:raw,word,suggestions,suggestionLanguage:'en'});
  }
});

app.get('/api/context/status',(req,res)=>res.json({configured:contexts.configured,provider:'Gemini',model:contexts.model}));
app.post('/api/context',async(req,res)=>{
  const {word:input,meaningIndex=0,senseIndex=0,language='vi'}=req.body;
  const word=typeof input==='string'?input.trim().toLowerCase():'';
  if(!word || word.length>100 || typeof language!=='string' || !Object.hasOwn(contextLanguages,language) || !Number.isInteger(meaningIndex) || !Number.isInteger(senseIndex) || meaningIndex<0 || meaningIndex>100 || senseIndex<0 || senseIndex>200) return res.status(400).json({error:'Từ, nghĩa hoặc ngôn ngữ không hợp lệ.'});
  if(!contexts.configured) return res.status(501).json({error:'Minh họa AI chưa được bật cho website này.'});
  try {
    const entry=cache.get(`d|${word}`)?.[0] || await beginLookup(word).first;
    const meaning=entry.meanings[meaningIndex], sense=meaning?.senses[senseIndex];
    if(!sense) return res.status(400).json({error:'Không tìm thấy nghĩa đã chọn. Hãy tra lại từ.'});
    res.json(await contexts.generate({word,pos:meaning.pos,definition:sense.definition,language}));
  } catch(error) {
    const status=Number(error.status);
    if(status===429) return res.status(429).json({error:'Gemini đã hết hạn mức hoặc đang giới hạn lượt gọi. Hãy thử lại sau.'});
    if(status===401 || status===403) return res.status(503).json({error:'Gemini chưa được cấp quyền hoạt động. Quản trị viên cần kiểm tra API key.'});
    if(status===404) return res.status(502).json({error:'Chưa truy cập được từ hoặc model AI đang cấu hình.'});
    res.status(502).json({error:'Chưa tạo được ngữ cảnh AI hợp lệ. Hãy thử lại sau.'});
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    const { texts = [], from = 'en', to = 'vi', kind, definition } = req.body;
    const deadline=Date.now()+6500;
    if (!Array.isArray(texts) || texts.length > 40 || !texts.every(text=>typeof text==='string' && text.trim() && text.length<=450)) return res.status(400).json({ error: 'Nội dung dịch không hợp lệ.', code:'TRANSLATION_INVALID' });
    res.json({ translations: await Promise.all(texts.map(async t => {
      try { return await translations.translate(t,from,to,{deadline,kind,definition:typeof definition==='string'?definition.slice(0,450):undefined}); }
      catch(error) {
        // A dictionary definition supplies context when the isolated headword is ambiguous.
        if(error.code==='TRANSLATION_UNAVAILABLE' && kind==='headword' && from==='en' && to==='vi' && typeof definition==='string' && definition.trim()) return `Giải nghĩa: ${await translate(definition.slice(0,450),from,to,deadline)}`;
        throw error;
      }
    })) });
  } catch (e) { res.status(e.status||503).json({ error: e.code ? e.message : 'Chưa kết nối được dịch nghĩa. Hãy thử lại.', code:e.code || 'TRANSLATION_UNAVAILABLE' }); }
});

// List voices your ElevenLabs key can actually use (open http://localhost:3000/api/voices to copy an ID).
app.get('/api/voices', async (req, res) => {
  if (!KEY) return res.status(501).json({ error: 'Voice chưa được cấu hình. Quản trị viên cần thêm ELEVENLABS_API_KEY trong Environment của dịch vụ Render rồi deploy lại.' });
  const r = await get('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } }, 6500);
  if (!r || !r.ok) return res.status(502).json({ error: 'Could not load voices.', status: r && r.status, detail: r ? (await r.text()).slice(0, 300) : 'no response' });
  const j = await r.json();
  res.json({ in_use: VOICE, voices: j.voices.map(voiceMetadata) });
});

app.get('/api/tts', async (req, res) => {
  const text = String(req.query.text || '').trim();
  const voice = String(req.query.voice || VOICE);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(voice)) return res.status(400).json({ error: 'Invalid voice ID.' });
  if (!text || text.length > 2000) return res.status(400).json({ error: 'Use between 1 and 2000 characters for speech.' });
  if (!KEY) return res.status(501).json({ error: 'Set ELEVENLABS_API_KEY to enable pronunciation.' });
  try {
    const buf = await memo(`v|${voice}|${text}`, async () => { // cache key includes the voice
      const r = await get(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
      }, 15000);
      if (!r || !r.ok) {
        console.error(`TTS failed: voice=${voice} status=${r ? r.status : 'no response'} ${r ? (await r.text()).slice(0, 300) : ''}`);
        const error = new Error(r ? `ElevenLabs rejected the selected voice (HTTP ${r.status}). Check key permissions, voice access and quota.` : 'Cannot connect to ElevenLabs.');
        error.upstreamStatus = r?.status;
        throw error;
      }
      return Buffer.from(await r.arrayBuffer());
    });
    res.set('Content-Type', 'audio/mpeg').set('Cache-Control', 'no-store').send(buf);
  } catch (e) { res.status(502).json({ error: e.message || 'Voice service is unavailable.', upstream_status: e.upstreamStatus }); }
});

const server = app.listen(PORT, () => {
  console.log(`Helen Dictionary v4 on http://localhost:${PORT}\nElevenLabs key: ${KEY ? 'set' : 'MISSING'} | Voice ID in use: ${VOICE}`);
  // Read the spelling index during startup so the first typo does not pay its loading cost.
  warmSpellingIndex().catch(error=>console.warn(`Spelling index unavailable: ${error.code || error.name}`));
  void database.initialize().then(ok => {if(database.status().configured) console.log(`Database: ${ok ? 'connected' : 'unavailable — local history and RAM cache remain active'}`);});
});
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => {server.close();void database.close().finally(() => process.exit(0));});
