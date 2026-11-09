-- Who may join when sign-up isn't open to everyone (SIGNUP_MODE).
-- One row per email: a request someone sent ('pending'), an email an admin
-- let in ahead of time or approved ('approved'), or a request an admin
-- turned down ('denied'). The row is removed once the account exists.
-- Version: 15

CREATE TABLE IF NOT EXISTS access_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- stored lower-case
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
    note TEXT,                                  -- the requester's own words, shown as text only
    created_at INTEGER NOT NULL,                -- Unix seconds
    decided_at INTEGER,
    decided_by TEXT                             -- the admin's email
);

CREATE INDEX IF NOT EXISTS idx_access_list_status ON access_list(status);

UPDATE _meta SET value = '15' WHERE key = 'schema_version';
