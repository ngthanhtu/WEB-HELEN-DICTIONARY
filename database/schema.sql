-- MySQL 8+ / TiDB. Additive and repeatable; no DROP or TRUNCATE.
CREATE TABLE IF NOT EXISTS helen_devices (
  device_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (device_hash)
);
CREATE TABLE IF NOT EXISTS helen_cache (
  namespace VARCHAR(32) CHARACTER SET ascii NOT NULL,
  cache_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload JSON NOT NULL,
  refreshed_at DATETIME(3) NOT NULL,
  fresh_until DATETIME(3) NOT NULL,
  PRIMARY KEY (namespace, cache_key)
);
CREATE TABLE IF NOT EXISTS helen_vocabulary (
  word VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  payload JSON NOT NULL,
  revision INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (word)
);
CREATE TABLE IF NOT EXISTS helen_history (
  device_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  word VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  last_seen DATETIME(3) NOT NULL,
  search_count BIGINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (device_hash, word),
  INDEX recent_history (device_hash, last_seen)
);
CREATE TABLE IF NOT EXISTS helen_history_events (
  device_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (device_hash, event_id)
);
-- Shared budgets survive restarts and are reserved atomically before provider calls.
CREATE TABLE IF NOT EXISTS helen_usage_budget (
  bucket VARCHAR(24) CHARACTER SET ascii NOT NULL,
  key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  units BIGINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (bucket,key_hash),
  INDEX expired_budget (expires_at)
);
CREATE TABLE IF NOT EXISTS helen_metrics_daily (
  event_day DATE NOT NULL,
  event_name VARCHAR(24) CHARACTER SET ascii NOT NULL,
  event_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (event_day,event_name)
);
CREATE TABLE IF NOT EXISTS helen_metric_events (
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (event_id),
  INDEX expired_metric (created_at)
);
