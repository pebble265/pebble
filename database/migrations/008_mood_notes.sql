-- Pebble(a): a short note with a mood check-in (Journal "Recent check-ins").
-- Encrypted by the API like medication names. Safe to run more than once.
ALTER TABLE mood_checkins ADD COLUMN IF NOT EXISTS note_enc BYTEA;
