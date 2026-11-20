-- Pebble(a): profile photo. A small JPEG data URL, encrypted like the other personal fields.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_enc BYTEA;
