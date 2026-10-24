-- Make tag names unique per user instead of globally
-- Version: 8
--
-- 003 declared tags.name UNIQUE across all users, so a second user could
-- not create a tag that someone else already had. SQLite can't drop a
-- UNIQUE constraint, so the table is rebuilt. Foreign keys are off while
-- the old table is dropped, otherwise ON DELETE CASCADE on link_tags
-- would remove every tag assignment.

PRAGMA foreign_keys = OFF;

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

UPDATE _meta SET value = '8' WHERE key = 'schema_version';
