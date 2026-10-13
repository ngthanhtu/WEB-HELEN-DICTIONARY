# Helen security review — 13 October 2026

Scope: Node/Express, the PWA, TiDB/MySQL, anonymous history, provider budgets and reachable Git history. Helen currently has no signup, email/profile, VIP/admin roles or payments. Supabase is not used. This review does not certify every possible attack or external account configuration.

## Findings and changes

| Boundary | Evidence and action |
| --- | --- |
| Device-only provider allowance | Reproduced locally: changing the browser's device header resets its device allowance. Existing durable global budgets still stop total spending. Added a separate durable backend network allowance, derived from the trusted Express proxy IP, alongside device and global checks. Rotating IDs/voices now reaches 429 before another provider call. |
| Anonymous sessions / unwanted fields | Previously ignored `role`, `vip` and `profile` fields could not create actual roles, but were accepted. Session creation now rejects unknown fields. History rejects owner/role fields rather than accepting client ownership claims. |
| History isolation | Disposable production-mode API tests create two owners, write/read/clear separately and try forged query/header/body identities. Only the host-only HttpOnly Secure SameSite=Strict cookie authorizes history; owner hashes constrain SQL. No private profile endpoint exists. |
| Database account privileges | Added `DATABASE_AUTO_MIGRATE=false` to check existing tables without schema creation. Explicit migrations retain a separate provisioning path. Live TiDB grants/firewall cannot be inspected with local credentials; complete the configuration below to apply least privilege. |
| Sensitive code / supply chain | Current/index and reachable-history secret checks, production dependency audit and safe error tests. Scanner now covers the optional abuse hashing secret. Real credential values are never printed in scanner findings. |

Network keys use a domain-separated HMAC, with an optional `ABUSE_LIMIT_SECRET` or the existing server provider credential. The database stores day-scoped hashes, not raw IPs. IPv6 /56 grouping limits address rotation inside one network. Network identity comes from Express's resolved IP with one trusted hosting proxy, not a body field or the first untrusted forwarded header. Shared networks also share a cap; limits are configurable. Rotating IPs or distributed bots remain possible; this is not a replacement for authenticated accounts or future bot challenges.

Practical defaults: 100 replies/device/day and 300/network/day, 150 transcription attempts/device/day and 450/network/day, 10 reports/device/day and 30/network/day. All still consume the existing shared 600-generation allowance. Network constraints are reserved atomically in TiDB with the original constraints. TTS checks device/network/day/month with one SQL UPDATE, preserving the fast path and old counters. Cached results avoid provider debit. History has durable device/network/global write limits; its local outbox retains rejected events for retry.

## TiDB configuration steps

1. In TiDB SQL Editor, connect as the current provisioning administrator. The nine tables in `database/schema.sql` must exist first. Run `SELECT CURRENT_USER(), DATABASE();` and `SHOW GRANTS FOR CURRENT_USER;` to inspect this connection.
2. Open `database/runtime-user.example.sql`, replace its password placeholder privately, and run the CREATE USER, schema-scoped GRANT and SHOW GRANTS statements. The new user must have only SELECT, INSERT, UPDATE, DELETE on `helen_dictionary.*`, without ALL, global `*.*`, CREATE, ALTER, DROP or GRANT OPTION. If the user exists already, inspect/fix its grants instead of bypassing the error.
3. In TiDB Connect, obtain the exact new username (include a cluster prefix when shown). In Render Environment replace `MYSQL_USER` and `MYSQL_PASSWORD`, keep the existing host/database/port, keep `MYSQL_SSL=true`, and add `DATABASE_AUTO_MIGRATE=false`. Save and deploy. Never post the password in chat or Git.
4. Confirm `/healthz` reports connected storage; try a new lookup, own history sync and Practical AI. Missing tables/permissions fail safely rather than letting paid generation bypass quotas. Future table creation runs with separate administrator credentials.
5. In TiDB Public Endpoint networking, allow only the current Render service's outbound ranges and your current IP if SQL desktop access is needed. Avoid access from everywhere. No changes to live firewall/grants were made by this code review.

MySQL does not provide the Supabase RLS configuration referenced in the request. Helen's row ownership is enforced by backend cookie authorization and bound device-hash queries; the database role/firewall/TLS are an additional boundary. Because the runtime role can read application tables, correctly scoped backend queries remain essential.

## Validation and limits

The executable ownership suite covers cross-owner access, mass assignment, device rotation for paid speaking/TTS and cookie rotation for history writes, using fake providers and isolated storage. Additional tests cover trusted network identity, IPv6, restart/day boundaries, atomic SQL parameter mapping and restricted startup. Existing regressions cover CSRF, XSS/CSP, SQL injection, traversal, secret leakage, parser/upload abuse, forged audio receipts and provider failures. CI runs locked installation, production dependency audit, secret/history scan and tests on push/PR.

Security researchers and automated tools commonly enumerate routes, inspect public bundles/history, alter identifiers/roles, inject malformed inputs and repeat bounded requests. These exact categories are exercised locally; no malicious high-volume traffic or paid-provider saturation is sent to production. Signup spam/CAPTCHA and VIP/admin authorization must be implemented and tested when those features actually exist.

Anonymous cookies remain bearer capabilities, not accounts: access to a stolen capability grants its history. Existing legacy migration remains for saved data. This audit cannot establish key revocation, external grants, provider commercial licenses, physical-device behavior, unknown advisories or distributed DoS resistance. Production check artifacts and exact test totals are recorded separately after deployment.

Local complete suite: **411 passed, 3 real MySQL checks skipped** because test credentials are absent. Production dependency audit: zero known advisories. Five disposable production API ownership/abuse scenarios pass.

Live deployment verification on `24a987e`: all 24 cookie/CSP/CSRF/private-file checks passed. Two new disposable owners independently wrote/read/cleared brotherhood and youth; forged query/header identities did not reveal the other owner. POST session role/admin/VIP fields returned 400 without setting a cookie. These probes used only fresh audit-owned sessions; no existing user data was changed. Subsequent recording builds retain this guard.

History reads and writes additionally share a 60/minute/IP request ceiling, so rotating unknown history cookies cannot generate unbounded database reads from one network. Local production fixtures verify the ceiling and zero provider calls. This process-level ceiling resets on restart; durable write and generation budgets remain independent in TiDB. Final combined suite: 424 passed, three real MySQL integration checks skipped.
