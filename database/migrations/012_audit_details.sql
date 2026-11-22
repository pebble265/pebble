-- Pebble(a): audit log of everything users / robots change (login, add / delete medicine, ...),
-- shown on the admin site. Values are never stored, only which fields changed.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS detail       TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS success      BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status_code  SMALLINT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS route        VARCHAR(120);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS client       VARCHAR(20);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS duration_ms  INTEGER;
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);
