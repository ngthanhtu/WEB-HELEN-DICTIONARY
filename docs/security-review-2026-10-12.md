# Helen security review — 12 October 2026

Scope: the current public Node/Express application, static/PWA client, provider integrations, device history, uploads, quotas, dependencies and reachable Git history. Helen has no user accounts, payments or admin interface in this version. The aim is to verify relevant attack boundaries and fix observed defects; this is not a guarantee against every future attack.

## Confirmed defects and fixes

| Finding | Evidence before the fix | Result after the fix |
| --- | --- | --- |
| Unauthenticated query could stop Node; high availability impact | A local request to `/api/suggestions?word[toString]=poison` disconnected, produced a TypeError and exited the server with code 1. Express's extended parser supplied an object to String(). | The simple parser and scalar query validation return 400/REQUEST_QUERY. Nested/prototype keys and repeated values fail on all API paths. The server remains available. |
| Case mismatch bypassed API protections; medium defense impact | `/api/session` with a foreign Origin returned 403, but `/API/session` returned 200 without no-store because routing was case-insensitive and the security path check was case-sensitive. | Lowercase normalization enforces Origin, Fetch Metadata, JSON and no-store on every casing. This was a bypass of defense layers; the review did not establish theft of another device's history. |

Additional hardening:

- Every asynchronous API handler now forwards rejected promises to Express 4's safe error handler. A deliberately malformed voice provider response returns generic JSON and keeps the server alive; neither response nor logs expose provider details.
- Collocations now have the same 30/minute/IP boundary as dictionary lookup. Local tests confirm mixed-case routes and IPv6 subnet grouping cannot bypass this limit by rotating addresses within one subnet.
- JSON uploads reject compressed bodies before decompression. Ordinary requests retain the existing body cap; dictionary speech and Practical AI retain their 2/9 MB JSON parser caps and 750 KB/6 MB decoded recording caps. The client still records up to three minutes. Magic-byte validation is not antivirus scanning or independent verification of the recording's claimed duration; uploads are never executed or saved as public files.
- Translation cache writes now use real prepared parameters rather than SQL string escaping. This removes a dependency on the database's backslash SQL mode. Writes remain asynchronous; lookup, translation reads and speech budgets retain their existing fast paths.
- Legacy history migration now requires an actual string, rejecting arrays that JavaScript could otherwise coerce into a token.

## Validation coverage

| Area | Checks and practical limits |
| --- | --- |
| Cookies / history authorization | HttpOnly, Secure, host-only, Strict, no-store; browser JavaScript cannot read the cookie; client headers do not grant production history access; migration preserves existing capability. |
| CSRF / cross-origin | Foreign/null origins, cross-site metadata, simple form mutations and route casing; CORS remains disabled. Origin headers are not authentication for a command-line caller. |
| XSS / UI | Actual Chromium at 390 and 1440 px: malicious markup in dictionary definitions/examples, AI coaching and study cards remains text; unsupported source links are absent; untrusted inline scripts fail while the matching nonce runs. CSP remains effective after an installed-shell offline reload. These are browser fixtures, not physical iPhone tests. |
| SQL / durable data | Hostile vocabulary values stay in parameters, history reads include only the device hash, translation writes use execute; TLS verification and multipleStatements=false remain enforced. MySQL mock tests do not establish the live account's least privileges or firewall rules. |
| Public files / traversal | Requests for env, Git config, source, encoded traversal, dotfiles and null-byte paths fail; intended public assets still load. |
| Provider secrets / errors | Current/staged/reachable-history scanners; safe error responses/logs; no client, cookie or backup credentials. Scanning cannot prove that an old key was revoked or erase GitHub caches/forks. |
| Upload / parser abuse | Bad JSON, oversized JSON, compressed bodies, wrong containers/base64/languages, conflicting text/audio and out-of-range duration; rejection precedes provider generation. |
| TTS / AI costs | Exact-content/expiry/key-bound TTS proofs, no arbitrary unproved text, atomic device/global reservations, fail-closed storage errors, retry coalescing, independent conversation budgets and signed audio receipts. Changing a client-supplied device ID does not evade the shared cap. |
| AI-generated data | Conversation output/correction schemas and exact quotes; forged/transferred assessment receipts fail; text-only sessions cannot invent pronunciation scores. Prompt instructions and schemas reduce misuse but are not a guarantee of model accuracy. |
| Local backup / offline data | Formula-neutralized CSV, escaped Anki HTML, validated imports, rollback on storage failure; backups exclude keys and history credentials. Offline data is available to anyone with access to the same device/browser profile; it is not encrypted at rest. |
| Dependencies | npm audit of production dependencies found zero known advisories on the review date; this does not cover unknown vulnerabilities or provider services. |
| CI / supply chain | Checkout and Node setup actions are pinned to verified commit IDs; workflow permissions are read-only and Git credentials are not persisted. Every push/PR now runs the locked install, production dependency audit and full regression suite alongside the secret scan. This is configured automation; local results do not certify a later GitHub runner execution. |

No destructive, high-volume or load test is run against the public service. Crash reproductions, rate-limit saturation and deliberately broken providers run only in disposable local processes with fake keys. Live checks use two new disposable history sessions and clear only their own entries. They do not invoke paid speech/AI generation.

## Results and remaining limits

The complete suite passes **375 tests**, with **3 real MySQL integration tests skipped** because local test credentials are absent. The separate browser probes pass at mobile/desktop widths and offline. The reachable Git history scan passed for 768 historical objects before this review commit; the current-file scan and production dependency audit passed. Detailed live verification is recorded after deployment in the workspace artifact `helen-security-render-qa-2026-10-12.json`.

This review cannot certify provider account permissions, old key revocation, TiDB firewall/least-privilege settings, physical iPhone behavior, or resistance to distributed denial-of-service. Anonymous clients can exhaust a bounded free quota; stronger bot protection or authenticated accounts would require additional product/infrastructure decisions. Existing cookies are bearer capabilities and are not accounts or guaranteed cross-device recovery. The current single-process IP counters reset when Render restarts; durable generation budgets remain in TiDB.

No new API key, SQL migration, environment variable, dependency or paid service is required for these fixes. Normal deployment/reload preserves existing favorites, history identity, study schedule, voice choices and offline caches.
