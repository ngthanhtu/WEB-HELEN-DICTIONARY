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
