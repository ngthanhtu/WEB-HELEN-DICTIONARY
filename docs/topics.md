# Topic curriculum v1

Helen publishes **20 topics × 200 headwords = 4,000 entries**, divided into ten lessons of twenty words per topic. Each headword appears once in the published catalog; spelling variants may describe the same concept. The separate `/topics` page keeps the dictionary and personal library focused.

The topics cover everyday situations and tasks useful for IELTS, TOEIC and VSTEP practice: education, work, business, money, travel, transport, housing, health, environment, science, technology, communication, society/law, relationships, food, culture, shopping, sport, agriculture/resources and personal skills/emotions. Exam tags indicate practice applications, **not measured frequency, a predicted score, an official exam syllabus or certified CEFR levels**. Reading/listening vocabulary also supplies ideas for the original speaking/writing prompts.

The layout follows the ForumFlash material supplied by the user: topic cards, small learning groups, a visible next action and collapsed extra practice. The reference URL could not be fetched through the environment's mandatory network proxy (HTTP 403); we did not copy its word lists or definitions.

## Sources and editorial choices

- `data/topic-curriculum.json`: topic metadata and two original contextual practice prompts per topic.
- `data/topic-vocabulary.txt`: authored candidate lists, including action words and descriptors.
- `data/topic-senses.txt`: original contextual definitions for ambiguous or dated source senses.
- `data/topic-originals.json`: original definitions for modern vocabulary missing from WordNet.
- `scripts/build-topics.cjs`: deterministic, offline selection and packaging. It uses licensed Princeton WordNet 3.0 data bundled with `wordnet-db`, keeps source examples and synonym sets intact, excludes proper-name senses, and retains a sense ID for every entry. Editorial definitions are clearly attributed to Helen; no competitor definitions are scraped.

The builder reserves actions/descriptors alongside foundational nouns and selected nutrition/resource terms. Every entry displays **one contextual sense**, not every possible meaning. Dictionary links open the normal full lookup. Translation translates that definition rather than guessing from the headword alone. A later editorial review can pin or replace a sense in the source files and regenerate the packs. Source verification is not proof that every semantic choice or translation is perfect.

Run `npm run build:topics` then `npm run audit:topics`. The audit examines all 4,000 published entries, their source definitions/examples/synonyms, unique headwords, size bounds and quiz eligibility in every lesson. Generated data lives in `public/assets/topics/manifest.json` and `public/assets/topics/v1/*.json`; commit those artifacts with their sources. For an incompatible schema/content migration, version the pack URLs and teach the client/service worker the new version before replacing old offline data.

## Learning and persistence

Users can practice a group without adding 4,000 words to their personal favorites. The selected group appears in Study, where the learner chooses a quiz style. Meaning questions, typed answers and matching use the local dataset; fill-in-the-blank requires at least three source examples containing the exact headword. Ineligible styles stay disabled with an explanation. Ordinary quizzes do not change spaced-repetition schedules.

Save a word or a group explicitly to use personal review. Existing cards, selected senses and schedules are retained when a topic word is already saved. Mark for review or **Save & review mistakes** explicitly saves missing words before opening Review. The personal 500-word cap still applies; exceeding it must show a short error rather than silently losing data.

`helen-topic-progress-v1` records the latest completed result per group, survives reload and is included in JSON backup. A check means a completed practice session, not mastery of all twenty words. Incomplete sessions do not create completion records. Backups from before this feature still import and preserve existing newer schedules/results.

## Speed and offline behavior

Only the small manifest loads on opening Topics. Opening a topic fetches one pack (approximately 40–52 KB uncompressed), not all 4,000 entries. Creating a quiz makes no AI or dictionary API request. Fetches have a 4.5-second client deadline and an explicit retry; host cold starts or network outages can still delay the initial application load.

**Save topic offline** writes the full 200-word pack to `helen-topic-packs-v1`, independent of personal lookup and audio caches. Downloading all topics is optional. The installed service-worker shell includes the manifest and topic client assets; updates preserve downloaded packs. A downloaded topic supports definitions, lesson selection and quizzes offline. New translations, AI audio and full dictionary lookups may need Internet. Existing cached audio/translation behavior remains available; installing the PWA alone does not download all 4,000 words.

The catalog remains usable without API keys. Pronunciation proof generation recognizes published modern headwords and original topic examples while still rejecting arbitrary text; TTS quota and attribution policies remain unchanged.

## QA scope

Automated source/structure checks cover 4,000 entries and 200 lessons. Browser QA uses mocked providers to avoid consuming API quotas, exercises desktop/mobile viewports, light/dark AA checks, quiz completion, storage preservation, offline downloaded packs and layout at 320/390/768/1440 px. Mobile is browser emulation; this does not replace testing on a physical iPhone.
