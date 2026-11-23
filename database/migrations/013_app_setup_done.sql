-- First-run setup in the app is finished (medicines picked, "All Set" closed).
-- Until then the robot shows "Welcome, <name> · Your Pebble(a) will be ready soon."
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_setup_done_at TIMESTAMPTZ;
