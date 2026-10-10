# Topic curriculum v2 — IELTS aim 6.5+

Helen publishes **20 topics × 200 headwords = 4,000 entries**, divided into ten lessons of twenty words per topic. Each headword appears once in the published catalog; spelling variants may describe the same concept. The separate `/topics` page keeps the dictionary and personal library focused.

The topics cover everyday situations and tasks useful for IELTS, TOEIC and VSTEP practice: education, work, business, money, travel, transport, housing, health, environment, science, technology, communication, society/law, relationships, food, culture, shopping, sport, agriculture/resources and personal skills/emotions. Exam tags indicate practice applications, **not measured frequency, a predicted score, an official exam syllabus or certified CEFR levels**. Reading/listening vocabulary also supplies ideas for the original speaking/writing prompts.

The layout follows the ForumFlash material supplied by the user: topic cards, small learning groups, a visible next action and collapsed extra practice. The reference URL could not be fetched through the environment's mandatory network proxy (HTTP 403); we did not copy its word lists or definitions.

## Sources and editorial choices

- `data/topic-curriculum.json`: stable topic IDs, metadata and two original speaking/writing prompts per topic.
- `data/topics-ielts/*.txt`: 50 distinct academic concepts per topic, original English and Vietnamese senses, and three explicitly chosen action collocations per concept. These lists are individually selected; the builder does not form a Cartesian product of arbitrary verbs and nouns.
- `data/topics-ielts/actions.json`: editorial action meanings. Inflected wording remains under editorial review; no translation API is required to build or reveal Vietnamese meanings.
- `data/topics-ielts/overrides.json`: contextual paraphrases where mechanically combining an action with a noun definition is awkward or misleading (for example statistical significance and parental leave).
- `data/topics-ielts/examples.txt`: 60 original bilingual contextual examples. Entries without an example do not invent one and are excluded from cloze practice when insufficient examples exist.
- `scripts/build-topics.cjs`: deterministic offline packaging of 1,000 concepts and 3,000 distinct action combinations. All 4,000 entries retain their bilingual contextual sense and editorial concept ID.
- `public/assets/topics/v2/*.json`: immutable edition URLs. v1 assets remain available for old downloads, with their original WordNet attribution and licenses.

These are **4,000 learning units, not 4,000 independent concepts**. Academic phrases such as digital literacy, academic achievement and learning outcomes lead the education topic. The aim is productive vocabulary for IELTS 6.5+ preparation; no examiner has assigned bands to these entries and no exam-frequency study is claimed. Existing Dictionary lookups still retain their other senses. Newly published compound expressions can resolve to an explicitly attributed local editorial sense without a slow remote lookup.

Run `npm run build:topics` then `npm run audit:topics`. The audit checks all records against their editable source, Vietnamese coverage, global uniqueness, every lesson's quiz and matching eligibility, and a 25 KB gzip payload ceiling. These structural checks do not replace linguistic review by a teacher.

## Learning and persistence

Users can practice a group without adding 4,000 words to their personal favorites. The selected group appears in Study, where the learner chooses a quiz style. Meaning questions, typed answers and matching use the local dataset; fill-in-the-blank requires at least three source examples containing the exact headword. Ineligible styles stay disabled with an explanation. Ordinary quizzes do not change spaced-repetition schedules.

Save a word or a group explicitly to use personal review. Existing cards, selected senses and schedules are retained when a topic word is already saved. Mark for review or **Save & review mistakes** explicitly saves missing words before opening Review. The personal 500-word cap still applies; exceeding it must show a short error rather than silently losing data.

`helen-topic-progress-v1` records the latest completed result per group, survives reload and is included in JSON backup. A check means a completed practice session, not mastery of all twenty words. Incomplete sessions do not create completion records. Backups from before this feature still import and preserve existing newer schedules/results.

## Speed and offline behavior

Only the small manifest loads on opening Topics. Opening a topic fetches one pack (approximately 73–87 KB uncompressed, at most 9 KB with gzip), not all 4,000 entries. Creating a quiz makes no AI or dictionary API request. Fetches have a 4.5-second client deadline and an explicit retry; host cold starts or network outages can still delay the initial application load.

**Save topic offline** writes the full 200-word pack to `helen-topic-packs-v1`, independent of personal lookup and audio caches. Downloading all topics is optional. `node scripts/audit-topics-v1.cjs` still validates the archived source edition. The installed service-worker shell includes the manifest and topic client assets; updates preserve downloaded packs. A downloaded v2 topic supports English definitions, Vietnamese meanings, lesson selection and quizzes offline. Vietnamese metadata remains on saved Study cards and backups. New languages, AI audio and full dictionary lookups may need Internet. Existing cached audio/translation behavior remains available; installing the PWA alone does not download all 4,000 words.

The catalog remains usable without API keys. Pronunciation proof generation recognizes published modern headwords and original topic examples while still rejecting arbitrary text; TTS quota and attribution policies remain unchanged.

## QA scope

Automated source/structure checks cover 4,000 entries and 200 lessons. Browser QA uses mocked providers to avoid consuming API quotas, exercises desktop/mobile viewports, light/dark AA checks, quiz completion, storage preservation, offline downloaded packs and layout at 320/390/768/1440 px. Mobile is browser emulation; this does not replace testing on a physical iPhone.

## Edition migration

Progress keys for new groups include `-v2`; old completion records and schedules remain in the version-1 personal storage/backup envelope. Old results never imply completion of the new curriculum. The service worker preserves both editions in the existing topic cache and does not download all topics automatically. When offline and v2 is absent, Topics may open an explicitly downloaded v1 pack with a visible old-edition notice; reconnect and reopen to fetch v2. Save topic offline then stores the new URL separately.

## Validation for the v2 release

- Whole-curriculum audit: 20 topics, 1,000 concepts, 3,000 action collocations, 4,000 Vietnamese definitions, and all 200 lessons. Maximum compressed pack approximately 8.4 KB.
- Full automated suite: 286 passed, three MySQL integration cases skipped without database configuration, zero failures.
- Chromium desktop and iPhone-size viewport: every topic's first Vietnamese eye result completed in 59–66 ms; no translation or TTS provider requests. This measures an already-loaded pack, not the initial Render cold start or a physical iPhone.
- No WCAG A/AA violations reported by axe on the tested topic detail page. Vocabulary may still benefit from review by an IELTS teacher; automated coverage does not establish that every expression is equally useful at every exam level.
- Saved Vietnamese meanings/examples, JSON restore, review dates, quiz/matching answer separation, edition-specific completion, v2 offline use, archived v1 offline fallback and reconnecting to the new edition were checked.
