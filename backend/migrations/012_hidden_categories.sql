-- Hidden categories: their links stay out of lists, search, favorites and
-- "feeling lucky" until you pick the category
-- Version: 12

ALTER TABLE categories ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;

UPDATE _meta SET value = '12' WHERE key = 'schema_version';
