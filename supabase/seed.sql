-- =============================================================================
-- seed.sql — Development seed data for Idris Learning App
-- Project:  Idris Learning App
-- Author:   Farhod Elbekov
-- Created:  2026-05-02
--
-- Run with: supabase db seed
-- Or:       psql $DATABASE_URL < supabase/seed.sql
--
-- Seed data reflects Idris's real profile (idris-profile.md):
--   - Primary language: English
--   - Interests: cars, fish, fruits
--   - Family: mama (Gavkhar), papa, deda (Farhod), babushka
--   - ASD, age 7, developing speech
-- =============================================================================


-- =============================================================================
-- DOCTOR INSTRUCTIONS
-- Two instructions from doctor — injected into every Claude API system prompt.
-- Based on sample data from DOCTOR_INTEGRATION.md section 6.
-- =============================================================================

INSERT INTO doctor_instructions
  (instruction, priority, active, effective_from)
VALUES
  (
    'Keep counting sessions under 10 minutes — Idris loses focus after that point.',
    'high',
    true,
    '2026-04-30'
  ),
  (
    'Russian sessions are less effective this month. Prioritize English and Uzbek. Use Russian only with Babushka when she is the selected family member.',
    'normal',
    true,
    '2026-05-02'
  );


-- =============================================================================
-- TASK PROPOSALS
-- Two proposals: one pending review, one already approved.
-- Sources follow Tier 1/2 structure from DOCTOR_INTEGRATION.md.
-- =============================================================================

INSERT INTO task_proposals
  (task_title, task_description, rationale, sources, skill_area, difficulty, status, analysis_week)
VALUES
  (
    'Counting 6–10 with car emojis',
    'Show Idris sets of 6 to 10 car emojis. Ask him to count aloud and tap each one. Use backward chaining: start from 10 and count back to 6 once he is comfortable going forward.',
    'Idris has scored above 78% on counting 1–5 for 3 consecutive sessions. Per BACB mastery criteria (80% for 3 sessions), he is ready for the next difficulty level. Cars are his highest-interest category.',
    '[
      {"name": "BACB Skill Acquisition Guidelines", "url": "https://www.bacb.com", "tier": 1},
      {"name": "ASHA Language Development Benchmarks", "url": "https://www.asha.org/public/speech/disorders/autism/", "tier": 1}
    ]'::jsonb,
    'counting',
    'harder',
    'pending',
    '2026-W18'
  ),
  (
    'Name 3 fruits in English',
    'Show pictures of blueberry, apple, and grapes (his favourite foods from profile). Ask Idris to say the name. Celebrate any attempt — even partial words. Repeat each fruit 3 times per session.',
    'Family interaction score is at 40% (no change for 2 weeks). Introducing fruit vocabulary with mama using his favourite foods bridges social interaction and vocabulary goals simultaneously.',
    '[
      {"name": "ASHA Language Development Benchmarks", "url": "https://www.asha.org/public/speech/disorders/autism/", "tier": 1},
      {"name": "Autism Speaks Resource Library", "url": "https://www.autismspeaks.org/resource-library", "tier": 2}
    ]'::jsonb,
    'vocabulary',
    'same',
    'approved',
    '2026-W18'
  );

-- Simulate doctor reviewing the approved proposal
UPDATE task_proposals
SET
  reviewed_at  = now() - INTERVAL '2 days',
  doctor_notes = 'Good suggestion. Use real fruit photos from the kitchen if possible, not just emojis.'
WHERE task_title = 'Name 3 fruits in English';


-- =============================================================================
-- SESSIONS
-- Five sample play sessions from the first week (2026-04-28 to 2026-05-02).
-- Matches the sample week shown in the doctor PDF report in DOCTOR_INTEGRATION.md.
-- =============================================================================

INSERT INTO sessions
  (session_date, family_member, lang, game_type, skill_area,
   duration_minutes, stars_earned, score_pct, mood, words_spoken, completed_tasks, notes)
VALUES

  -- Session 1: Grandfather (deda) plays counting in Tajik — happy, high score
  (
    '2026-04-28',
    'deda',
    'tg',
    'counting',
    'counting',
    14,
    5,
    88,
    'happy',
    '["як", "ду", "се", "чор", "панҷ"]'::jsonb,  -- 1-5 in Tajik
    '[]'::jsonb,
    'Idris counted to 5 twice without any help. Very proud of him today!'
  ),

  -- Session 2: Mama plays picture match in English — happy, good score
  (
    '2026-04-29',
    'mama',
    'en',
    'picture_match',
    'vocabulary',
    11,
    4,
    82,
    'happy',
    '["car", "fish", "apple"]'::jsonb,
    '[]'::jsonb,
    'He recognized the fish and car immediately. Apple took 2 tries.'
  ),

  -- Session 3: Babushka plays speak & repeat in Russian — frustrated, low score
  -- (matches the Wednesday frustration noted in DOCTOR_INTEGRATION.md report)
  (
    '2026-04-30',
    'babushka',
    'ru',
    'speak_repeat',
    'speech',
    8,
    1,
    35,
    'frustrated',
    '["кошка"]'::jsonb,  -- only managed one word
    '[]'::jsonb,
    'He struggled today. Got upset after 8 minutes and stopped. Russian harder for him right now.'
  ),

  -- Session 4: Papa plays family challenge in English — calm, moderate score
  (
    '2026-05-01',
    'papa',
    'en',
    'family_challenge',
    'family_interaction',
    9,
    2,
    55,
    'calm',
    '["clap", "jump"]'::jsonb,
    '[]'::jsonb,
    'Did the physical challenges well. Clapped 3 times correctly. Seemed calm throughout.'
  ),

  -- Session 5: Mama plays counting + picture match in English — excited, best score
  (
    '2026-05-02',
    'mama',
    'en',
    'counting',
    'counting',
    12,
    5,
    92,
    'excited',
    '["one", "two", "three", "four", "five", "car", "apple"]'::jsonb,
    '[]'::jsonb,
    'Best session so far! He counted to 5 independently and wanted to keep going. We did 2 rounds.'
  );


-- =============================================================================
-- SKILL SNAPSHOTS
-- Weekly rollup for 2026-W17 (the week before the seed sessions).
-- Shows baseline scores before the current week started.
-- =============================================================================

INSERT INTO skill_snapshots
  (week, skill_area, score_pct, sessions_count, trend, prev_score_pct, milestone_reached)
VALUES
  ('2026-W17', 'counting',          66, 3, 'improving', 54, false),
  ('2026-W17', 'vocabulary',        82, 2, 'stable',    80, false),
  ('2026-W17', 'speech',            48, 2, 'improving', 38, false),
  ('2026-W17', 'family_interaction',40, 2, 'stable',    42, false),
  ('2026-W17', 'colors',            30, 1, 'stable',    28, false);


-- =============================================================================
-- PARENTAL CONSENT
-- Mama (Gavkhar) consented during onboarding for all required categories.
-- Privacy policy version 1.0.
-- =============================================================================

INSERT INTO parental_consent
  (guardian_name, guardian_relation, child_name, child_age_at_consent,
   consent_type, status, privacy_policy_version, consent_text_snapshot)
VALUES
  (
    'Gavkhar',
    'mama',
    'Idriszhon',
    7,
    'data_collection',
    'granted',
    '1.0',
    'I consent to the Idris Learning App collecting session data including game scores, duration, mood, and words spoken. This data is used only to track learning progress and generate reports for the doctor.'
  ),
  (
    'Gavkhar',
    'mama',
    'Idriszhon',
    7,
    'ai_content_generation',
    'granted',
    '1.0',
    'I consent to the app sending my child''s learning profile to an AI system (Claude by Anthropic) to generate personalised learning content. No personal identifying information beyond age, interests, and learning goals is shared.'
  ),
  (
    'Gavkhar',
    'mama',
    'Idriszhon',
    7,
    'doctor_data_sharing',
    'granted',
    '1.0',
    'I consent to weekly progress reports being shared with our doctor for review and treatment planning.'
  ),
  (
    'Gavkhar',
    'mama',
    'Idriszhon',
    7,
    'voice_recording',
    'granted',
    '1.0',
    'I consent to recording my own voice (Gavkhar, mother) for AI voice cloning. The cloned voice will be used only within this app to read words and instructions to my child. The recording will be processed by ElevenLabs AI.',
    -- voice_family_member populated for voice_recording type
    'mama'
  );


-- =============================================================================
-- AUDIT LOG
-- Seed the audit trail with the consent grants above and first session.
-- =============================================================================

INSERT INTO audit_log
  (action, table_name, record_id, performed_by, context, new_values)
VALUES
  (
    'CONSENT_GRANTED',
    'parental_consent',
    NULL,
    'app',
    'onboarding',
    '{"guardian": "Gavkhar", "consent_types": ["data_collection", "ai_content_generation", "doctor_data_sharing", "voice_recording"], "policy_version": "1.0"}'::jsonb
  ),
  (
    'INSERT',
    'sessions',
    NULL,
    'app',
    'game:counting',
    '{"session_date": "2026-04-28", "family_member": "deda", "lang": "tg", "stars_earned": 5, "score_pct": 88}'::jsonb
  );
