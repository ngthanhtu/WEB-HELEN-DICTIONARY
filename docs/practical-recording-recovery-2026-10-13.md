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

## Confirmed live result after overload failover

Build `646b33d` successfully processed the 180.000-second, 1,080,582-byte synthesized AAC/MP4 clip. ASR returned 443 words, clear audibility and a valid acoustic receipt in **7.754 seconds** (quota 1.8495s, provider 5.2156s). Confirmed-text coaching returned a partner question, grounded grammar corrections and two collocations in **5.973 seconds**; repeated coaching returned the same result in **0.151 seconds** without quota/provider work. The service then reported concrete model `gemini-3.1-flash-lite`, prepared=true, with no last failure. Before this change, `gemini-3.5-flash-lite` returned explicit HTTP 503 even for a short answer. Failover selects another listed Lite model only on explicit 500/502/503, reserves the second attempt, respects an explicit Environment model and never switches to escape provider quotas or authentication failures.

Cold model metadata on Render also exceeded the original 3-second preparation limit. Background preparation now allows eight seconds with a true overall race and ignores late results after abort. This does not delay audio capture or remove the local generation watchdog. The complete suite before this final cold-preparation adjustment passed 422 tests (three real MySQL tests skipped); its added cold/ignored-abort regression also passes.

Final complete suite: **424 passed, 3 real MySQL checks skipped**. No npm dependency changed. The security ownership suite also exercises 61 rotated anonymous cookies locally and confirms a shared 60/minute history request ceiling; production saturation is not run.

A subsequent cold-start probe on `1453e82` exposed the floating alias returning to overloaded 3.5 before discovery completed. Practical AI now starts with the successfully tested `gemini-3.1-flash-lite` and keeps it when listed, even if catalogue preparation fails. Explicit `GEMINI_MODEL` remains authoritative, 404 discovery remains available for retirement, and explicit overload can select another listed Lite. Each in-flight attempt binds its own selected model so concurrent catalogue completion cannot confuse failover identity. The cold-catalogue regression verifies MINIMAL thinking and a successful first turn without discovery.

On `cb24aae`, 180-second ASR succeeded in 5.377 seconds (443 words, clear, valid receipt) but a long coaching turn exceeded 18 seconds during provider latency. Confirmed-text generation now omits the unused duplicate feedback field; display feedback is still built from accepted exact corrections. Long-answer coaching has a separate 25-second server / 30-second client deadline; short coaching, transcription and assessment limits stay unchanged. This is a bounded recovery margin rather than a promise about free-provider latency.

Long-audio recovery now cancels a stalled first provider attempt after 14 seconds and retries once on the verified model, within the original 30-second ASR request deadline. Each attempt reserves its own allowance; late cancelled results cannot be cached as success. Arbitrary network failures, quota and authentication errors still do not start automatic retry loops. Transcription defaults are 200 attempts/device/day and 600/network/day to accommodate one retry per 100 long recordings; the global speaking cap stays 600 and provider limits still apply. Tests cover one recovery, two stalled attempts, cancellation, late output, coalescing and exactly two debits.

A live probe on `72a72ed` showed a failed 3.5 backup remained selected, causing the following coaching turn to use the overloaded model. Only an HTTP-successful model now becomes sticky; failed requests restore the last healthy model. Explicit overloaded backups cool down for five minutes. Catalogue preparation collects alternatives without replacing the verified default, and managed timeout retry binds the original attempt model. Regression coverage verifies two failed models restore 3.1 and a later recovery skips the known overloaded backup.
