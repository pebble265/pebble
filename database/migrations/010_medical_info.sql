-- Pebble(a): Profile → ข้อมูลทางการแพทย์ (allergies, conditions, regular doctor).
-- One encrypted JSON blob per user; emergency contacts already have their own table.
ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_enc BYTEA;
