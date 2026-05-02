-- =============================================================================
-- Migration 001 — Initial Schema
-- Project:  Idris Learning App
-- Author:   Farhod Elbekov
-- Created:  2026-05-02
--
-- Tables:
--   sessions          — every play session logged here
--   task_proposals    — AI-generated tasks awaiting doctor approval
--   doctor_instructions — free-text instructions added by doctor
--   skill_snapshots   — weekly rollup of skill scores per area
--
-- RLS: disabled on all tables per FP-001 (FIX_PATTERNS.md).
--   RLS silently returns empty rows with no error when policies are absent.
--   All access is through service_role via Supabase Edge Functions.
--
-- FP-004 note: all boolean columns have explicit DEFAULT false so that
--   .eq('col', false) filters never miss NULL rows.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- Using ENUMs over TEXT constraints to catch bad inserts at the DB layer.
-- ---------------------------------------------------------------------------

CREATE TYPE skill_area_enum AS ENUM (
  'counting',
  'vocabulary',
  'alphabet',
  'shapes',
  'colors',
  'speech',
  'social',
  'family_interaction',
  'motor'
);

CREATE TYPE mood_enum AS ENUM (
  'happy',
  'calm',
  'excited',
  'frustrated',
  'tired',
  'unknown'
);

CREATE TYPE game_type_enum AS ENUM (
  'counting',
  'picture_match',
  'speak_repeat',
  'family_challenge',
  'color_match',
  'animal_sounds',
  'letter_recognition'
);

CREATE TYPE family_member_enum AS ENUM (
  'mama',
  'papa',
  'deda',
  'babushka',
  'siblings',
  'other'
);

CREATE TYPE lang_enum AS ENUM (
  'en',
  'ru',
  'uz',
  'tg'
);

CREATE TYPE proposal_status_enum AS ENUM (
  'pending',
  'approved',
  'rejected',
  'modified'
);

CREATE TYPE difficulty_enum AS ENUM (
  'easier',
  'same',
  'harder'
);

CREATE TYPE priority_enum AS ENUM (
  'normal',
  'high',
  'critical'
);

CREATE TYPE trend_enum AS ENUM (
  'improving',
  'stable',
  'declining'
);


-- ---------------------------------------------------------------------------
-- TABLE: sessions
--
-- Every play session is written here immediately on completion.
-- Source of truth for all skill score calculations.
-- One row = one game round played by Idris with one family member.
--
-- words_spoken and completed_tasks are JSONB arrays for flexibility:
--   words_spoken:     ["car", "one", "apple"]
--   completed_tasks:  ["task-001", "task-002"]
-- ---------------------------------------------------------------------------

CREATE TABLE sessions (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- When and who
  session_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  family_member    family_member_enum NOT NULL DEFAULT 'mama',
  lang             lang_enum   NOT NULL DEFAULT 'en',

  -- What was played
  game_type        game_type_enum NOT NULL,
  skill_area       skill_area_enum,
  duration_minutes INTEGER     CHECK (duration_minutes > 0 AND duration_minutes <= 60),

  -- How it went
  stars_earned     INTEGER     NOT NULL DEFAULT 0 CHECK (stars_earned >= 0),
  score_pct        INTEGER     CHECK (score_pct BETWEEN 0 AND 100),
  mood             mood_enum   NOT NULL DEFAULT 'unknown',

  -- Detail arrays
  words_spoken     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  completed_tasks  JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Family member's free-text note after session
  notes            TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  sessions              IS 'One row per play session. Logged immediately when game completes.';
COMMENT ON COLUMN sessions.score_pct   IS '0–100: correct answers / total questions * 100.';
COMMENT ON COLUMN sessions.words_spoken IS 'JSON array of words Idris said aloud during the session.';
COMMENT ON COLUMN sessions.completed_tasks IS 'JSON array of task IDs (from doctor_instructions) practiced.';


-- ---------------------------------------------------------------------------
-- TABLE: task_proposals
--
-- AI-generated task suggestions that await doctor review.
-- The app NEVER uses a task until it appears here with status = 'approved'.
--
-- Workflow:
--   1. Weekly analysis job calls Claude → gets proposed tasks
--   2. Claude inserts rows here with status = 'pending'
--   3. Doctor reviews via portal → sets status to approved/rejected/modified
--   4. Approved tasks are written to idris-profile.md active_tasks[]
--
-- sources JSONB shape: [{ "name": "BACB", "url": "https://...", "tier": 1 }]
-- ---------------------------------------------------------------------------

CREATE TABLE task_proposals (
  id               UUID               DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Task content
  task_title       TEXT               NOT NULL CHECK (length(task_title) > 0),
  task_description TEXT               NOT NULL,
  rationale        TEXT               NOT NULL,

  -- Source citations (must have >= 1 Tier 1 or 2 source per DOCTOR_INTEGRATION.md)
  sources          JSONB              NOT NULL DEFAULT '[]'::jsonb,

  -- Classification
  skill_area       skill_area_enum    NOT NULL,
  difficulty       difficulty_enum    NOT NULL DEFAULT 'same',

  -- Doctor review
  status           proposal_status_enum NOT NULL DEFAULT 'pending',
  doctor_notes     TEXT,
  modified_task    TEXT,               -- populated when doctor edits the task text

  -- Timestamps
  proposed_at      TIMESTAMPTZ        NOT NULL DEFAULT now(),
  reviewed_at      TIMESTAMPTZ,        -- set when doctor takes any action

  -- Which weekly analysis run generated this (ISO week string e.g. "2026-W18")
  analysis_week    TEXT
);

COMMENT ON TABLE  task_proposals            IS 'AI-proposed tasks awaiting doctor approval. Never shown to Idris until approved.';
COMMENT ON COLUMN task_proposals.sources    IS 'JSON array: [{name, url, tier}]. Must cite at least one Tier 1 source.';
COMMENT ON COLUMN task_proposals.modified_task IS 'Doctor can rewrite the task here. Used instead of task_description if set.';


-- ---------------------------------------------------------------------------
-- TABLE: doctor_instructions
--
-- Free-text instructions entered directly by the doctor via the portal.
-- These override all AI-generated content (Tier 3 — highest priority).
--
-- These are injected into every Claude API system prompt in the app.
-- ---------------------------------------------------------------------------

CREATE TABLE doctor_instructions (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,

  instruction    TEXT          NOT NULL CHECK (length(instruction) > 0),
  priority       priority_enum NOT NULL DEFAULT 'normal',

  -- active=false means soft-deleted (not injected into prompts)
  -- FP-004: explicit DEFAULT false so .eq('active', true) never misses rows
  active         BOOLEAN       NOT NULL DEFAULT true,

  effective_from DATE          NOT NULL DEFAULT CURRENT_DATE,
  expires_on     DATE,         -- null = no expiry

  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  doctor_instructions          IS 'Direct doctor instructions. Injected into every Claude system prompt. Overrides all AI suggestions.';
COMMENT ON COLUMN doctor_instructions.active   IS 'false = soft deleted. Use .eq(active, true) to query (never .eq(active, false) — see FP-004).';
COMMENT ON COLUMN doctor_instructions.expires_on IS 'Optional: instruction auto-expires on this date. App should filter out expired rows.';


-- ---------------------------------------------------------------------------
-- TABLE: skill_snapshots
--
-- Weekly rollup of skill scores, computed every Sunday night by the
-- weekly-analysis cron job. Used to generate doctor PDF reports and
-- to detect milestones that trigger new task proposals.
--
-- One row = one skill area for one week.
-- Unique constraint: (week, skill_area) — no duplicate weekly snapshots.
-- ---------------------------------------------------------------------------

CREATE TABLE skill_snapshots (
  id             UUID             DEFAULT gen_random_uuid() PRIMARY KEY,

  week           TEXT             NOT NULL,          -- ISO week: "2026-W18"
  skill_area     skill_area_enum  NOT NULL,

  score_pct      INTEGER          NOT NULL DEFAULT 0 CHECK (score_pct BETWEEN 0 AND 100),
  sessions_count INTEGER          NOT NULL DEFAULT 0 CHECK (sessions_count >= 0),
  trend          trend_enum       NOT NULL DEFAULT 'stable',

  -- Previous week's score for delta display in doctor report
  prev_score_pct INTEGER          CHECK (prev_score_pct BETWEEN 0 AND 100),

  -- Milestone reached this week? (triggers task proposal)
  milestone_reached BOOLEAN       NOT NULL DEFAULT false,

  created_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT uq_snapshot_week_skill UNIQUE (week, skill_area)
);

COMMENT ON TABLE  skill_snapshots                  IS 'Weekly skill score rollups. One row per (week, skill_area). Input to doctor reports.';
COMMENT ON COLUMN skill_snapshots.week             IS 'ISO week string e.g. 2026-W18. Always Sunday-to-Saturday.';
COMMENT ON COLUMN skill_snapshots.trend            IS 'improving = score_pct > prev_score_pct + 5; declining = score_pct < prev_score_pct - 5.';
COMMENT ON COLUMN skill_snapshots.milestone_reached IS 'Set true when score_pct hits mastery threshold (per MILESTONES in DOCTOR_INTEGRATION.md).';


-- ---------------------------------------------------------------------------
-- DISABLE RLS (FP-001 — FIX_PATTERNS.md)
--
-- RLS with no policies silently returns empty rows with no error.
-- All DB access goes through Supabase Edge Functions using service_role.
-- No client-side direct DB access in this app.
-- ---------------------------------------------------------------------------

ALTER TABLE sessions            DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_proposals      DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_instructions DISABLE ROW LEVEL SECURITY;
ALTER TABLE skill_snapshots     DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- sessions: most queries filter by date range and skill_area
CREATE INDEX idx_sessions_date        ON sessions (session_date DESC);
CREATE INDEX idx_sessions_skill_area  ON sessions (skill_area);
CREATE INDEX idx_sessions_family      ON sessions (family_member);
CREATE INDEX idx_sessions_lang        ON sessions (lang);
-- Composite: weekly analysis job queries (skill_area + date range) together
CREATE INDEX idx_sessions_skill_date  ON sessions (skill_area, session_date DESC);

-- task_proposals: doctor portal loads pending proposals
CREATE INDEX idx_proposals_status     ON task_proposals (status);
CREATE INDEX idx_proposals_week       ON task_proposals (analysis_week);
CREATE INDEX idx_proposals_skill      ON task_proposals (skill_area);

-- doctor_instructions: every Claude API call fetches active high-priority rows
CREATE INDEX idx_instructions_active  ON doctor_instructions (active, priority);
CREATE INDEX idx_instructions_effective ON doctor_instructions (effective_from);

-- skill_snapshots: report generation queries by week
CREATE INDEX idx_snapshots_week       ON skill_snapshots (week DESC);
CREATE INDEX idx_snapshots_skill      ON skill_snapshots (skill_area);


-- ---------------------------------------------------------------------------
-- updated_at trigger for doctor_instructions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_doctor_instructions_updated_at
  BEFORE UPDATE ON doctor_instructions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
