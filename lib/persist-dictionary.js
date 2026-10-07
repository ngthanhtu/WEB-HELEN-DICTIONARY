// Persist completed results in the background, including results served from RAM.
// Failed attempts remain eligible on the next lookup; no user data is logged.
function createDictionaryPersistence(database, revision) {
  const saved = new WeakSet(), pending = new WeakSet();
  return function persist(word, entries) {
    if (!database.status().configured || saved.has(entries) || pending.has(entries)) return;
    pending.add(entries);
    async function attempt(remaining) {
      try {
        const degraded = entries.some(entry => entry.meanings?.some(m => m.relationsUnavailable) || entry.collocations?.unavailable);
        const results = await Promise.all([
          database.set(`dictionary-v${revision}`, word, entries, degraded ? 300000 : 86400000),
          database.vocabulary(word, entries, revision)
        ]);
        if (results.every(Boolean)) {saved.add(entries);pending.delete(entries);return;}
      } catch {} // Store status/logs report database errors without failing lookup responses.
      if (remaining > 0) {
        const timer = setTimeout(() => {void attempt(remaining - 1);}, 31000);
        timer.unref?.();
      } else pending.delete(entries);
    }
    void attempt(2);
  };
}
module.exports = {createDictionaryPersistence};
