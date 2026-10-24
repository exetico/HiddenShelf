-- Add updated_at column to categories table
-- Version: 7

-- SQLite doesn't support CURRENT_TIMESTAMP as default in ALTER TABLE
-- Add column first, then update existing rows
ALTER TABLE categories ADD COLUMN updated_at DATETIME;

-- Set initial value for existing categories
UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
