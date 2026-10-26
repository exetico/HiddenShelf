-- Favorite links, and a trash for deleted links
-- Version: 11

ALTER TABLE links ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
-- Set when a link is moved to the trash; NULL for links on the shelf
ALTER TABLE links ADD COLUMN deleted_at DATETIME DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_links_user_deleted ON links(user_id, deleted_at);

UPDATE _meta SET value = '11' WHERE key = 'schema_version';
