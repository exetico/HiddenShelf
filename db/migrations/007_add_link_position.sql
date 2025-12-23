-- Add position/order column to links table
ALTER TABLE links ADD COLUMN display_order INTEGER DEFAULT NULL;

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_links_display_order ON links(display_order);
