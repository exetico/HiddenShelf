-- Per-user category ordering and favorites
-- Version: 10

ALTER TABLE categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

-- Keep the order users see today (newest first) as the starting order
UPDATE categories SET position = (
    SELECT COUNT(*) FROM categories c2
    WHERE c2.user_id = categories.user_id
      AND (c2.created_at > categories.created_at
           OR (c2.created_at = categories.created_at AND c2.id > categories.id))
);

CREATE INDEX IF NOT EXISTS idx_categories_user_position ON categories(user_id, position);

UPDATE _meta SET value = '10' WHERE key = 'schema_version';
