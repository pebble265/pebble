-- Pebble(a): "Sign in with Apple" / "Sign in with Google".
-- One row per external account linked to a Pebble user. Safe to run more than once.
CREATE TABLE IF NOT EXISTS auth_identities (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider       VARCHAR(20) NOT NULL CHECK (provider IN ('apple', 'google')),
    subject        VARCHAR(255) NOT NULL,          -- the provider's stable user id ("sub")
    email          CITEXT,                         -- as the provider reported it (may be an Apple relay address)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ,
    UNIQUE (provider, subject)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities (user_id);
