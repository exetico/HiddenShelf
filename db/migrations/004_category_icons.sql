-- Add icon and color to categories
-- Version: 4

-- Add icon and color columns to categories
ALTER TABLE categories ADD COLUMN icon TEXT;
ALTER TABLE categories ADD COLUMN color TEXT;

-- Update schema version
UPDATE _meta SET value = '4' WHERE key = 'schema_version';
