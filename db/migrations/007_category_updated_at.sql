-- Add updated_at column to categories table
-- Version: 7

ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
