-- Pebble(a): alarm sound chosen on the "Set dosage times" screen (Sound row).
-- Safe to run more than once.
ALTER TABLE medications ADD COLUMN IF NOT EXISTS alarm_sound VARCHAR(32) NOT NULL DEFAULT 'radial';
