# Practical AI: long recordings and temporary overload

## Measurement and scope

A continuous 174.983-second, 443-word English interview answer was synthesized locally with Flite, encoded as mono AAC/M4A (1,077,533 bytes), and sent to the real Render `/api/practical` endpoint. It contains fillers, repeated starts and deliberately incorrect grammar. This is real provider processing of a real audio file, not a physical iPhone microphone test.

On baseline `3446430`, transcription returned 443 words in 9.05 seconds, coaching in 3.094 seconds, and the identical completed retry in 0.265 seconds. The first quota reservation took about 3.07 seconds; transcription provider work took about 4.99 seconds. The original reported overload did not reproduce in that single live run, so these measurements do not identify every intermittent provider problem.

After deploying `2d4e768`, an immediate cold-start test returned `USAGE_UNAVAILABLE` before provider work. Once the database recovered, the same audio succeeded in **5.246 seconds for transcription + 3.011 seconds for coaching** (443 words, three grounded grammar corrections, two collocations and a follow-up question); completed retry took **0.270 seconds**. This is one successful measured run, not a performance percentile.

That cold-start observation led to a further fix: initialize the existing budget table first, release waiting speaking reservations as soon as that table is ready, and retry failed initial schema setup after five seconds rather than thirty. Other startup tables no longer delay a healthy quota reservation. No quota check is skipped, and the 3.5-second reservation deadline remains bounded.

The old seven-second coaching deadline could reject otherwise usable feedback on long answers. No change can guarantee a free provider is always available or processes a three-minute recording in under five seconds.

## Changes

- Server deadlines are shared with the composer: 30 seconds for transcription above 30 seconds, 12 seconds for short transcription, 18 seconds for coaching at least 120 words, 10 seconds for shorter coaching, and 20 seconds for assessment. The client allows five extra seconds for transmission. These are maximum waits, not expected latency.
- Explicit provider HTTP 500/502/503 failures get one retry after 500 ms, within the same original deadline and only with enough time left. Every generation attempt reserves quota. HTTP 429, authentication failures, unknown network failures and expired requests do not automatically retry. Existing model replacement remains bounded by the same two-attempt loop.
- Truncated output, invalid JSON, temporary overload and exhausted provider quota have distinct safe errors. Unsuccessful output never appears as completed feedback.
- While waiting, the composer names transcription, coaching or assessment, updates elapsed time every five seconds, and keeps Cancel available.
- Failed transcription keeps only the latest clip in the tab's memory. **Retry recording** reuses its request ID and payload. Successful recognition, cancellation, a new recording, navigation/backgrounding, a new session or reload discards it. No clip is written to browser persistent storage, the service worker or the database. If coaching fails after recognition, the transcript stays editable for Confirm & send.
- Exact transcript preservation, grounded correction checks, signed audio evidence, daily budgets, voice selection and automatic reply playback remain in use.

## Verification

Nine new backend regression tests (including isolated budget-table readiness and failed cold-start recovery) cover slow long-turn success past seven seconds, client/server deadline margins, temporary and permanent overload, quota/auth/network non-retries, one shared retry deadline and invalid/truncated output. The full suite passes **399 tests**, with **3 real MySQL integration tests skipped** because local database credentials are unavailable. Existing quota and speech safety tests also pass. Secret scanning passes.

Browser fault injection at 390px and 1440px exercises a 175-second recorder payload, two explicit provider failures, retained clip retry with the same identity, six-second recognition, eight-second coaching, Confirm & send, elapsed status, grammar/collocation feedback, one automatic reply playback, reload and cancellation with a late response. Both themes have no horizontal overflow or Axe WCAG AA violations. Browser microphone and playback are simulated; this does not establish real iOS microphone or autoplay behavior.

No new API key, dependency, table or Render setting is required. After deployment, reload Practical AI, speak a long answer, and check both the feedback and follow-up question. If a temporary error persists, use Retry recording without closing the tab; after recognition use Confirm & send for the preserved text. Provider quota exhaustion still requires quota recovery.
