// Helen Dictionary backend v4 (Merriam-Webster optional + Wiktionary). Node 18+
require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const path = require('path');
// Injected variables take precedence; .env takes precedence over legacy env.
require('dotenv').config({ path: [path.join(__dirname, '.env'), path.join(__dirname, 'env')], quiet: true });
const app = express();
const PORT = process.env.PORT || 3000;
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah (premade); users can explicitly select another voice
const cache = new Map(); // successful results only
const memo = async (k, fn) => { if (cache.has(k)) return cache.get(k); const v = await fn(); cache.set(k, v); return v; };

app.use(express.json());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), { dotfiles: 'deny', index: false }));
for (const image of ['Helennn.jpg', 'pexels-mart-production-7550534.jpg']) {
  app.get(`/${image}`, (req, res) => res.sendFile(path.join(__dirname, image)));
}
app.get('/Helen1.jpg', (req, res) => res.sendFile(path.join(__dirname, 'Helen1.jpg')));

// fetch with timeout; returns Response or null on timeout/network error
async function get(url, opts = {}, ms = 3000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal, headers: { 'User-Agent': 'HelenDictionary/1.0 (learning project)', ...(opts.headers || {}) } }); }
  catch { return null; } finally { clearTimeout(t); }
}

async function translate(text, from, to) {
  if (from === to) return text;
  return memo(`t|${from}|${to}|${text}`, async () => {
    for (let i = 0; i < 2; i++) {
      const r = await get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`, {}, 5000);
      if (r && r.ok) {
        const data = await r.json();
        if (Number(data.responseStatus) === 200 && !data.responseData?.quotaFinished) {
          const primary = data.responseData?.translatedText;
          if (typeof primary === 'string' && primary.trim()) return primary;
          const alternative = Array.isArray(data.matches) && data.matches.find(m => Number(m.match) >= 0.99 && typeof m.translation === 'string' && m.translation.trim());
          if (alternative) return alternative.translation;
        }
      }
    }
    throw new Error('translate failed');
  });
}

const clean = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Definitions: Wiktionary REST (fast). Returns array, [] if not found, null if network error.
async function definitions(word) {
  const r = await get(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`, {}, 3500);
  if (!r) return null;
  if (r.status === 404) return [];
  if (!r.ok) return null;
  const en = (await r.json()).en || [];
  return en.map(m => ({
    pos: (m.partOfSpeech || '').toLowerCase(),
    senses: m.definitions.map(d => ({ definition: clean(d.definition), example: clean(((d.parsedExamples || [])[0] || {}).example || (d.examples || [])[0]) })).filter(s => s.definition).slice(0, 5),
    synonyms: []
  })).filter(m => m.senses.length);
}

// IPA: first English {{IPA|en|...}} in the page wikitext. Bounded to 2s so it never slows the search.
async function ipa(word) {
  const r = await get(`https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&redirects=1&format=json&origin=*`, {}, 2000);
  if (!r || !r.ok) return '';
  try {
    const wt = (await r.json()).parse.wikitext['*'];
    const m = wt.match(/\{\{IPA\|en\|(\/[^|}]+\/|\[[^|}]+\])/);
    return m ? m[1] : '';
  } catch { return ''; }
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
async function relatedDictionary(word) {
  const r = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {}, 3500);
  if (!r || !r.ok) return null;
  try {
    const data = await r.json();
    if (!Array.isArray(data)) return null;
    const unique = values => [...new Set(values.filter(v => typeof v === 'string' && v.trim()).map(clean))].slice(0, 12);
    return data.flatMap(entry => (entry.meanings || []).map(m => ({
      pos: String(m.partOfSpeech || '').toLowerCase(),
      senses: (m.definitions || []).filter(d => d.definition).slice(0, 5).map(d => ({definition:clean(d.definition), example:clean(d.example)})),
      synonyms: unique([...(m.synonyms || []), ...(m.definitions || []).flatMap(d => d.synonyms || [])]),
      antonyms: unique([...(m.antonyms || []), ...(m.definitions || []).flatMap(d => d.antonyms || [])]),
      usageExamples: unique((m.definitions || []).map(d => d.example))
    }))).filter(m => m.senses.length);
  } catch { return null; }
}

app.get('/api/lookup', async (req, res) => {
  const t0 = Date.now();
  const raw = String(req.query.word || '').trim();
  const from = String(req.query.from || 'en');
  if (!raw) return res.status(400).json({ error: 'Type a word to search.' });
  try {
    const word = (from === 'en' ? raw : await translate(raw, from, 'en')).trim().toLowerCase();
    let entries = cache.get(`d|${word}`);
    if (!entries) {
      const [wk, ipaText, mw, related] = await Promise.all([definitions(word), ipa(word), mwDefs(word), relatedDictionary(word)]); // all in parallel
      const meanings = mw || (wk?.length ? wk : related?.length ? related : wk); // Merriam-Webster first, Wiktionary as fallback
      if (meanings === null) return res.status(502).json({ error: 'Cannot reach the dictionary service from this network. Check your connection and try again.' });
      if (!meanings.length) return res.status(404).json({ error: `No entry found for "${word}". Check the spelling.` });
      const enriched = meanings.map(m => {
        const matches = (related || []).filter(r => r.pos === m.pos);
        const unique = items => [...new Set(items)].slice(0, 12);
        return { ...m,
          synonyms: unique([...(m.synonyms || []), ...matches.flatMap(r => r.synonyms)]),
          antonyms: unique([...(m.antonyms || []), ...matches.flatMap(r => r.antonyms)]),
          usageExamples: unique(matches.flatMap(r => r.usageExamples)).filter(e => !m.senses.some(s => s.example === e)).slice(0, 4)
        };
      });
      entries = [{ word, ipa: ipaText, meanings: enriched, source: mw ? "Merriam-Webster's Learner's Dictionary" : wk?.length ? 'Wiktionary' : 'Free Dictionary API', relatedSource: related?.length ? 'Free Dictionary API' : null }];
      cache.set(`d|${word}`, entries);
    }
    console.log(`lookup "${word}" ${Date.now() - t0}ms`);
    res.json({ query: raw, from, word, entries });
  } catch (e) { res.status(502).json({ error: 'Translation of your search word failed. Try again.' }); }
});

app.post('/api/translate', async (req, res) => {
  try {
    const { texts = [], from = 'en', to = 'vi' } = req.body;
    if (!Array.isArray(texts) || texts.length > 40) return res.status(400).json({ error: 'Invalid texts.' });
    res.json({ translations: await Promise.all(texts.map(t => translate(String(t).slice(0, 450), from, to))) });
  } catch (e) { res.status(502).json({ error: 'Translation service is unavailable.' }); }
});

// List voices your ElevenLabs key can actually use (open http://localhost:3000/api/voices to copy an ID).
app.get('/api/voices', async (req, res) => {
  if (!KEY) return res.status(501).json({ error: 'Set ELEVENLABS_API_KEY first.' });
  const r = await get('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY } }, 8000);
  if (!r || !r.ok) return res.status(502).json({ error: 'Could not load voices.', status: r && r.status, detail: r ? (await r.text()).slice(0, 300) : 'no response' });
  const j = await r.json();
  res.json({ in_use: VOICE, voices: j.voices.map(v => ({ name: v.name, voice_id: v.voice_id, category: v.category })) });
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

app.listen(PORT, () => console.log(`Helen Dictionary v4 on http://localhost:${PORT}\nElevenLabs key: ${KEY ? 'set' : 'MISSING'} | Voice ID in use: ${VOICE}`));
