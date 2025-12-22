-- Add icon column to links table
-- Version: 5

-- Add icon column to links
ALTER TABLE links ADD COLUMN icon TEXT DEFAULT NULL;

-- Update schema version
UPDATE _meta SET value = '5' WHERE key = 'schema_version';
