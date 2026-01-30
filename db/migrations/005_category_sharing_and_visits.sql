-- Category sharing and link visit logging
-- Version: 5

-- Category shares table for sharing categories with other users
CREATE TABLE IF NOT EXISTS category_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    share_code TEXT UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_category_shares_code ON category_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_category_shares_category ON category_shares(category_id);

-- Category share members (users who have accepted a share)
CREATE TABLE IF NOT EXISTS category_share_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(category_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_category_share_members_user ON category_share_members(user_id);
CREATE INDEX IF NOT EXISTS idx_category_share_members_category ON category_share_members(category_id);

-- Link visits table for logging link access
CREATE TABLE IF NOT EXISTS link_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_masked TEXT,
    user_agent TEXT,
    browser TEXT,
    os TEXT,
    referer TEXT,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_link_visits_link ON link_visits(link_id);
CREATE INDEX IF NOT EXISTS idx_link_visits_date ON link_visits(visited_at DESC);

-- Update schema version
UPDATE _meta SET value = '5' WHERE key = 'schema_version';
