# Practical AI recording recovery — 13 October 2026

## Observed failure

A real Render API probe using a locally synthesized 175-second AAC/MP4 answer reproduced two failures on build `087d7b1`: ASR returned `USAGE_UNAVAILABLE` after 4.382 seconds (`quota=3502.6ms`, `provider=0ms`); coaching returned `PRACTICAL_SERVICE` after 18.139 seconds, near the long-answer deadline, following a temporary provider failure and one retry. These measurements demonstrate a database quota timeout and a separate provider failure. They do not establish that a human microphone was broken, or identify every possible provider outage.

## Changes

- Warm the independent AI quota connection when entering Practical AI, with concurrent requests coalesced and a 45-second throttle. No generation allowance is consumed by this database SELECT. Allow a bounded 6.5-second cold-connection window for speaking's atomic transaction; never bypass durable limits when storage fails, retry an unknown COMMIT outcome, or reuse a destroyed connection.
- Discover the concrete Lite model during startup/page preparation so version-specific minimal thinking applies to audio and coaching. Preserve an explicitly configured model. Discovery is throttled, does not generate content, and does not spend a generation allowance.
- Every attempt shares the same local AbortController deadline. The Google server timeout header stays at 60 seconds so it does not impose a second premature server deadline; Helen still aborts locally at its 10/18/20/30-second stage limit. Timeout/abort errors return `PRACTICAL_TIMEOUT` instead of being mislabeled as connectivity failures. Explicit transient 500/502/503 still retry once within that deadline; auth, quotas and unknown network outcomes do not loop. Three-minute ASR remains bounded by 30 seconds server / 35 seconds client.
- Increase transcription output capacity for a long answer. The existing supported containers, 180-second duration limit, 6 MB decoded audio cap, parser limits and exact acoustic evidence binding remain enforced.
- Add optional native browser live captions (`SpeechRecognition` / `webkitSpeechRecognition`) while the full recorder captures audio. Interim revisions replace their result slot; pauses can restart recognition; permission/network errors stop captions without stopping the recording. Repeated immediate ends are bounded. This makes no extra Gemini generation request per phrase.
- Show the live draft in **Your reply**, scroll it as speech arrives, and save it on-device with throttled writes plus a final flush. Keep fillers, repeated starts and recognition mistakes as returned; the app never silently cleans them up. Browser recognition itself can still mishear or normalize speech, so captions are explicitly provisional.
- When ASR fails, keep Retry recording for the clip in tab memory and allow manual **Confirm & send** using the editable live draft. Text-only fallback supports grammar/vocabulary feedback but cannot invent pronunciation evidence or a full speaking band.
- If browser captions and final audio transcription disagree, keep both versions and require confirmation instead of auto-sending. Original captions remain in the saved conversation for inspection. Background/cancel/reload removes the temporary audio but retains the text draft; saved learning and existing voice preferences remain intact.

## Validation

Native-result unit fixtures cover partial revision, fillers/mistakes, pause/restart, final result after stop, stale callbacks, unsupported/denied/unavailable speech, text capacity and immediate-end loops. Quota/model tests cover warming without debit, minimal thinking, preserved explicit model and correct timeout classification. Existing tests exercise exact 180-second automatic stop and scheduling jitter, audio cancellation and feedback grounding.

Actual Chromium UI tests at 390 and 1440 pixels use fake browser capture and provider responses. They exercise live draft updates, a near-three-minute payload, failed upload followed by refresh and manual feedback, automatic reply audio, disagreement confirmation, preservation of original captions and light/dark accessibility checks. They are browser behavior tests, not a physical iPhone microphone test. The existing app-update/cursor and offline browser checks also pass.

To rerun optional browser QA, install Playwright and axe-core outside the application or use existing paths, then run:

```sh
HELEN_PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
HELEN_CHROMIUM_PATH=/absolute/path/to/chromium \
HELEN_AXE_PATH=/absolute/path/to/axe.min.js \
HELEN_QA_OUTPUT=/tmp/helen-recording-qa \
node scripts/qa-practical-recording.cjs
```

Without `HELEN_AXE_PATH`, the report explicitly records the accessibility run as absent. Fake capture cannot verify real microphone signal quality, Safari's concurrent capture support, dictation/Siri settings or the availability of Apple/Google speech services. If live captions are unavailable, Helen shows that state and retains full audio recognition rather than pretending to display live text. Gemini/provider outages and free quota limits remain external dependencies; no promise of zero future failures is made.

No new API key, dependency, SQL table, paid service or Render variable is required for this recording update. After deployment, open Helen and press **Update app** when prompted. The existing Gemini key stays in Render Environment. Live API evidence is saved separately in workspace QA artifacts.

Local complete suite: **420 passed, 3 real MySQL checks skipped**. UI recording and app-update QA pass at mobile/desktop sizes; light/dark axe checks report zero violations. Public security checks confirm CSP/cookie/private-file protections and isolated history writes/reads/clears on build `24a987e`.

Follow-up Render probe on `e5c7ab5`: quota improved to about 0.8 seconds, but a real 180-second clip still hit the 30-second AI deadline and coaching also failed. Added sanitized service diagnostics (model plus status/type/network code only; no error messages, key, transcript, identifier or request body) to distinguish a provider/network problem from an invalid recording. The SDK server-timeout header is now independent of the local watchdog. Further live verification is required; this document does not claim that this probe succeeded.
