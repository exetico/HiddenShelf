-- Add brand color preference to user settings
ALTER TABLE user_settings ADD COLUMN brand_color TEXT DEFAULT '#687061';
