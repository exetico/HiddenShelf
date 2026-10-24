-- Persist login sessions so a restart or redeploy doesn't log everyone out
-- Version: 9

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}',
    expires_at INTEGER NOT NULL -- Unix time in milliseconds
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

UPDATE _meta SET value = '9' WHERE key = 'schema_version';
