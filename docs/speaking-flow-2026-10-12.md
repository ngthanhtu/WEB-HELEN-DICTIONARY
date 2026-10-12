# Practical AI: reliable coaching for disfluent speech

## Problem and resulting behavior

The screenshot shows a successful transcript with many um/uh tokens and repeated phrases, followed by `Góp ý AI chưa khớp câu của bạn`. An optional grammar edit quoted a phrase that could occur multiple times. The validator rejected the entire AI turn instead of just the uncertain edit.

Confirmed-text coaching now keeps a valid conversation reply and discards optional edits that are malformed, unquoted, partial-word, repeated, overlapping or beyond the four-edit limit. Only one exact complete occurrence can be edited. The suggested answer is constructed on the server from accepted edits; an AI-authored full rewrite cannot substitute different facts. Critical reply/translation/phrase structure and an invented transcript still fail validation. The original transcript remains unchanged in the conversation and signed assessment journal.

If an optional edit is discarded, the card explains that some changes were not applied and shows only verified edits. Its feedback is rebuilt from accepted reasons, so it does not describe an edit that was skipped. A valid reply still triggers the existing automatic read once. This recovery does not make another AI request or relax microphone uncertainty handling.

## Speaking flow

Helen observes standalone um/uh/erm/er/hmm variants and exact adjacent repeated multiword phrases in the original transcript. Words such as umbrella/umami, acronyms such as ER/UM, and grammatical/discourse words such as like/so/well are excluded. Single-word repetitions such as had had/that that are not called restarts. A repeated phrase can be emphasis, so the card asks the learner to consider the context.

At least three fillers or a repeated multiword phrase reveals a collapsed **Speaking flow** card. It offers three short, bilingual thinking/recall/phrasing choices and one practice strategy. Examples are authored by Helen:

- **Let me think for a moment.** — time to develop an idea.
- **Let me think back to a specific example.** — recall a real experience.
- **How can I put this?** — search for a way to express the idea.
- **Let me give you an example.** — explain an existing idea.
- **The main point is…** — return to the main point after a restart.

Only three relevant choices are shown per turn. A short pause is normal; the learner should not mechanically replace every um with a memorized phrase. Filler-only removal is not a grammar correction. Counts are observations of text, not measurements of pause duration, pronunciation, filler rate per minute or an automatic IELTS penalty.

Recognition instructions explicitly preserve audible fillers and restarts; grammar mistakes or fillers alone do not make speech unclear. Genuinely uncertain words still require learner review. The assessment receives filler totals from signed original speech when available, never from the cleaned-up draft. Audio observations remain necessary for acoustic scores. IELTS bands remain uncalibrated practice estimates.

This is an improvement to authored guidance, the Gemini prompt and deterministic validation. No model fine-tuning, new training dataset, provider, dependency, key or SQL migration is introduced. Saved conversations use the existing versioned key, and the new card survives reload/offline.

## Research actually reviewed

- [IELTS Speaking Band Descriptors, official PDF](https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf), retrieved and read on 12 October 2026. The descriptors distinguish content-related thinking from language-search hesitation and consider whether repetition/self-correction harms coherence. Occasional hesitation can coexist with higher-band performance; a raw filler count is not a scoring rule. Helen links the document rather than copying the rubric into its lessons.
- [LibreLingo documentation](https://github.com/LibreLingo/LibreLingo): small interactive practice units and a language-learning interface. The repository is currently archived. It was consulted for interaction patterns only; no code, course data or asset was copied into Helen.
- [OmniLingo documentation](https://github.com/omnilingo/omnilingo): an audio-first learning prototype with short practice batches and clear keyboard actions. This is a related learning app, not a validated speaking assessor or filler-detector benchmark. No code or Common Voice recordings were imported.
- [public-apis/public-apis](https://github.com/public-apis/public-apis) was checked as requested. A third-party API is not needed to safely resolve optional edits or observe existing transcript fillers. No additional provider is activated.

ELSA, Speak, Praktika and British Council page requests were rejected or unavailable in this execution environment. Their live UI or detection accuracy was not evaluated. This review does not claim Helen has been benchmarked against them, that it was trained on proprietary app data, or that all recognition/semantic errors are eliminated.

## Validation

Tests reproduce the screenshot's repeated-phrase rejection and require one successful reply generation, an unchanged original, the remaining valid grammar correction and cached retry reuse. Additional checks cover natural words/acronyms, grammatical repetitions, filler-only edits, unsafe full rewrites, word boundaries, signed-original counts, persisted feedback and strict critical-output validation. Existing speech/score/privacy/security tests remain applicable.

Browser checks exercise the full recognition → auto-send → optional-edit recovery → automatic device reply flow with fixture audio/provider output; the card is keyboard accessible and restored without new generation. These checks are not physical iPhone recognition tests and do not provide a latency SLA or calibrated band accuracy.
