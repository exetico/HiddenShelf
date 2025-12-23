-- Add OAuth authentication fields to users table
ALTER TABLE users ADD COLUMN oauth_provider TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN oauth_id TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN oauth_email TEXT DEFAULT NULL;

-- Create index for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
