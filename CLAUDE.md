# CLAUDE.md
# Project constitution for idris-learning-app
# Auto-loaded by Claude Code on every session
# Last updated: 2026-05-17 (added Rule 7: One Task at a Time)

---

## 🧑 WHO

**Developer:** Farhod Elbekov — SDET / AI QA Engineer, Charlotte NC
**Stack:** Vanilla HTML PWA + Supabase + Vercel + Playwright TS + Claude API
**For:** Idriszhon, age 5, ASD, Dushanbe Tajikistan
**Family:** Mama Gavkhar, Deda Farhod, ABA therapist Ms. Brower Kaitlin (Mon-Fri)
**Certifications:** ISTQB CT-AI, CTFL v4.0, CT-GenAI (in progress), CCA Foundations (in progress)

---

## 🎯 PROJECT GOAL

ASD learning app for Idris with: counting (1-1000), match pairs (30 themes), speak words, family challenges, AAC talk board, rocket fuel reward system, YouTube video rewards by task type, multi-language (EN/RU/TG/UZ/AR/ES/FR).

**Live:** https://idris-learning-app.vercel.app
**Repo:** github.com/Farhod75/idris-learning-app

---

## 🚨 HARD RULES (NEVER VIOLATE)

### 1. File Encoding
- **NEVER use PowerShell `Set-Content` with `-Encoding UTF8`** — it adds BOM that corrupts emojis.
- **ALWAYS use Python** (`open('file','w',encoding='utf-8')`) or VS Code direct edit.
- **NEVER use `.tap()`** in desktop-chrome project. Use `hasTouch:true` instead.

### 2. Playwright Selectors
- **NEVER use emoji `getByText('🇬🇧')`** — breaks in GitHub Actions CI.
- **ALWAYS use CSS class selectors** like `.lang-card.first()` or `#modesGrid .mode-card.match`.
- **NEVER use `.game-title`** alone — too broad. Use `#count-title`, `#match-title`, etc.

### 3. Touch Targets (ASD Override)
- **72px minimum** for all interactive elements (NOT WCAG's 44px).
- Apply to: language cards, mode cards, family pills, nav buttons, match cards, count options.

### 4. No Countdown Timers
- Children with ASD experience anxiety from countdown timers. Use progress bars instead.

### 5. Sensitive Files
- **`.claude/settings.local.json` must be in `.gitignore`** — contains API keys.
- If accidentally committed: `git filter-repo --path .claude --invert-paths --force` + rotate key at console.anthropic.com.

### 6. CI Compatibility
- Tests must pass on iPad WebKit project (Ubuntu CI runner).
- Multi-agent suite uses Vercel prod URL: `BASE_URL=https://idris-learning-app.vercel.app`.
- `tsconfig.json` MUST include `"DOM"` in `lib` array.

### 7. One Task at a Time
- **Give ONE task per response.** No multi-step pipelines, no "and then", no "while you're at it".
- **After giving the task, STOP.** Wait for explicit confirmation that it completed and what the result was.
- **Only after confirmation, give the next task.** Never assume a previous task succeeded — confirmation is the user's word, not inference.
- **Exception:** atomic command groups belong together (e.g. `git add X && git commit -m Y && git push` is one task).
- **Overview requests:** if the user asks for a full plan, give the plan WITHOUT executing — then revert to one-task-at-a-time when they say "go".
- **Why:** pipelines hide failures, lose state, and force the user to track what worked. One-at-a-time keeps both sides honest.

---

## 🧰 STACK & FILES

### Core
- `index.html` (~100KB) — main PWA, all game logic, reward overlay, video popup
- `api/content.ts`, `api/content-handler.ts` — Supabase content API
- `api/videos.ts` — reward video API by task type
- `seed.sql`, `002_consent_and_privacy.sql` — Supabase schema + seed

### Tests
- `tests/playwright/fixtures/onboarded.ts` — POM fixture (`onboardedPage` + `freshPage`)
- `tests/playwright/touch-targets.spec.ts` — 6 tests
- `tests/playwright/match-pairs.spec.ts` — 5 tests
- `tests/playwright/match-card-size.spec.ts` — 6 tests
- `tests/playwright/language-switcher.spec.ts` — 6 tests
- `tests/playwright/accessibility.spec.ts` — axe-core + 72px (warning only in CI)
- `playwright.config.ts` — projects: desktop, iphone14, ipad (gen7)

### Multi-Agent
- `tests/playwright/multi-agent/agents/` — base, language, fix, verify, log, docs
- `tests/playwright/multi-agent/playwright.config.ts` — language projects EN/RU/TG/UZ/AR/ES/FR

### CI
- `.github/workflows/ci.yml` — 5 jobs: typecheck, verify-agent, log-agent, docs-agent, language-agent
- `.github/workflows/deploy.yml` — Vercel deploy

### Documentation
- `AGENTS.md` — session log, agent rules, pending work
- `CHANGELOG.md` — version history (v1.59.x → v1.60.x)
- `FIX_PATTERNS.md` — 9+ documented fix patterns
- `ABOUT.md` — project context

---

## 📋 PRE-FLIGHT CHECKLIST (Run at START of every session)

```bash
# 1. Read constitution
cat CLAUDE.md AGENTS.md FIX_PATTERNS.md

# 2. Check repo state
git status
git log --oneline -5

# 3. Check CI status
# https://github.com/Farhod75/idris-learning-app/actions

# 4. Verify deployed file matches local
python -c "data=open('index.html','rb').read(); print('BOM:', data[:3].hex()); print('Size:', len(data))"
# Expected: BOM 3c2144 (no BOM), Size ~100000 bytes
```

---

## 🔁 STANDARD WORKFLOWS

### Workflow A — Fix a bug
1. Reproduce the bug locally first
2. Search FIX_PATTERNS.md for similar pattern
3. Write/update a Playwright test that reproduces it
4. Apply the fix
5. Run tests: `npx playwright test --project=ipad`
6. Update FIX_PATTERNS.md with the new pattern (if novel)
7. Update CHANGELOG.md with version bump
8. Commit: `git commit -m "fix: description [vX.X.X]"`
9. Push: `git push origin main`

### Workflow B — Add a new feature
1. Update CLAUDE.md with the feature's hard rules
2. Write Playwright tests FIRST (TDD)
3. Implement in `index.html` or API
4. Test on iPad project locally
5. Commit + push
6. Verify CI green before declaring done

### Workflow C — Pre-deploy verification
```bash
npx playwright test --project=ipad
# Must be 17/17 green before push
```

---

## 🤖 AGENTS (auto-loaded)

| Agent | Trigger | Action |
|-------|---------|--------|
| **verify-agent** | Every push | Runs 17 Playwright iPad tests; BLOCKS deploy if red |
| **log-agent** | After verify-agent | Parses results → `bug-queue.json` artifact |
| **docs-agent** | After verify-agent (push only) | Auto-commits CHANGELOG update |
| **language-agent** | Manual dispatch | Full EN/RU/TG/UZ/AR/ES/FR suite against prod |

---

## 🐛 BUG LOG (auto-updated by Claude Code)

When fixing a bug, Claude Code MUST append an entry here:

### Format
```
## [DATE] BUG-### — Short description
**Symptom:** what user/test saw
**Root cause:** technical reason
**Fix:** what changed
**Files:** comma-separated paths
**Pattern:** P-XXX (if added to FIX_PATTERNS.md)
**Version:** vX.X.X
```

### Active log

<!-- Claude Code: prepend new bug entries below this line -->

## [2026-06-14] BUG-016 — Do This Now + Sing Along don't open video popups
**Symptom:** Tapping Sing Along strip spoke song name but never opened video panel; tapping Do This Now dots showed checkmark + "Yes!" but never opened video panel
**Root cause:** `singAlong()` and `tapDot()` had no calls to `openVidPopup()` or `loadRewardVideos()`
**Fix:** `singAlong()` now calls `loadRewardVideos('sing'); openVidPopup()` after existing behavior; `tapDot()` now calls `loadRewardVideos('do_now'); openVidPopup()` inside the all-dots-complete branch
**Files:** index.html
**Version:** v1.63.0


## [2026-06-15] BUG-016 — fix: migrate .claude/settings.json hooks to new schema (matcher/hooks arrays)
**Commit:** e3d569f
**Type:** fix
**Files:** .claude/settings.json
**Version:** v1.62.2
**Auto-logged:** by Claude Code Stop hook


## [2026-06-15] BUG-015 — fix: migrate .claude/settings.json hooks to new schema (matcher/hooks arrays)
**Commit:** e3d569f
**Type:** fix
**Files:** .claude/settings.json
**Version:** v1.62.2
**Auto-logged:** by Claude Code Stop hook


## [2026-06-15] BUG-014 — fix: migrate .claude/settings.json hooks to new schema (matcher/hooks arrays)
**Commit:** e3d569f
**Type:** fix
**Files:** .claude/settings.json
**Version:** v1.62.2
**Auto-logged:** by Claude Code Stop hook


## [2026-05-17] BUG-013 — Match cards too wide on desktop
**Symptom:** match-grid stretches to ~500px wide on desktop, 2 cards visible
**Root cause:** CSS grid-template-columns: repeat(3, 1fr) expands without max-width
**Fix:** Apply inline style in renderMatchGrid(): grid-template-columns: repeat(3, 110px); width: 354px
**Files:** index.html
**Pattern:** P-UI-01
**Version:** v1.60.x

## [2026-05-17] BUG-012 — Watch reward opens YouTube new tab instead of vidPopup
**Symptom:** Tapping Watch reward redirects to YouTube search page
**Root cause:** Button onclick not set OR points to openVideoReward() instead of openVidPopup()
**Fix:** Ensure `onclick="openVidPopup()"` on Watch reward button
**Files:** index.html line ~578
**Version:** v1.60.6 (attempted, may need re-verification)

## [2026-05-17] BUG-011 — Do This Now dot not clickable
**Symptom:** Tapping the green dot does nothing
**Root cause:** tapDot(${i}) onclick may have stale closure or HTML attribute quote conflict
**Fix:** Ensure escaped quotes in onclick: `<div class="act-dot" onclick="tapDot(${i})"></div>`
**Files:** index.html ~line 1435
**Version:** v1.60.x

## [2026-05-17] BUG-010 — UTF-8 BOM corrupting emojis
**Symptom:** All emojis render as `ðŸš€` on live app after PowerShell edits
**Root cause:** PowerShell Set-Content -Encoding UTF8 adds UTF-8 BOM (EF BB BF)
**Fix:** Use `git cat-file blob <commit>:index.html | python -c "open('index.html','wb').write(sys.stdin.buffer.read())"` to restore clean version
**Files:** index.html
**Pattern:** P-ENC-01
**Version:** v1.60.12

---

## 🌐 KEY URLS

- Live app: https://idris-learning-app.vercel.app
- Repo: https://github.com/Farhod75/idris-learning-app
- CI: https://github.com/Farhod75/idris-learning-app/actions
- Supabase project: bdwgjoaizyxqokmfehgj
- Anthropic console: https://console.anthropic.com

---

## 🕋 NOTES

- **Farhod on Hajj:** 2026-05-19 → 2026-06-06
- **Next session after Hajj:** start with reading CLAUDE.md + AGENTS.md + FIX_PATTERNS.md
- **Gavkhar's device:** iPhone (Dushanbe) — iOS Safari TTS is the priority
- **Idris's therapy:** ABA with Ms. Brower Kaitlin, Monday-Friday

---

## 🛠️ AUTO-LOGGING PROTOCOL

When Claude Code starts work on a bug, it MUST:

1. **Before writing any code** — append a `[WIP]` entry to BUG LOG section above
2. **After fix passes tests** — update entry to `[DONE]` with final files/pattern/version
3. **If novel pattern** — also append to `FIX_PATTERNS.md` with full template
4. **At end of session** — append summary to `AGENTS.md` Session Log section
5. **Commit message** — must include `[vX.X.X]` semver tag and reference BUG-###

This file is the single source of truth. Treat it as code, not docs.
