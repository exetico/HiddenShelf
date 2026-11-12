-- Read later: a mark you set on a link and take off when you've read it.
-- Opens: how often you opened a link from the app and when you last did,
-- for Shelf stats ("links you never open"). Counted from this version on.
-- Version: 17

ALTER TABLE links ADD COLUMN read_later INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN last_opened_at DATETIME DEFAULT NULL;

UPDATE _meta SET value = '17' WHERE key = 'schema_version';
