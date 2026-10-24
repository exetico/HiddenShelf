-- Add direct redirect support
-- Version: 4

-- Add direct_redirect column to links
-- 0 = show preview page (default), 1 = redirect directly
ALTER TABLE links ADD COLUMN direct_redirect INTEGER DEFAULT 0;

-- Add direct_redirect_default column to categories
-- When set, new links in this category will inherit this value
ALTER TABLE categories ADD COLUMN direct_redirect_default INTEGER DEFAULT 0;

-- Update schema version
UPDATE _meta SET value = '4' WHERE key = 'schema_version';
