# Seven-language translation

Helen supports English (`en`), Vietnamese (`vi`), Korean (`ko`), Japanese (`ja`), Simplified Chinese (`zh-CN`), Spanish (`es`) and French (`fr`). `public/assets/languages.js` is the shared browser/server allowlist. Regional locales normalize to these codes; Traditional Chinese device settings use the supported Simplified Chinese interface. Other interface languages fall back to English. Removed translation languages are rejected by the API, including empty batches.

## Selection and direction

- The browser's ordered `navigator.languages` / `navigator.language` preferences choose the interface language. Interface messages are packaged locally and work offline without translation requests.
- `helen-from` and `helen-target` remain separate persisted preferences. An existing supported translation selection wins over the device language. A removed selection migrates to English for input and the supported device language for output. Learning data is not cleared.
- Non-English search input translates **directly from the original query to the selected target**. The English headword used to retrieve dictionary definitions does not replace that query for translation. A separate translation panel remains available even when there is no English dictionary entry.
- Swap languages reverses the selectors and uses the last matching translated text when it fits the 100-character search limit. Editing or changing selection prevents reuse of an unrelated translation.
- English dictionary definitions, example sentences and English speaking practice remain learning material in English. Definition eyes, quiz explanations, topic definitions and AI translations use the selected target. English as target needs no translation request for English material.
- Direct translations and reverse lookups prefer structured Gemini translation with an explicit source and target, using the stable 3.1 Flash Lite model unless an environment model is selected. A live check found incorrect multilingual results from MyMemory, so direct requests do not fall back to unverified memories on AI failure. The new `translation-language-v1` namespace avoids reusing those results; older local translations remain accessible offline. Translation cache keys retain the source, target, text and sense/purpose. Regional aliases share the canonical cache entry. Existing Vietnamese editorial meanings remain available immediately; other cached translations are reused across requests and restarts.

## Practical AI and saved content

Practical AI receives separate validated `translationLanguage` and `interfaceLanguage` values. Reply/phrase/collocation translations use the selected target; new coaching and assessment explanations use the interface language. English recordings and learner text remain verbatim, with the existing transcript review and three-minute recording limits.

Saved reply translations carry their original language; older replies are treated as Vietnamese. Expanding a saved translation in a different target uses the English source and shared translation cache rather than relabelling Vietnamese text. New requests include language choices in their private deduplication key. Old conversations, word sets, reviews, history and audio are retained.

Interface localization applies only to explicitly marked interface copy and newly constructed interface fragments. The shared `finishLoading` helper also leaves completed content verbatim; only callers rendering interface messages localize them. It never scans or rewrites saved words, dictionary definitions, examples, quiz answers or recordings. New interface copy should be added to `ui-messages.js` in all seven columns and marked with `data-i18n`, or formatted with `HelenI18n.t`. Dynamic controls retain their owner and event handlers.

## Validation and limits

The full regression run passed 443 tests; three live MySQL integration tests were skipped because this local environment has no MySQL credentials. Browser checks passed with no reported WCAG violations in the tested views, and no mobile overflow.

- Unit tests exercise all 42 distinct directions and all seven identity paths with controlled provider responses, including durable-cache reuse, alias normalization, invalid languages and preference migration. These verify routing and isolation, not a linguistic certification of every provider translation.
- API tests reject removed languages and malformed language values. Practical AI tests verify that prompt language, translation language and original learner words stay separate.
- `scripts/qa/languages.cjs` checks eight browser locales on a 390-pixel screen, direct French→Japanese→French search, reload persistence, each destination's overflow, and a French desktop interface with Korean selected while offline. Provider responses in this script are fixtures; no paid generation is used.
- Existing recording and application-update browser checks remain applicable. Live physical iPhone microphones are not emulated as real hardware by browser fixtures.
- A new translation still needs Internet and depends on upstream quota/availability. An uncached offline translation gives a message instead of displaying a different language. Local interface messages do not need a new API key.

After deployment, accept **Update app** once. No environment-variable changes or database migration are required.
