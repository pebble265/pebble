-- Pebble(a): phone number on the "Personal Information" screen.
-- Safe to run more than once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
