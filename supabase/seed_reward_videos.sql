-- seed_reward_videos.sql
-- Reward videos for idris-learning-app
-- Generated: 2026-05-17
-- All 15 videos verified embeddable via YouTube oEmbed API (HTTP 200)
-- Durations verified by parsing lengthSeconds from YouTube watch page
--
-- Verification method:
--   https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={id}&format=json
--   HTTP 200 = embeddable | HTTP 401/403/404 = blocked
--
-- Channels used: Sesame Street, Nat Geo Kids, PBS KIDS, Khan Academy Kids, CBeebies
-- Excluded (blocked per user testing): Cocomelon, Ms Rachel, Super Simple Songs
--
-- To run: paste into Supabase SQL Editor → Run

BEGIN;

INSERT INTO reward_videos (task_type, language, title, youtube_id, duration_seconds, age_min, age_max, approved)
VALUES
  -- ─────────────────────────────────────────────────────────────
  -- task_type = 'any'  (universal rewards, shown after any game)
  -- All confirmed embeddable, 24–60s, Sesame Street / Nat Geo / PBS
  -- ─────────────────────────────────────────────────────────────
  ('any', 'en', 'A Cookie Hug! - Sesame Street',              'XHcDwYu2GKg', 60, 2, 8, true),
  ('any', 'en', 'Giant Cookie for Elmo! - Sesame Street',     'Jjo4hPvCbNE', 47, 2, 8, true),
  ('any', 'en', 'Kermit Makes Elmo Happy! - Sesame Street',   'SGWpEGVeGDQ', 24, 2, 8, true),
  ('any', 'en', '30 Seconds of Baby Cheetahs! - Nat Geo Kids','y0gTg50yQug', 30, 2, 8, true),
  ('any', 'en', 'Polar Bears Rolling Around - Nat Geo Kids',  'khe_JyKhrM8', 58, 2, 8, true),
  ('any', 'en', 'Celebrate Your Traditions! - PBS KIDS',      'VP61LH86_zs', 30, 2, 8, true),

  -- ─────────────────────────────────────────────────────────────
  -- task_type = 'counting'
  -- Khan Academy Kids (36s, 29s) + Sesame Street Number of the Day (79s)
  -- ─────────────────────────────────────────────────────────────
  ('counting', 'en', 'Count to 10 - Khan Academy Kids',            'OinudV2LWlo', 36, 2, 8, true),
  ('counting', 'en', 'Count to 5 - Khan Academy Kids',             '60zbfRwSRCg', 29, 2, 8, true),
  ('counting', 'en', 'Number 10 - Number of the Day - Sesame Street', 'kRiUEr89ep0', 79, 2, 8, true),

  -- ─────────────────────────────────────────────────────────────
  -- task_type = 'matching'
  -- CBeebies Numberblocks (84s, 80s) + Khan Academy Kids shapes (38s)
  -- ─────────────────────────────────────────────────────────────
  ('matching', 'en', 'Learn 2D Shapes with Numberblocks - CBeebies',     '33Wy8n-7uoQ', 84, 2, 8, true),
  ('matching', 'en', 'Learning 2D and 3D Shapes - Numberblocks CBeebies','9eTFH7gvhbo', 80, 2, 8, true),
  ('matching', 'en', 'Circles, Squares, Triangles and Rectangles - Khan Academy Kids', 'f5B2TyP7Q0k', 38, 2, 8, true),

  -- ─────────────────────────────────────────────────────────────
  -- task_type = 'speaking'
  -- Khan Academy Kids Sight Words (22–30s) — word recognition + pronunciation
  -- ─────────────────────────────────────────────────────────────
  ('speaking', 'en', 'Sight Word: All - Khan Academy Kids',  'O6i-l1MywkQ', 28, 2, 8, true),
  ('speaking', 'en', 'Sight Word: Be - Khan Academy Kids',   'XJBFuY_bsqA', 30, 2, 8, true),
  ('speaking', 'en', 'Sight Word: If - Khan Academy Kids',   'mc9Qq1YMjU4', 22, 2, 8, true);

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Verification query
-- ─────────────────────────────────────────────────────────────
SELECT count(*) AS count, task_type
FROM reward_videos
GROUP BY task_type
ORDER BY task_type;

