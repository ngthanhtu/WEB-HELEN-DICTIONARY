-- Read-only examples for TiDB SQL Editor or a SQL client.
-- Select the correct database in the client first; no credentials or USE name hardcoded.
-- Run statements separately to see each result. No INSERT/UPDATE/DELETE/DDL here.

SHOW TABLES;

-- Row counts are records, not users, mastery levels or search frequency.
SELECT 'dictionary_entries' AS record_type, COUNT(*) AS row_count FROM helen_vocabulary
UNION ALL SELECT 'shared_cache_items', COUNT(*) FROM helen_cache
UNION ALL SELECT 'device_word_history', COUNT(*) FROM helen_history;

-- Which reusable cache namespaces actually have stored results?
SELECT namespace, COUNT(*) AS cached_items, MAX(refreshed_at) AS latest_write_utc
FROM helen_cache GROUP BY namespace ORDER BY namespace;

-- Latest persisted vocabulary; this is NOT the per-device history.
SELECT word, revision, updated_at AS updated_at_utc
FROM helen_vocabulary ORDER BY updated_at DESC LIMIT 20;

-- Administrator view across devices; the app filters by the device cookie hash.
SELECT word, last_seen AS last_seen_utc,
       CONVERT_TZ(last_seen, '+00:00', '+07:00') AS last_seen_vietnam,
       search_count
FROM helen_history ORDER BY last_seen DESC LIMIT 20;

-- Units depend on bucket (characters, attempts or completed reports).
-- Do not sum different buckets as one total: global/device/network overlap.
SELECT bucket, COUNT(*) AS ledger_keys, SUM(units) AS bucket_units,
       MIN(expires_at) AS next_reset_utc
FROM helen_usage_budget WHERE expires_at > UTC_TIMESTAMP(3)
GROUP BY bucket ORDER BY bucket;

-- Only opt-in counts, no names/emails. Aggregate data is pruned after 90 days.
SELECT event_day, event_name, event_count
FROM helen_metrics_daily ORDER BY event_day DESC, event_name LIMIT 30;
