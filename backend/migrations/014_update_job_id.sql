-- In-app updates: the updater's own id for the run that handled a request.
-- Requests are plain flags now, so results are matched to rows by this.
-- Version: 14

ALTER TABLE update_requests ADD COLUMN job_id TEXT;

UPDATE _meta SET value = '14' WHERE key = 'schema_version';
