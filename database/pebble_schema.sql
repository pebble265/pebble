-- =====================================================================
-- Pebble(a) v2 — Database Schema (PostgreSQL 15+)
-- Consumer-owned companion robot + app, with opt-in Caretakers
--
-- Conventions
--   * Primary keys are UUID (gen_random_uuid()).
--   * Columns ending in _enc hold data encrypted by the BACKEND
--     (AES-256-GCM) before it reaches the database. The DB never sees
--     plaintext for these fields.
--   * Soft delete via deleted_at where the user may ask to delete data
--     (PDPA right to erasure: a background job hard-deletes later).
--   * All timestamps are TIMESTAMPTZ (stored UTC).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;    -- case-insensitive email

-- ---------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------
CREATE TYPE dose_status       AS ENUM ('pending', 'taken', 'skipped', 'missed');
CREATE TYPE dose_confirm_via  AS ENUM ('app', 'robot_button', 'robot_sensor', 'caretaker');
CREATE TYPE link_status       AS ENUM ('pending', 'accepted', 'declined', 'revoked');
CREATE TYPE alert_type        AS ENUM ('crisis', 'missed_dose', 'low_battery', 'device_offline', 'dispenser_jam');
CREATE TYPE alert_severity    AS ENUM ('info', 'warning', 'critical');
CREATE TYPE device_status     AS ENUM ('unpaired', 'online', 'offline', 'charging', 'error');
CREATE TYPE push_platform     AS ENUM ('ios', 'android', 'robot');

-- =====================================================================
-- 1. USERS & AUTH
-- =====================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,                 -- argon2id
    display_name    VARCHAR(100) NOT NULL,         -- name the robot uses: "Hello <name>"
    locale          VARCHAR(10)  NOT NULL DEFAULT 'th-TH',
    timezone        VARCHAR(50)  NOT NULL DEFAULT 'Asia/Bangkok',
    uses_medication BOOLEAN      NOT NULL DEFAULT FALSE,  -- v2 serves users with and without meds
    onboarded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,              -- store hash only, never raw token
    device_info VARCHAR(200),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform    push_platform NOT NULL,
    token       TEXT NOT NULL UNIQUE,              -- Expo / FCM token
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

-- Emergency contacts shown during a crisis even if no Caretaker exists
CREATE TABLE emergency_contacts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label       VARCHAR(100) NOT NULL,             -- e.g. "สายด่วนสุขภาพจิต"
    phone       VARCHAR(30)  NOT NULL,             -- default seeded: 1323
    sort_order  SMALLINT NOT NULL DEFAULT 0
);

-- =====================================================================
-- 2. ROBOT (DEVICE) & PERSONALISATION
-- =====================================================================
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number   VARCHAR(50) UNIQUE NOT NULL,
    owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    device_secret_hash TEXT NOT NULL,              -- robot authenticates with this
    pairing_code_hash  TEXT,                       -- short-lived code / QR for pairing
    pairing_expires_at TIMESTAMPTZ,
    status          device_status NOT NULL DEFAULT 'unpaired',
    battery_level   SMALLINT CHECK (battery_level BETWEEN 0 AND 100),
    firmware_version VARCHAR(20),
    pill_slots_total SMALLINT NOT NULL DEFAULT 0,  -- 0 = no dispenser fitted
    last_seen_at    TIMESTAMPTZ,
    paired_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_owner ON devices(owner_user_id);

CREATE TABLE robot_settings (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    robot_name      VARCHAR(50)  NOT NULL DEFAULT 'Pebble',
    voice_id        VARCHAR(50)  NOT NULL DEFAULT 'default_th_female',
    speech_rate     NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    greeting_text   VARCHAR(200) NOT NULL DEFAULT 'สวัสดี {name} ยินดีที่ได้รู้จักนะ',
    wake_word       VARCHAR(30)  NOT NULL DEFAULT 'Hey Pebble',
    face_theme      VARCHAR(30)  NOT NULL DEFAULT 'default',
    quiet_hours_start TIME,                        -- robot does not start conversations
    quiet_hours_end   TIME,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3. MEDICATION
-- =====================================================================
CREATE TABLE medications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name_enc        BYTEA NOT NULL,                -- medication name is sensitive health data
    dosage_enc      BYTEA,                         -- e.g. "1 เม็ด 50mg"
    instructions_enc BYTEA,                        -- e.g. "หลังอาหาร ดื่มน้ำตาม"
    dispenser_slot  SMALLINT,                      -- which robot slot holds it (NULL = not in robot)
    pills_remaining INTEGER,                       -- for refill reminders
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_medications_user ON medications(user_id) WHERE deleted_at IS NULL;

CREATE TABLE medication_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id   UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    time_of_day     TIME NOT NULL,                 -- local time in users.timezone
    days_of_week    SMALLINT NOT NULL DEFAULT 127, -- bitmask Mon=1 ... Sun=64, 127 = every day
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    grace_minutes   SMALLINT NOT NULL DEFAULT 60,  -- after this, dose becomes 'missed'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_schedules_med ON medication_schedules(medication_id);

-- One row per scheduled dose occurrence (generated ahead by a job)
CREATE TABLE dose_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES medication_schedules(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- denormalised for fast queries
    scheduled_at    TIMESTAMPTZ NOT NULL,
    status          dose_status NOT NULL DEFAULT 'pending',
    dispensed_at    TIMESTAMPTZ,                   -- robot ejected the pill
    confirmed_at    TIMESTAMPTZ,
    confirmed_via   dose_confirm_via,
    note            VARCHAR(200),
    UNIQUE (schedule_id, scheduled_at)
);
CREATE INDEX idx_dose_events_user_time ON dose_events(user_id, scheduled_at DESC);
CREATE INDEX idx_dose_events_pending   ON dose_events(scheduled_at) WHERE status = 'pending';

-- =====================================================================
-- 4. CARETAKERS (opt-in safety network)
-- =====================================================================
-- A caretaker is any Pebble account (friend, family, doctor) the user invites.
CREATE TABLE caretaker_links (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- person being cared for
    caretaker_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,          -- NULL until invite accepted
    invite_email        CITEXT,
    invite_token_hash   TEXT UNIQUE,
    invite_expires_at   TIMESTAMPTZ,
    relationship_label  VARCHAR(50),               -- "แม่", "เพื่อน", "คุณหมอ"
    status              link_status NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at         TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    CHECK (caretaker_user_id IS NULL OR caretaker_user_id <> user_id)
);
CREATE INDEX idx_caretaker_links_user      ON caretaker_links(user_id);
CREATE INDEX idx_caretaker_links_caretaker ON caretaker_links(caretaker_user_id);

-- What THIS caretaker may see / be alerted about. User controls every flag.
-- Defaults are privacy-first: only crisis alerts are on.
CREATE TABLE caretaker_permissions (
    link_id                 UUID PRIMARY KEY REFERENCES caretaker_links(id) ON DELETE CASCADE,
    alert_on_crisis         BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_missed_dose    BOOLEAN NOT NULL DEFAULT FALSE,
    alert_on_device_offline BOOLEAN NOT NULL DEFAULT FALSE,
    view_adherence          BOOLEAN NOT NULL DEFAULT FALSE,
    view_mood_trend         BOOLEAN NOT NULL DEFAULT FALSE,
    view_conversation_summaries BOOLEAN NOT NULL DEFAULT FALSE,  -- full transcripts are never shared
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5. CONVERSATIONS (summaries only — raw audio/transcripts not stored)
-- =====================================================================
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,  -- NULL = chatted from app
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    turn_count      INTEGER NOT NULL DEFAULT 0,
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_conversations_user ON conversations(user_id, started_at DESC);

CREATE TABLE conversation_summaries (
    conversation_id UUID PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    summary_enc     BYTEA NOT NULL,                -- short AI summary used as long-term memory
    mood_score      SMALLINT CHECK (mood_score BETWEEN 1 AND 5),  -- coarse, for trend chart
    risk_flagged    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Long-term "things Pebble knows about me", editable/deletable by the user
CREATE TABLE companion_memories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_enc BYTEA NOT NULL,                    -- e.g. "ชอบแมว", "สอบปลายภาคเดือนหน้า"
    source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companion_memories_user ON companion_memories(user_id);

-- =====================================================================
-- 6. ALERTS
-- =====================================================================
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    type            alert_type NOT NULL,
    severity        alert_severity NOT NULL,
    related_dose_id UUID REFERENCES dose_events(id) ON DELETE SET NULL,
    related_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);
CREATE INDEX idx_alerts_user_open ON alerts(user_id, created_at DESC) WHERE resolved_at IS NULL;

-- Who was notified about each alert, and whether they saw it
CREATE TABLE alert_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    caretaker_link_id UUID REFERENCES caretaker_links(id) ON DELETE SET NULL,  -- NULL = sent to the user
    channel         VARCHAR(20) NOT NULL,          -- 'push', 'sms', 'email'
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ
);
CREATE INDEX idx_alert_deliveries_alert ON alert_deliveries(alert_id);

-- =====================================================================
-- 7. PDPA: CONSENT & AUDIT
-- =====================================================================
CREATE TABLE consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type    VARCHAR(50) NOT NULL,          -- 'terms', 'health_data', 'conversation_memory', 'caretaker_sharing'
    policy_version  VARCHAR(20) NOT NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX idx_consents_user ON consents(user_id, consent_type);

-- Append-only: who accessed or changed sensitive data
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    action          VARCHAR(50) NOT NULL,          -- 'view_adherence', 'update_medication', 'export_data' ...
    target_user_id  UUID,
    target_type     VARCHAR(50),
    target_id       UUID,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_target ON audit_logs(target_user_id, created_at DESC);

-- =====================================================================
-- updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated          BEFORE UPDATE ON users                 FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_robot_settings_updated BEFORE UPDATE ON robot_settings        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_medications_updated    BEFORE UPDATE ON medications           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ct_perms_updated       BEFORE UPDATE ON caretaker_permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
