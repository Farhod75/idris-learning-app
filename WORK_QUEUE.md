# WORK_QUEUE.md — idris-learning-app
# Queued tasks for Claude Code (in order)
# Read this file at the start of every session
# Last updated: 2026-06-15 (added BUG-018 (Stop hook duplication))

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
- v1.62.0 — Seed reward_videos with 15 oEmbed-verified clips (Task A done; video popup works end-to-end)
- docs — CLAUDE.md Rule 7 + AGENTS.md Workflow Rule (One Task at a Time)
- v1.63.0 — Do This Now + Sing Along open filtered video popups (Task B / BUG-016 done)
- v1.64.0 — Islamic praise + "Correct, {content}" TTS on correct answers (Task C / BUG-017 done)

### 🔄 IN PROGRESS
- _Nothing currently in progress_

### 📋 NEXT UP
- **BUG-018 — Fix Stop hook idempotency (re-enable after fix)** — see detailed section below

### 🔮 POST-HAJJ (June 6+)
- Tier 3: Supabase migration for session log (localStorage → child_progress table)
- Tier 4: AI task proposals + doctor portal for Ms. Brower Kaitlin
- Tier 5: Drag-and-drop shapes game
- Tier 6: Weekly PDF progress report
- Tier 7: ElevenLabs voice enrollment (Mama, Papa, Deda, Babushka) — also relevant to Path C for video reward replacement
- Tier 8: Self-evolving system (weekly agent self-education + parent-suggested feature evolution) — see detailed design below

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

## BUG-017 — Generic TTS celebrations don't reinforce learning

**Reported:** 2026-05-17 (Farhod, before Hajj, observing Idris play count game)
**Priority:** Medium-High — affects therapeutic value of every correct answer
**Type:** Feature / Accessibility improvement
**Status:** Queued (Task C)
**Depends on:** Nothing — standalone

### Symptom
When Idris taps the correct answer in any game, TTS speaks a random generic celebration:
- `"Amazing!"`, `"You did it!"`, `"Dizzy star!"`

These phrases:
- Don't reinforce the actual learning content (the number, the word, the shape just identified)
- Are interchangeable across all games — same phrase plays whether counting, matching, or speaking
- Miss a teaching opportunity: a child with ASD who just identified "109" benefits from hearing "109" spoken aloud to reinforce the number-symbol mapping

### Required behavior
On a correct answer in ANY game, TTS alternates between two celebration formats (~50/50 random):

**Format A — Learning-reinforcement:** `"Correct, {meaningful_content}"`
**Format B — Islamic praise + reinforcement:** `"{islamic_phrase}, {meaningful_content}"`

The {content} (number/word/shape/name) appears in BOTH formats — this is the learning anchor and must always be spoken. Only the prefix alternates between "Correct" and an Islamic praise phrase.

Where `{meaningful_content}` is:
| Game | meaningful_content |
|---|---|
| count | the number itself (e.g. "Correct, 109" or "Ma sha Allah, 109") |
| speak | the target word the child was asked to say (e.g. "Correct, ball") |
| match | the matched pair name (e.g. "Correct, dog" when matching dog cards) |
| family | the family member name (e.g. "Correct, mama") |
| draw | the number being traced (e.g. "Ma sha Allah, 3") — task_type='draw' (added v1.61.2) |
| aac | the symbol selected — likely no "correct/incorrect" applies, skip or evaluate |

Where `{islamic_phrase}` is one of (Claude Code: include this set as a minimum and add 2-4 more appropriate ones in transliteration):
- "Ma sha Allah" — most common, means "what Allah willed"
- "Barakallah" — "may Allah bless [you]"
- "Allahu Akbar" — "Allah is greatest"
- "Subhanallah" — "glory be to Allah"
- "Tabarakallah" — "blessed is Allah"
- Plus a few more chosen by Claude Code (e.g. "Alhamdulillah," "Ahsantum," "Yarhamukallah," etc. — pick ones that are appropriate for praising a child)

**Important: use TRANSLITERATION (Latin script) in TTS strings, not Arabic script** — TTS engines on iOS/Android handle transliteration reliably across all 7 supported languages. Arabic script may break in non-ar locales.

### Acceptance criteria
1. On correct answer in any game, TTS speaks ONE of:
   - `"Correct, {content}"` (~50% of the time)
   - `"{islamic_phrase}, {content}"` (~50% of the time, phrase chosen randomly from the curated set)
2. The {content} portion is ALWAYS present — both formats reinforce the learning anchor
3. The {content} respects the user's selected language (use translation map if needed; for numbers, locale-aware speech via the existing `speak()` function which sets `utt.lang`)
4. Generic celebration phrases (`"Amazing"`, `"You did it"`, `"Dizzy star"`) are REMOVED from the correct-answer code path entirely. They can remain in `L().celebrate` array if used elsewhere (e.g. session-completion screens) but must NOT play on per-question correct answers.
5. The Islamic phrase set is shared across ALL 7 languages — these phrases transcend language (a Muslim family in Tajikistan, Russia, Saudi Arabia, France, or Spain all recognize "Ma sha Allah" identically). Do NOT translate them — Latin-transliteration only.
6. The existing `stripForTTS()` function removes emoji from TTS — verify the new strings pass cleanly. If `stripForTTS()` removes "star" or "dizzy" via regex word match, "Tabarakallah" might get partially mangled — TEST this and adjust regex word boundaries if needed.
7. All 17 iPad Playwright tests still pass locally (`npx playwright test --project=ipad`)
8. CI green after push

### Implementation notes
Search `index.html` for `addStar()` and `L().celebrate` references. The function `addStar()` likely calls `speak(L().celebrate[Math.floor(...)])`. Refactor so per-question correct-answer handlers pass the meaningful content to a new function `speakCorrect(content)`.

`speakCorrect(content)` logic:
```javascript
function speakCorrect(content) {
  const useIslamic = Math.random() < 0.5;  // ~50/50 alternation
  let prefix;
  if (useIslamic) {
    prefix = ISLAMIC_PRAISE[Math.floor(Math.random() * ISLAMIC_PRAISE.length)];
  } else {
    prefix = L().correct;  // localized "Correct" for current language
  }
  speak(prefix + ', ' + content);
}
```

Islamic praise array (transliteration only — works across all languages):
```javascript
const ISLAMIC_PRAISE = [
  'Ma sha Allah',
  'Barakallah',
  'Allahu Akbar',
  'Subhanallah',
  'Tabarakallah',
  // Claude Code: add 2-4 more child-praise-appropriate phrases here in transliteration
];
```

For multilingual "Correct" support, add a `correct:` key to each language config in `LANGS_CFG`:
- en: "Correct"
- ru: "Правильно"
- tg: "Дуруст"
- uz: "To'g'ri"
- ar: "صحيح"
- es: "Correcto"
- fr: "Correct"

### Constraints
- Use Python (not PowerShell Set-Content) for `index.html` writes — Rule 1 / P-ENC-01
- No emoji selectors in new Playwright tests — Rule 2 / P-CI-01
- 72px touch targets unchanged — Rule 3
- Commit format: `feat: TTS speaks 'Correct, {content}' on right answer in all games [vX.X.X]`
- No push until iPad tests pass locally — Workflow C
- Per Rule 7: do this as ONE atomic feature commit, not split across games

---

## BUG-018 — Stop hook fires every assistant turn, causing CHANGELOG/AGENTS duplication

**Reported:** 2026-06-14 (Farhod + Claude Code investigation in same session as BUG-017 ship)
**Priority:** Medium — currently disabled to prevent damage
**Type:** Hook misconfiguration
**Status:** Hook DISABLED in .claude/settings.json pending proper fix

### Symptom
After today's BUG-016 + BUG-017 session, AGENTS.md and CHANGELOG.md showed duplicate entries:
- [1.63.2] appeared 7 times in CHANGELOG
- [1.62.2] appeared 3 times
- Multiple session-log entries for the same commit hashes in AGENTS.md

### Root cause
Claude Code's "Stop" hook fires at the end of EACH assistant turn (each tool-loop boundary), not just at
session-exit. The hook script (.claude/hooks/log-session.js) appends an entry every time without checking
if an identical entry already exists. Result: a session with N assistant turns produces N duplicate
appends per commit.

### Fix required (when picked up)
Either:
Option A — Make log-session.js IDEMPOTENT: read existing AGENTS.md/CHANGELOG.md content, only append if
            the new entry isn't already present (match by commit hash or version tag).
Option B — Change the hook trigger to a different event that fires once per session (if Claude Code has
            one that fits — investigate the hooks API).
Option C — Add a state file (e.g. .claude/.last-logged-commit) that the hook updates after writing, and
            the hook short-circuits if current HEAD == last-logged-commit.

### Acceptance criteria for fix
1. Stop hook re-enabled in .claude/settings.json
2. Hook produces AT MOST one entry per commit, regardless of how many assistant turns happened
3. Existing duplicates in AGENTS.md and CHANGELOG.md are cleaned in the same PR
4. Add a Playwright/Node test verifying idempotency: run the hook N times in a row, assert file is touched
   only once (or content has only one entry for the current commit)

### Workaround until fixed
Stop hook disabled in .claude/settings.json (Stop: []). Manual CHANGELOG/AGENTS updates per commit as
needed.

---

## Tier 8 — Self-evolving system (DESIGN ONLY, deferred)

**Reported:** 2026-06-14 (Farhod, post-Hajj, after Task B shipped)
**Priority:** Future — design captured, build deferred minimum 3-6 months
**Type:** Architecture / new agent subsystem
**Status:** Idea captured. NOT to be built until Tier 3 (session log → Supabase) ships AND we have 3-6 months of FIX_PATTERNS data + real-user session signal to justify the agents.

### Why deferred (read this before considering building)
1. Building self-evolving agents on top of empty data is theater. They need a real signal stream (FIX_PATTERNS.md history, child_progress table, parent feedback events) to learn from. Tier 3 must ship first.
2. The system is tooling-on-tooling — it makes the developer experience better, not Idris's experience. Idris benefits from Tier 4 (adaptive task difficulty) and Tier 5 (new games), not from a self-updating CLAUDE.md.
3. Running the app on real data for a few months reveals where friction actually lives. Building the self-improvement loop before that risks optimizing the wrong things.
4. Maintenance cost is real: a system that auto-proposes changes to its own constitution can drift, hallucinate "best practices," or chase changelog noise. The PR-review burden falls on Farhod.

### Two sub-systems

**Sub-system A — Weekly agent self-education loop**
Goal: keep agent prompts, FIX_PATTERNS.md, and CLAUDE.md aligned with current best practices in our actual stack.

Components:
- **GitHub Action `agent-self-update.yml`** — runs weekly (Sunday 02:00 UTC, before sessions start)
- **Sources to monitor:** Anthropic docs (claude.com/docs), Playwright changelog (github.com/microsoft/playwright/releases), Next.js release notes, Supabase changelog, WCAG updates, ASD therapy research (Autism Research Institute, Autism Speaks Science Digest — VERIFY citation policies before fetching), MDN web docs for any APIs we use
- **`self-improvement-agent`** (new agent, sits alongside the existing 7):
  - Reads each source delta since last run
  - Cross-references against current FIX_PATTERNS.md (50+ entries) and CLAUDE.md constitution
  - Detects: (a) patterns that are now obsolete (e.g. "use --break-system-packages" if pip syntax changes), (b) new best practices we don't have, (c) deprecation warnings in our stack
  - Opens a PR titled `chore(self-update): {source} {date}` with proposed diffs
- **Critical:** never auto-merge. Farhod reviews every PR. Default to conservative — propose only when high confidence.
- **Failure mode to prevent:** the agent drifts our constitution toward generic web-dev best practices and away from our ASD-specific principles (effort-based rewards, no countdown timers, 72px touch targets). The self-improvement-agent must read CLAUDE.md's ASD principles section first and explicitly preserve them.

**Sub-system B — Parent-suggested feature evolution loop**
Goal: when Gavkhar or Ms. Brower Kaitlin says "Idris is bored of counting 1-10, try 1-50" or "He needs more drag-and-drop practice," the suggestion becomes a tracked task proposal that the system evaluates against Idris's actual session data.

Components:
- **Parent input mechanism:** simple form in profile screen → POST to `/api/suggestions` → Supabase `parent_suggestions` table
  - Fields: `suggester_role` (mom/dad/grandma/therapist), `target_game`, `suggestion_text`, `created_at`
- **`task-proposal-agent`** (new agent — already partially designed in Tier 4):
  - Fires nightly cron
  - Reads new suggestions + last 7 days of session log (Tier 3 prerequisite)
  - Uses Claude API to evaluate: does the data support this suggestion? (e.g. "is Idris actually mastering counting 1-10 → ready for 1-50?")
  - Generates structured proposal: config change diff + rationale + supporting metrics
- **Doctor portal review screen** (Tier 4 component):
  - Ms. Brower Kaitlin sees pending proposals
  - Approve / Reject / Request modification
  - Approved proposals create a config change PR (or direct Supabase config row, depending on implementation)
- **Roll-out cadence:** approved changes go live next Monday (children with ASD benefit from predictable, scheduled change — not surprise mid-week updates)

### Data dependencies (gate ordering)
Tier 3 must ship before Tier 8 makes sense:
- Sub-system A needs FIX_PATTERNS.md to have 6+ months of entries (~100+) to detect patterns
- Sub-system B needs child_progress table (Tier 3) populated with real session data (mastery, boredom, error patterns) to evaluate suggestions against

### Open questions to resolve before building
1. **Who owns PR review when Farhod is unavailable?** A self-evolving system that nobody reviews becomes a self-rotting system. Need a fallback reviewer or auto-stale rule (close PR if open >14 days).
2. **How does the system handle conflicting suggestions** (mom wants more counting, therapist wants more matching)? Default: therapist wins. Document this explicitly.
3. **What's the cost ceiling?** Weekly Claude API calls + nightly proposal generation could rack up. Set a monthly budget cap, fail-closed when exceeded.
4. **Privacy:** parent suggestions may contain PHI (e.g. "Idris had a meltdown during counting"). The `parent_suggestions` table must follow COPPA/GDPR pattern from FP-001 — RLS on, parent-scoped reads only, no LLM training opt-in.
5. **Therapist workflow load:** if the system generates 5+ proposals/week, Ms. Brower Kaitlin will burn out reviewing them. Cap proposals at 1-2/week, require strong signal.

### When to actually start building this
Concrete triggers (any ONE of these):
- FIX_PATTERNS.md hits 100+ entries (currently ~50) — enough signal to detect stale patterns
- 3+ months of real session log data in child_progress table (Tier 3 prerequisite)
- Gavkhar or Ms. Brower Kaitlin explicitly requests it ("I want a way to suggest changes from the app")
- Farhod has 2+ uninterrupted weeks of focus available (this is not a weekend project)

Until then: this design lives here. Don't build. Don't expand. Refer back when one of the triggers fires.

---

## Task C — Prompt for Claude Code (TTS correct-answer feedback with Islamic praise)

Hand to Claude Code AFTER Task A is shipped. Can run BEFORE or AFTER Task B — they don't conflict.

```
Read CLAUDE.md (especially Rule 7), AGENTS.md, and FIX_PATTERNS.md.

Task: Replace generic TTS celebration phrases ("Amazing!", "You did it!", "Dizzy star!") with meaningful per-game feedback that alternates ~50/50 between "Correct, {content}" and "{islamic_praise}, {content}".

CONTEXT: This is for Idris (age 7, ASD, Muslim family in Dushanbe Tajikistan). The Islamic praise phrases reinforce cultural identity alongside the learning content. {content} is always present in BOTH formats because it's the learning anchor.

CURRENT STATE:
- index.html function addStar() calls: speak(L().celebrate[Math.floor(Math.random()*L().celebrate.length)])
- L().celebrate is an array of generic phrases per language ("Amazing", "You did it", "Dizzy star")
- Same random phrase plays for every correct answer in all games (count, speak, match, family, draw, aac)

REQUIRED STATE:
- New function speakCorrect(content) called on every correct answer
- speakCorrect picks ~50/50 between:
  Format A: "{localized_Correct}, {content}"  — e.g. "Correct, 109" or "Дуруст, 109" or "Правильно, 109"
  Format B: "{islamic_praise}, {content}"     — e.g. "Ma sha Allah, 109" or "Barakallah, 109"
- {content} per game:
  - count: the number (e.g. 109)
  - speak: the target word
  - match: the matched pair name
  - family: the family member name
  - draw: the number being traced
  - aac: evaluate — likely skip TTS for this game
- Islamic praise phrases use Latin transliteration (NOT Arabic script — breaks TTS in non-ar locales)
- Generic celebration phrases removed from per-question correct-answer code path

ACCEPTANCE CRITERIA:
1. New function speakCorrect(content) added with ~50/50 alternation logic
2. ISLAMIC_PRAISE constant array declared globally with minimum 5 phrases (Ma sha Allah, Barakallah, Allahu Akbar, Subhanallah, Tabarakallah) plus 2-4 additional appropriate child-praise phrases chosen by you (suggestions: Alhamdulillah, Ahsantum, Yarhamukallah, Jazakallah, Hasbunallah — verify each is appropriate for praising a child's correct answer)
3. Each game's correct-answer handler calls speakCorrect(<game-specific content>) instead of the generic celebration path
4. addStar() keeps updating star count and saving profile — only the celebration TTS line is replaced
5. New translation key 'correct' added to all 7 languages in LANGS_CFG:
   en="Correct", ru="Правильно", tg="Дуруст", uz="To'g'ri", ar="صحيح", es="Correcto", fr="Correct"
6. stripForTTS() does NOT mangle Islamic phrases or content (test "Tabarakallah" — if the regex strips "star" globally it might affect "tabaraka" — verify and tighten regex word boundaries if needed)
7. L().celebrate array can remain (may be used at session-end screens) but is no longer triggered per-question
8. All 17 iPad Playwright tests pass locally (npx playwright test --project=ipad)
9. Add ONE new Playwright test verifying speakCorrect is called when a correct answer is tapped in the count game. Spy on window.speechSynthesis.speak or wrap the speak() function. The test should:
   - Trigger a correct count answer
   - Assert speak() was called with a string matching /^(Correct|Ma sha Allah|Barakallah|Allahu Akbar|Subhanallah|Tabarakallah|Alhamdulillah|...), \d+$/
   - i.e. assert format is "{prefix}, {number}"
10. CI green after push

CONSTRAINTS:
- DO NOT use PowerShell Set-Content for HTML edits (Rule 1 — corrupts UTF-8). Use Python only.
- DO NOT use emoji selectors in new Playwright tests (Rule 2 / P-CI-01). Use CSS classes.
- Touch targets remain 72px minimum (Rule 3).
- Commit format: "feat: TTS speaks 'Correct, {content}' or Islamic praise + content on right answer [vX.X.X]"
- DO NOT push until all iPad tests pass locally first (Workflow C).

DELIVERABLES (in order, one at a time per Rule 7):
1. Show me the diff of index.html changes BEFORE applying — including the final ISLAMIC_PRAISE array (so I can review which phrases you picked)
2. Wait for my approval
3. Apply, run iPad tests locally
4. Report test result + new test addition
5. Wait for my approval to commit
6. Commit + push (atomic, single commit)
7. Verify CI green

If at any point a step fails, STOP and ask. Do not invent fixes.
```

---

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
- Task A completed (Claude Code): supabase/seed_reward_videos.sql with 15 oEmbed-verified clips
- 9 pre-existing rows in reward_videos table deleted (Ms Rachel/Cocomelon/Lucas — all embed-blocked)
- Video popup verified working end-to-end on live app (Sesame Street "Giant Cookie for Elmo" plays)
- v1.62.0 shipped (seed SQL + WORK_QUEUE.md)
- 7/7 features working
- Task B (BUG-016) documented and queued for Claude Code
- Task C (BUG-017) documented and queued — new feature: "Correct, {content}" TTS feedback
- Farhod departs for Hajj 2026-05-19, returns 2026-06-06

### 2026-06-14 (Farhod, post-Hajj first session)
- Fixed .claude/settings.json schema migration (object → array of matchers per new Claude Code hooks API)
- v1.62.2 shipped (settings.json migration)
- Task B / BUG-016 shipped (Claude Code with diff-review-approve loop per Rule 7)
- Critical UX correction during review: tapDot() popup-open moved into completion branch (don't open per-tap, open once on activity completion)
- v1.63.0 shipped (do-now + sing-along open filtered video popups, 29/29 iPad tests green)
- v1.63.1 shipped (docs: marked BUG-016 done in WORK_QUEUE.md + CLAUDE.md BUG log)
- Tier 8 design captured (self-evolving system) — deferred minimum 3-6 months until Tier 3 ships
- Task C (BUG-017) remains queued as next item
