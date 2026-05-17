# WORK_QUEUE.md — idris-learning-app
# Queued tasks for Claude Code (in order)
# Read this file at the start of every session
# Last updated: 2026-05-17

---

## ⚠️ READ FIRST

Per CLAUDE.md Rule 7 (One Task at a Time) and AGENTS.md Workflow Rule:
- Hand Claude Code ONE task at a time from this queue
- Wait for explicit confirmation each task is complete + CI green before next
- Do not let Claude Code run multiple tasks in one session unless they are atomic

---

## QUEUE

### ✅ DONE
- v1.61.2 — Drawing game (number tracing 1-10) + session progress tracking
- v1.61.3 — package.json scripts force prod BASE_URL
- v1.61.4 — Stop ignoring multi-agent package-lock.json
- v1.61.5 — Fix draw mode card cls collision (`count` → `draw`)
- docs — CLAUDE.md Rule 7 + AGENTS.md Workflow Rule (One Task at a Time)

### 🔄 IN PROGRESS
- **Task A — Video seed generation** (handed to Claude Code 2026-05-17)
  - See task definition below
  - Status: waiting for Claude Code to finish

### 📋 NEXT UP (start AFTER Task A is verified done)
- **Task B — Wire Do This Now + Sing Along to filtered video popups** (BUG-016)
  - See task prompt below
  - Depends on Task A: needs `task_type='sing'` and `task_type='do_now'` to exist in seed

### 🔮 POST-HAJJ (June 6+)
- Tier 3: Supabase migration for session log (localStorage → child_progress table)
- Tier 4: AI task proposals + doctor portal for Ms. Brower Kaitlin
- Tier 5: Drag-and-drop shapes game
- Tier 6: Weekly PDF progress report
- Tier 7: ElevenLabs voice enrollment (Mama, Papa, Deda, Babushka) — also relevant to Path C for video reward replacement

---

## BUG-016 — Do This Now + Sing Along don't open video popups

**Reported:** 2026-05-17 (Farhod, before Hajj)
**Priority:** High — completes the 7/7 feature parity goal
**Type:** Feature wiring
**Status:** Queued (Task B)
**Depends on:** BUG-015 fix (video seed must exist with `task_type='sing'` and `task_type='do_now'`)

### Symptom
- Watch Reward button correctly opens the side video popup (working ✅)
- Sing Along (per CHANGELOG v1.60.1 it was wired to `openVidPopup()`, needs verification)
- Do This Now green dot tap shows checkmark + speaks "Yes!" but does NOT open the video popup

### Required behavior
Each button opens the side popup pre-filtered to relevant videos:
| Button | Action | Video filter |
|---|---|---|
| Watch reward | `openVidPopup()` + `loadRewardVideos(taskType)` | task_type matches current game |
| Sing Along | (NEW) open popup AND keep current "speak song name" behavior | `task_type='sing'` |
| Do This Now (green dot) | (NEW) open popup AND keep checkmark + "Yes!" speech | `task_type='do_now'` |

### Acceptance criteria
1. Both new behaviors call `openVidPopup()` then `loadRewardVideos(taskType)`
2. `taskType` values `'sing'` and `'do_now'` must match `task_type` strings in seeded `reward_videos`
3. Do This Now KEEPS its current behavior (checkmark animation + "Yes!" speech) AND opens popup
4. Sing Along KEEPS its current behavior (speaks song name) AND opens popup
5. All 17 iPad Playwright tests pass locally (`npx playwright test --project=ipad`)
6. CI green after push

### Constraints (carried over from CLAUDE.md hard rules)
- Use Python (not PowerShell Set-Content) for `index.html` writes — Rule 1 / P-ENC-01
- No emoji selectors in new Playwright tests — Rule 2 / P-CI-01
- 72px touch targets — Rule 3
- Commit format: `feat: do-now + sing-along open filtered video popups [vX.X.X]`
- No push until iPad tests pass locally — Workflow C

---

## Task A — Prompt for Claude Code (video seed generation)

This is the prompt Farhod gave Claude Code on 2026-05-17. Reproduced here for the session log.

```
Read CLAUDE.md, AGENTS.md, FIX_PATTERNS.md, and api/videos.ts in this project.

Task: Find 15 YouTube videos that are confirmed-embeddable (NOT blocked by Error 153) and generate a Supabase seed SQL file for the reward_videos table.

Requirements:
1. Use YouTube's oEmbed API (https://www.youtube.com/oembed?url=...&format=json) to programmatically verify each video allows embedding. A video that returns HTTP 200 is embeddable; 401/404/403 means blocked. Test with curl or node fetch — do NOT use a browser.

2. Target distribution (15 total):
   - 6 videos with task_type='any', language='en', duration 15-60s (universal rewards)
   - 3 videos with task_type='counting', language='en'
   - 3 videos with task_type='matching', language='en'
   - 3 videos with task_type='speaking', language='en'

3. Channel preference order:
   - PBS Kids (official)
   - Khan Academy Kids
   - Sesame Street (official)
   - Creative Commons-licensed children's content
   - AVOID: Cocomelon, Ms Rachel (any channel including Netflix Jr re-uploads), Super Simple Songs — confirmed blocked by user testing today

4. For each candidate video, before adding to SQL:
   - Verify embed permission via oEmbed API (HTTP 200 = pass)
   - Confirm duration is age-appropriate (15s minimum, 90s maximum)
   - Confirm title is ASD-appropriate (no flashing/scary themes, no commercial pitches)

5. Generate supabase/seed_reward_videos.sql using the EXACT existing table schema:
   Columns: task_type (text), language (text), title (text), youtube_id (text), duration_seconds (int), age_min (int default 2), age_max (int default 8), approved (bool default true)
   - Use INSERT INTO reward_videos (...) VALUES (...) format
   - Wrap in a transaction (BEGIN; ... COMMIT;)
   - Include a verification SELECT at the end: SELECT count(*), task_type FROM reward_videos GROUP BY task_type;

6. Do NOT modify index.html, api/videos.ts, or any other production code. Only create the new SQL file.

7. Do NOT commit. Show me the generated SQL file content and a summary table of (channel, count, total_duration_sec) for review. I will run it manually in Supabase SQL Editor after approval.

8. If oEmbed shows fewer than 15 videos meeting all criteria after reasonable search effort, output what you have plus a note about how many were attempted vs. accepted, and which channels yielded the most/least embeddable content.

9. Follow Rule 7 from CLAUDE.md: one focused task. Do not expand scope. Do not commit. Do not push. Just produce the SQL file and report results.
```

---

## Task B — Prompt for Claude Code (Do This Now + Sing Along popups)

Hand this to Claude Code ONLY AFTER Task A is verified complete (SQL run in Supabase, video popup smoke-tested working).

```
Read CLAUDE.md (especially Rule 7), AGENTS.md, and FIX_PATTERNS.md.

Task: Wire "Do This Now!" and "Sing Along!" buttons to open the side video popup with filtered videos, matching the Watch Reward button behavior.

CURRENT STATE:
- Watch Reward button → calls openVidPopup() and loadRewardVideos(taskType) → opens side popup with video list
- Sing Along (renderSing/singAlong) → was supposed to call openVidPopup() per v1.60.1 CHANGELOG but verify it actually does and works on iPad
- Do This Now dot (tapDot) → currently shows checkmark + speaks "Yes!" but does NOT open the popup

REQUIRED STATE:
- Sing Along tap → open side popup, fetch videos with task='sing', show video list
- Do This Now dot tap → open side popup, fetch videos with task='do_now', show video list
- Watch Reward button → unchanged

ACCEPTANCE CRITERIA:
1. Both new behaviors call openVidPopup() then loadRewardVideos(taskType)
2. taskType values 'sing' and 'do_now' must match the task_type values in the reward_videos seed data
3. Do This Now should KEEP its current behavior (checkmark animation + "Yes!" speech) AND ALSO open the popup
4. Sing Along should KEEP its current behavior (speaks song name) AND ALSO open the popup
5. All 17 iPad Playwright tests pass locally (npx playwright test --project=ipad)
6. CI green after push

CONSTRAINTS:
- DO NOT use PowerShell Set-Content for HTML edits (Rule 1 — corrupts UTF-8). Use Python only.
- DO NOT use emoji selectors in any new Playwright tests (Rule 2 / P-CI-01). Use CSS classes.
- Touch targets remain 72px minimum (Rule 3).
- Commit format: "feat: do-now + sing-along open filtered video popups [vX.X.X]"
- DO NOT push until all iPad tests pass locally first (Workflow C).

DELIVERABLES (in order, one at a time per Rule 7):
1. Show me the diff of index.html changes BEFORE applying
2. Wait for my approval
3. Apply, run iPad tests locally
4. Report test result
5. Wait for my approval to commit
6. Commit + push (atomic, single commit)
7. Verify CI green

If at any point a step fails, STOP and ask. Do not invent fixes.
```

---

## Session log

### 2026-05-17 (Farhod, pre-Hajj)
- Drawing game shipped + CI green (4 commits: v1.61.2-v1.61.5)
- CLAUDE.md Rule 7 + AGENTS.md Workflow Rule baked in
- Task A handed to Claude Code (video seed generation)
- Task B documented as BUG-016 (queued)
- Farhod departs for Hajj 2026-05-19, returns 2026-06-06
