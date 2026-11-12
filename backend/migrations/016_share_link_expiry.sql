-- Share links that end: every category share link stops working after
-- 7 days, and the owner picks whether it works for one person (it is
-- replaced as soon as someone joins) or for anyone during those 7 days.
-- Version: 16

ALTER TABLE category_shares ADD COLUMN single_use INTEGER NOT NULL DEFAULT 1;

-- Links made before this had no end date; give them the same 7 days
UPDATE category_shares SET expires_at = datetime('now', '+7 days') WHERE expires_at IS NULL;

UPDATE _meta SET value = '16' WHERE key = 'schema_version';
