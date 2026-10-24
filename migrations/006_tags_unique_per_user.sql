-- Make tag names unique per user instead of globally
-- Version: 6
--
-- SQLite can't drop a UNIQUE constraint, so the table is rebuilt.
-- Foreign keys are switched off while tags is dropped, otherwise the
-- ON DELETE CASCADE on link_tags would wipe every tag assignment.

PRAGMA foreign_keys = OFF;

-- Left over if a previous attempt failed part way
DROP TABLE IF EXISTS tags_new;

CREATE TABLE tags_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

INSERT INTO tags_new (id, name, user_id, created_at)
SELECT id, name, user_id, created_at FROM tags;

DROP TABLE tags;
ALTER TABLE tags_new RENAME TO tags;

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

PRAGMA foreign_keys = ON;

-- Update schema version
UPDATE _meta SET value = '6' WHERE key = 'schema_version';
