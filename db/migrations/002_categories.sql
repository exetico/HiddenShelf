-- Add collections support
-- Version: 2

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    icon TEXT,
    color TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Add category_id to links
ALTER TABLE links ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_links_category_id ON links(category_id);

-- Update schema version
UPDATE _meta SET value = '2' WHERE key = 'schema_version';
