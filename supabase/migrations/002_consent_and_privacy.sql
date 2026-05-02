-- =============================================================================
-- Migration 002 — Consent and Privacy
-- Project:  Idris Learning App
-- Author:   Farhod Elbekov
-- Created:  2026-05-02
--
-- Tables:
--   parental_consent        — COPPA-compliant consent records
--   data_deletion_requests  — right-to-erasure requests
--   audit_log               — immutable record of all data changes
--
-- COPPA (Children's Online Privacy Protection Act) requires:
--   - Verifiable parental consent before collecting data from children < 13
--   - Record of what was consented to, when, and by whom
--   - Ability to delete all data on request
--   - Audit trail of access and changes
--
-- RLS: disabled per FP-001. Same rationale as migration 001.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------

CREATE TYPE consent_type_enum AS ENUM (
  'data_collection',       -- logging session data (scores, duration, mood)
  'voice_recording',       -- recording family voice for cloning (ElevenLabs)
  'ai_content_generation', -- sending child profile to Claude API
  'doctor_data_sharing',   -- sharing progress reports with doctor
  'analytics'              -- aggregate/anonymous usage analytics
);

CREATE TYPE consent_status_enum AS ENUM (
  'granted',
  'withdrawn',
  'expired'
);

CREATE TYPE deletion_status_enum AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'rejected'           -- rejected only if request itself is invalid/duplicate
);

CREATE TYPE audit_action_enum AS ENUM (
  'INSERT',
  'UPDATE',
  'DELETE',
  'SELECT',            -- for sensitive reads (e.g. doctor viewing child data)
  'EXPORT',            -- PDF report generated
  'CONSENT_GRANTED',
  'CONSENT_WITHDRAWN',
  'DELETION_REQUESTED',
  'DELETION_COMPLETED'
);


-- ---------------------------------------------------------------------------
-- TABLE: parental_consent
--
-- One row per consent type per guardian.
-- COPPA requires separate consent for each category of data use.
--
-- Privacy policy versioning: if the policy changes, existing consents
-- are grandfathered but a new consent request is shown on next login.
-- Guardian must re-consent for the new version.
--
-- voice_family_member is only populated for voice_recording consents:
--   Which family member's voice was consented for cloning.
-- ---------------------------------------------------------------------------

CREATE TABLE parental_consent (
  id                   UUID              DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Guardian identity (no auth system — stored as entered during onboarding)
  guardian_name        TEXT              NOT NULL CHECK (length(guardian_name) > 0),
  guardian_relation    TEXT              NOT NULL, -- "mama", "papa", "deda", "babushka"

  -- Child identity
  child_name           TEXT              NOT NULL DEFAULT 'Idriszhon',
  child_age_at_consent INTEGER           NOT NULL CHECK (child_age_at_consent BETWEEN 1 AND 17),

  -- Consent details
  consent_type         consent_type_enum NOT NULL,
  status               consent_status_enum NOT NULL DEFAULT 'granted',

  -- Legal record
  privacy_policy_version TEXT            NOT NULL, -- e.g. "1.0", "1.1"
  consent_text_snapshot  TEXT            NOT NULL, -- exact text shown to guardian at time of consent
  ip_address           INET,                       -- IP at time of consent (for legal record)
  user_agent           TEXT,                       -- device/browser at time of consent

  -- For voice_recording consent only
  voice_family_member  TEXT,                       -- which family member's voice was consented

  -- Timestamps
  granted_at           TIMESTAMPTZ       NOT NULL DEFAULT now(),
  withdrawn_at         TIMESTAMPTZ,                -- set when status → withdrawn
  expires_at           TIMESTAMPTZ,                -- null = no expiry; set for time-limited consents

  CONSTRAINT uq_consent_guardian_type UNIQUE (guardian_name, child_name, consent_type, privacy_policy_version)
);

COMMENT ON TABLE  parental_consent                    IS 'COPPA-compliant parental consent records. One row per consent type per guardian per policy version.';
COMMENT ON COLUMN parental_consent.consent_text_snapshot IS 'Exact consent text shown to guardian. Preserved even if privacy policy changes later.';
COMMENT ON COLUMN parental_consent.ip_address         IS 'IP at time of consent. Required for COPPA verifiable parental consent records.';
COMMENT ON COLUMN parental_consent.voice_family_member IS 'For voice_recording type only. Identifies whose voice was consented for AI cloning.';


-- ---------------------------------------------------------------------------
-- TABLE: data_deletion_requests
--
-- Right to erasure (GDPR Art. 17 / COPPA).
-- Parent or guardian can request all data for the child to be deleted.
--
-- On completion, the deletion job must:
--   1. Delete all sessions rows for the child
--   2. Delete all skill_snapshots
--   3. Delete voice clone from ElevenLabs (via API)
--   4. Delete all parental_consent rows
--   5. Mark this row as completed (do NOT delete this row — it is the audit record)
--   6. Insert a DELETION_COMPLETED row into audit_log
--
-- tables_deleted JSONB shape:
--   { "sessions": 42, "skill_snapshots": 8, "voice_clones_removed": 1 }
-- ---------------------------------------------------------------------------

CREATE TABLE data_deletion_requests (
  id                UUID              DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Requester
  requester_name    TEXT              NOT NULL CHECK (length(requester_name) > 0),
  requester_email   TEXT,
  requester_relation TEXT             NOT NULL, -- "mama", "papa", etc.

  -- Child
  child_name        TEXT              NOT NULL DEFAULT 'Idriszhon',

  -- Request details
  reason            TEXT,                        -- optional: why they want deletion
  status            deletion_status_enum NOT NULL DEFAULT 'pending',

  -- Processing record
  tables_deleted    JSONB             NOT NULL DEFAULT '{}'::jsonb,
  completed_by      TEXT,                        -- who processed it (admin email)
  rejection_reason  TEXT,

  -- Timestamps (GDPR requires completion within 30 days)
  requested_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  due_by            TIMESTAMPTZ       NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  completed_at      TIMESTAMPTZ
);

COMMENT ON TABLE  data_deletion_requests           IS 'Right-to-erasure requests. GDPR/COPPA compliance. Must be completed within 30 days (see due_by).';
COMMENT ON COLUMN data_deletion_requests.tables_deleted IS 'JSON record of rows deleted per table. Populated on completion.';
COMMENT ON COLUMN data_deletion_requests.due_by    IS 'Auto-set to 30 days from request. Overdue rows should trigger admin alert.';


-- ---------------------------------------------------------------------------
-- TABLE: audit_log
--
-- Immutable append-only log of all sensitive actions.
-- NEVER UPDATE or DELETE rows from this table.
--
-- Covers:
--   - Doctor viewing progress data
--   - PDF reports being generated
--   - Consent granted or withdrawn
--   - Deletion requests and completions
--   - Any direct DB mutations to sensitive tables
--
-- old_values / new_values: JSONB snapshot of the row before/after change.
--   INSERT: old_values = null, new_values = full new row
--   UPDATE: old_values = before, new_values = after
--   DELETE: old_values = deleted row, new_values = null
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id            BIGSERIAL         PRIMARY KEY,   -- bigserial for high-volume append

  -- What happened
  action        audit_action_enum NOT NULL,
  table_name    TEXT,                             -- which table was affected
  record_id     UUID,                             -- PK of the affected row

  -- Who did it
  performed_by  TEXT              NOT NULL,       -- "doctor", "app", "weekly-cron", "admin"
  ip_address    INET,

  -- Data snapshot
  old_values    JSONB,
  new_values    JSONB,

  -- Supplementary context
  context       TEXT,                             -- e.g. "doctor_portal", "edge_function:tts"
  session_week  TEXT,                             -- ISO week if action relates to a weekly report

  created_at    TIMESTAMPTZ       NOT NULL DEFAULT now()
);

COMMENT ON TABLE  audit_log             IS 'Immutable audit trail. NEVER UPDATE or DELETE rows. Append only.';
COMMENT ON COLUMN audit_log.performed_by IS 'Free text actor identifier: "doctor", "app", "weekly-cron", "admin".';
COMMENT ON COLUMN audit_log.old_values  IS 'Full row snapshot before change (UPDATE/DELETE). NULL for INSERT.';
COMMENT ON COLUMN audit_log.new_values  IS 'Full row snapshot after change (INSERT/UPDATE). NULL for DELETE.';


-- ---------------------------------------------------------------------------
-- DISABLE RLS (FP-001)
-- ---------------------------------------------------------------------------

ALTER TABLE parental_consent       DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE parental_consent       TO service_role;
GRANT ALL ON TABLE data_deletion_requests TO service_role;
GRANT ALL ON TABLE audit_log              TO service_role;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO service_role;

-- anon role gets read-only on consent (for app to verify consent exists before data collection)
GRANT SELECT ON TABLE parental_consent TO anon;
-- anon CANNOT read audit_log or deletion_requests
REVOKE ALL ON TABLE audit_log              FROM anon;
REVOKE ALL ON TABLE data_deletion_requests FROM anon;


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- parental_consent: app checks active consent before every session start
CREATE INDEX idx_consent_guardian     ON parental_consent (guardian_name, status);
CREATE INDEX idx_consent_type_status  ON parental_consent (consent_type, status);

-- data_deletion_requests: admin dashboard filters by status and due date
CREATE INDEX idx_deletion_status      ON data_deletion_requests (status);
CREATE INDEX idx_deletion_due         ON data_deletion_requests (due_by) WHERE status = 'pending';

-- audit_log: compliance queries filter by action and date range
CREATE INDEX idx_audit_action         ON audit_log (action, created_at DESC);
CREATE INDEX idx_audit_table          ON audit_log (table_name, created_at DESC);
CREATE INDEX idx_audit_record         ON audit_log (record_id) WHERE record_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Prevent UPDATE/DELETE on audit_log (enforce append-only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. UPDATE and DELETE are not permitted.';
END;
$$;

CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();


-- ---------------------------------------------------------------------------
-- Helper view: overdue deletion requests
-- Useful for admin monitoring — flag requests past the 30-day GDPR deadline.
-- ---------------------------------------------------------------------------

CREATE VIEW overdue_deletion_requests AS
  SELECT
    id,
    requester_name,
    child_name,
    requested_at,
    due_by,
    (now() - due_by) AS overdue_by
  FROM data_deletion_requests
  WHERE status IN ('pending', 'in_progress')
    AND due_by < now();

COMMENT ON VIEW overdue_deletion_requests IS 'Deletion requests past their 30-day GDPR/COPPA deadline. Check weekly.';
