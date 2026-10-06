function voiceMetadata(voice) {
  const accent=String(voice.labels?.accent || '').trim();
  const normalized=accent.toLowerCase().replace(/[_-]/g,' ');
  // Use provider metadata only. A voice name does not establish nationality.
  const american=/\b(american|america|united states|us|usa)\b/.test(normalized);
  const british=/\b(british|britain|england|united kingdom|uk|received pronunciation|rp)\b/.test(normalized) || normalized==='english';
  const dialect=american && !british?'Ame':british && !american?'Eng':null;
  return {name:voice.name,voice_id:voice.voice_id,category:voice.category,accent,dialect};
}
module.exports={voiceMetadata};
