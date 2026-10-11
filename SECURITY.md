# Helen security controls

Helen currently has device-scoped history and local study data, not accounts, payments or an administrator login. The controls below protect the current surface; they do not certify that every attack is impossible.

- API/provider secrets must remain server-side, in Render Environment or an ignored local `.env`. Public `.env.example` must contain placeholders only. `npm run security:check` scans tracked/staged files and `npm run security:history` scans reachable Git history without printing credential values. Removing a leaked key from Git does not revoke it; copies/forks and provider/GitHub caches remain outside the repository's control.
- Production private history must require the host-only HttpOnly/Secure/Strict cookie. Its 256-bit opaque capability is generated with cryptographic randomness; guessing/editing a cookie does not identify another device without possessing its random capability. It is not a JWT or a user account. The one-time migration accepts the former bearer that already authorized this history and preserves its hash; successful verification removes it from browser-readable storage. The cookie expires after a year and is renewed through `/api/session`. Clearing site cookies can remove access to the old device's remote history. Local words/study/backups remain independent.
- HttpOnly prevents JavaScript from reading the cookie; it does not make XSS harmless. The app must also escape untrusted dictionary/AI text. CSP allows only self-hosted scripts and the server's per-response nonce; inline event handlers and scripts without that nonce must fail. Inline styles remain allowed for existing components. Static assets must not include secrets; CSP must preserve the offline shell and device microphone.
- API mutations must be same-origin JSON; foreign Origin or cross-site Fetch Metadata must fail. SameSite=Strict provides an additional cookie boundary. CORS access from other origins is not enabled. The deployment must retain `TRUST_PROXY=1` behind Render's single trusted proxy so HTTPS/cookie/origin checks reflect the public URL; do not expose the Node server directly with a broader untrusted proxy setting.
- SQL values must be bound/escaped by mysql2, remote TLS certificate/hostname verification must remain enabled, and multipleStatements must remain false. Browser input must never be interpolated into SQL. Provider URLs are fixed; users cannot request arbitrary upstream URLs through the backend.
- TTS must retain dictionary pronunciation proofs, per-device/global durable limits and explicit voice selection. Gemini/Merriam-Webster limits and IP rate limits must remain enabled. A quota device identifier is not authorization. Cached successful content does not spend new generation quota. Failed upstream calls may retain their reservation.
- Practical AI must validate bounded alternating context, a request ID and either typed input or a size/duration-limited recording with a recognized container before provider work. AI replies must pass the output schema before receiving pronunciation proofs. Typed/audio turns share the existing daily AI quota; the atomic AI ledger must preserve the prior daily count and fail closed on database errors. Audio and conversation must not be written to the shared durable API cache. The latest local conversation is device-only; temporary server retry results must expire after five minutes. Browser output must use plain text, never provider HTML.
- Parser/errors must return short messages without stack traces or reflected provider credentials. Sensitive API/session responses must use no-store. CSP, nosniff, frame denial, referrer policy, microphone=self and HSTS on production HTTPS must remain enabled.
- Analytics stays opt-in. Backups must exclude credentials, history capability, cookies and microphone recordings. Review/study/local caches must remain intact across this migration. Cached API data retains its existing license/attribution obligations.

Validation: cookie attributes and production header rejection, preservation of legacy identity, blocked cross-origin/form requests, CSP nonce and HTTPS headers have automated tests. Browser fixtures verify HttpOnly invisibility, blocked injected inline scripts, translation/offline behavior and mobile layout. Secret scanners and npm audit are supplementary checks, not a penetration test. Physical iPhone Safari, database permission configuration and provider key revocation cannot be established by mocked tests. Security reports should omit secrets and describe a reproducible URL, input and expected/observed behavior.


# API keys and Git history

API keys must be stored in Render's **Environment** settings or an ignored local `.env` file. `.env.example` must contain empty values or explicit placeholders. Never put a real key in HTML, public assets, GitHub issues, logs, screenshots or chat.

ElevenLabs errors must not echo raw upstream response bodies to the browser or logs, because a provider error can reflect request credentials. Only the upstream status and a short safe message are exposed.

The public history contained an ElevenLabs API key in the legacy `env` file. Removing that file in a later commit did not remove the earlier blob. Treat the exposed key as compromised even if it has never been used by someone else.

## Immediate key replacement

1. Open your ElevenLabs account → **API Keys**. Revoke/delete the exposed key immediately. This may temporarily stop pronunciation until replacement is complete.
2. Create a separate key for Helen Dictionary. Restrict it to the Text-to-Speech and voice-list permissions the app needs; set a usage limit if your account supports it.
3. Render → **helen-dictionary** → **Environment** → edit `ELEVENLABS_API_KEY` and paste the replacement into its secret Value field. Save and deploy/restart the service. Do not commit the value or send it in chat.
4. Update your ignored local `.env` with the new key, then restart the local Node server. Remove any obsolete local `env` copy or update it so it cannot accidentally reuse the old key.
5. Check the website's Voice list and play a pronunciation. `voiceConfigured: true` in `/healthz` confirms that a value exists; it does not prove that the key is valid or has permission/quota. Inspect ElevenLabs usage for unexpected calls and charges.

## History cleanup

History must be rewritten in a separate fresh mirror, preserving the current application tree. Use `git-filter-repo` 2.47 or later with `--sensitive-data-removal --invert-paths --path env`. Check all reachable history and verify that the current tree is unchanged before publishing.

Publishing rewritten history requires explicit owner confirmation. Commit IDs change, existing clones must be replaced or carefully cleaned, and Render will deploy the new main head. Use an explicit `--force-with-lease` for the reviewed main head instead of an indiscriminate `git push --mirror`.

Rewriting the public branch does not revoke keys or erase other people's clones/forks. Old commit URLs, pull-request refs and cached views may remain on GitHub. After the rewrite, contact [GitHub Support](https://support.github.com/) about removing sensitive cached data and references; use the first-changed-commit information from the filter-repo report. See [GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

After publication, preserve any uncommitted local work outside the old clone without copying credential files. Clone the repository again, restore only needed non-secret changes, run `npm ci`, and recreate an ignored `.env` locally. Do not merge or push the old history back into the clean repository.

## Prevent another leak

Run `npm run security:check` before pushing. Run `npm run security:history` to check reachable history. These checks report locations only, never matching values. Known key formats, hardcoded provider credentials, private-key headers, and tracked local environment files are rejected; this is not a complete scanner for every provider or obfuscated secret.

Enable the commit guard in each local clone:

```sh
git config core.hooksPath .githooks
```

The hook checks the staged contents rather than unstaged files. A hook can be bypassed, so the GitHub **Secret scan** workflow checks tracked files and reachable history as well. The history check will correctly fail until the approved cleanup is published. In GitHub repository **Settings → Code security**, enable secret scanning/push protection if available; treat every new alert as a key-rotation incident. Never suppress an actual exposed credential to get a passing check.
