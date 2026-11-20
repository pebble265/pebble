-- Pebble(a): profile from the "Create Account" screen + first-run robot setup.
-- Safe to run more than once.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pronunciation  VARCHAR(100);   -- how the robot should say the name
ALTER TABLE users ADD COLUMN IF NOT EXISTS sex            VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year     SMALLINT;       -- from the age the user typed
ALTER TABLE users ADD COLUMN IF NOT EXISTS robot_setup_at TIMESTAMPTZ;    -- finished (or skipped) "connect your pebble(a)"

DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_sex_check CHECK (sex IN ('male', 'female', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_birth_year_check CHECK (birth_year BETWEEN 1900 AND 2100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Accounts that already own a robot don't need the setup screens again.
UPDATE users u SET robot_setup_at = now()
WHERE robot_setup_at IS NULL AND EXISTS (SELECT 1 FROM devices d WHERE d.owner_user_id = u.id);
