-- Pebble(a): quick emotional check-ins (the emoji row on the Home screen).
-- Safe to run more than once.
CREATE TABLE IF NOT EXISTS mood_checkins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 7),  -- 1 = very low ... 7 = great
    source      VARCHAR(20) NOT NULL DEFAULT 'app',              -- app | robot
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mood_checkins_user_time
    ON mood_checkins (user_id, created_at DESC);
