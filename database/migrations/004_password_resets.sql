-- Pebble(a): "Forget Password" — a 5-digit code sent by email, then a short-lived
-- reset token once the code is confirmed. Only hashes are stored. Safe to run more than once.
CREATE TABLE IF NOT EXISTS password_resets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash         VARCHAR(64) NOT NULL,
    attempts          SMALLINT NOT NULL DEFAULT 0,
    expires_at        TIMESTAMPTZ NOT NULL,          -- the emailed code stops working after this
    reset_token_hash  VARCHAR(64) UNIQUE,            -- set once the code is confirmed
    reset_expires_at  TIMESTAMPTZ,
    used_at           TIMESTAMPTZ,                   -- password changed, or replaced by a newer code
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id, created_at DESC);
