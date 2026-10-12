# Practical AI quota recovery

The reported failure on **Confirm & send** was `USAGE_UNAVAILABLE`, before any partner response or coaching was generated. A live request before this change succeeded, so the original production network error cannot be identified from that request alone. Local fault injection reproduced two concrete defects in the existing database code:

- Any failed general cache/history connection set the shared `ready` flag to false for 30 seconds. The otherwise independent AI quota pool checked that flag and rejected speaking requests without contacting its own connection.
- A stale AI pool connection produced an immediate failure and also disabled the general database. There was no bounded reconnect attempt.

## Recovery rules

Successful table initialization is retained separately from general pool health. Speaking quota still requires the real configured database and initialized tables; it uses its own pool even if a separate cache connection fails. A turn arriving during startup waits for the same ongoing initialization within the quota deadline.

Each speaking reservation keeps the existing shared/day and device/day counters in one transaction. One reconnect/retry is permitted for known transient connection/lock errors only before `COMMIT` and only if no transaction began or rollback was acknowledged. Both attempts share the existing 3.5-second deadline. Failed connections are destroyed rather than returned for reuse.

An unknown `COMMIT` result, failed rollback, missing configuration, invalid credentials or persistent outage does not permit another automatic debit or any unmetered provider request. A late connection after the deadline is released, and no commit is started after expiry. Genuine outages still return a brief retry message while preserving the draft.

`/healthz` adds `database.aiQuota`: current speaking quota success/failure, the count of safe reconnect attempts, and a sanitized error code. It includes no connection strings, SQL parameters, API keys, transcripts or device identifiers. General `database.connected` continues to describe the general pool and can be false while the independent quota connection works.

No API key, quota limit, SQL migration, dependency, speech recognition setting, voice selection or saved learning key changes.

## Verification

Eight new regression tests cover independent cache failure, startup initialization, the overall deadline, stale acquisition/begin/statement recovery, uncertain commit/rollback, permanent/missing database failure, one grounded partner response after reconnect, idempotent response reuse, and no provider call when quota cannot be confirmed. Existing concurrency/restart tests continue to preserve shared and per-device budgets.

The full suite passes **390 tests**, with **3 real MySQL integration tests skipped** because this workspace has no local credentials. Browser QA runs the actual server in production mode with deterministic SQL/provider fault fixtures; physical device networking and actual TiDB interruptions are not simulated by a real database. Deployment verification uses real Render/TiDB and a small conversational request, without generating ElevenLabs audio.
