-- Add redirect_origin to magic_tokens for dev/prod handling
-- Version: 6

-- Add redirect_origin column to allow frontend to specify where to redirect after verification
-- Useful for dev mode (localhost:5173) vs prod mode (domain:port)
ALTER TABLE magic_tokens ADD COLUMN redirect_origin TEXT DEFAULT NULL;

-- Update schema version
UPDATE _meta SET value = '6' WHERE key = 'schema_version';
