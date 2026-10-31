-- In-app updates: every Update or Roll back an admin asks for, and how it went.
-- The host updater reads a row by its id (read only) to learn what to do.
-- Version: 13

CREATE TABLE IF NOT EXISTS update_requests (
    id TEXT PRIMARY KEY,                  -- 32 hex characters, also the request file's content
    action TEXT NOT NULL CHECK (action IN ('update', 'rollback')),
    target_commit TEXT,                   -- the commit the admin saw and confirmed (update only)
    user_id INTEGER,
    email TEXT NOT NULL,
    ip TEXT,
    created_at INTEGER NOT NULL,          -- Unix seconds
    result TEXT,                          -- succeeded, failed, rolled_back; NULL while waiting
    message TEXT,
    finished_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_update_requests_created_at ON update_requests(created_at);

UPDATE _meta SET value = '13' WHERE key = 'schema_version';
