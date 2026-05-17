# AGENTS.md — idris-learning-app
# Agent orchestration rulebook + session log
# Per QA_STANDARDS_AGENT_RULES.md Section 8.5
# Read before every Claude session
# Last updated: 2026-05-17 (added Workflow Rule: One Task at a Time)

---

## Active Agents

| Agent | File | Role | Status |
|-------|------|------|--------|
| fix-agent | tests/playwright/multi-agent/agents/fix-agent.ts | Applies code fixes | ✅ Built |
| verify-agent | tests/playwright/multi-agent/agents/verify-agent.ts | Playwright tests | ✅ Built + CI wired |
| language-agent | tests/playwright/multi-agent/agents/language-agent.ts | EN/RU/TG/UZ/AR/ES/FR | ✅ Built + CI wired |
| docs-agent | tests/playwright/multi-agent/agents/docs-agent.ts | CHANGELOG + AGENTS.md | ✅ Built + CI wired |
| log-agent | tests/playwright/multi-agent/agents/log-agent.ts | bug-queue.json | ✅ Built + CI wired |
| base-agent | tests/playwright/multi-agent/agents/base-agent.ts | Shared test logic | ✅ Built |

## CI Pipeline (GitHub Actions)

```
Push to main
    │
    ├── Job 1: TypeScript Check (warning only)
    ├── Job 2: verify-agent — 17 Playwright iPad tests ← BLOCKS DEPLOY IF RED
    ├── Job 3: log-agent — bug-queue.json artifact
    └── Job 4: docs-agent — CHANGELOG auto-commit

Manual dispatch:
    └── Job 5: language-agent — EN/RU/TG/UZ/AR/ES/FR full suite
```

## Pre-push Protocol (MANDATORY)

```powershell
cd C:\QA\Idris\idris-learning-app
npx playwright test --project=ipad          # must be green
git add {specific files — NEVER git add .}
git commit -m "type: description [vX.X.X]"
git push origin main
```

## Commit Message Format

```
{type}: {description} [vX.X.X]
Types: feat | fix | docs | test | refactor | chore | ci

Examples:
  feat: rocket fuel bar + video popup [v1.60.0]
  fix: singAlong opens vidPopup [v1.60.1]
  ci: smart push gate — agents wired [HR pattern]
  test: match-pairs CI emoji selector fix [v1.60.5]
```

## Never Do

- `git add .` — always name specific files
- Push with API keys (GitHub blocks + must rotate)
- Use Set-Content PowerShell for UTF-8 emoji files → use Python or VS Code
- Use emoji getByText() selectors in CI specs → use CSS class selectors
- Call real Supabase/Claude API in CI push tests
- Use .tap() in desktop-chrome project → use hasTouch:true instead
- **Dump multi-step pipelines on the user** → one task at a time (see Workflow Rule below)

## 🚦 Workflow Rule — ONE TASK AT A TIME (Farhod's Rule)

This rule overrides convenience. Violated repeatedly in session 2026-05-17 → made explicit.

- **Give ONE task per response.** No multi-step pipelines, no "and then", no "while you're at it".
- **After giving the task, STOP.** Wait for explicit confirmation that it completed and what the result was.
- **Only after confirmation, give the next task.** Never assume a previous task succeeded — confirmation is the user's word, not inference.
- **Exception:** atomic command groups belong together (e.g. `git add X && git commit -m Y && git push` is one task).
- **Overview requests:** if the user asks for a full plan, give the plan WITHOUT executing — then revert to one-task-at-a-time when they say "go".
- **Why:** pipelines hide failures, lose state, and force the user to track what worked. One-at-a-time keeps both sides honest.

See also: CLAUDE.md Rule 7, AGENTS.md "For Claude" self-rule #10.

## Agent Run Commands

```powershell
cd tests\playwright\multi-agent

# Individual language agents
npm run test:en
npm run test:ru
npm run test:tg

# Full suite
npm test -- --workers=1

# Docs agent (run after every fix)
npx ts-node agents\docs-agent.ts --version "1.60.5" --type "fix" --description "your fix"

# Log agent (run after test suite)
npx ts-node agents\log-agent.ts
```

## Playwright Spec Notes

| Spec | Tests | Key Selectors | Notes |
|------|-------|---------------|-------|
| touch-targets.spec.ts | 3 | `#ob-lang-grid .lang-card` | goStep(0) to reset |
| match-pairs.spec.ts | 3 | `.match-card`, `#modesGrid .mode-card.match` | NO emoji getByText |
| match-card-size.spec.ts | 6 | `.match-card`, `#match-grid` | Math.round() for float |
| language-switcher.spec.ts | 5 | `.lang-btn`, `#langSheetGrid .sheet-opt` | filter by text label |
| accessibility.spec.ts | 6 | axe-core + 72px checks | continue-on-error in CI |

## Session Log

---

### Session: 2026-05-16 (Farhod + Claude)

**Duration:** Full day session

**Completed:**
- Fixed Continue button grayed out (renderLangScreen fix)
- Rotated Anthropic API key (was committed to git)
- Cleaned git history with git filter-repo
- 17/17 Playwright iPad tests passing locally
- Colors + Food seeded EN/RU/TG (6 items each)
- API category filter fixed (/api/content-handler)
- Match card size fixed (3×110px inline grid)
- Language switcher tests 5/5
- Multi-agent 51/75 passing (ipad-safari all green)
- BUG-01: iOS TTS fix (voiceschanged + 500ms fallback)
- BUG-02: Match game shuffle (30 pairs rotating)
- Rocket fuel bar → fills toward 10-star milestone
- Video popup panel → fetches from reward_videos Supabase table
- Extended counting → 1-10 unlocks to 1-1000 by stars
- 30 match pairs → animals, colors, shapes, vehicles
- GitHub Actions CI → 5-job smart push gate
- docs-agent.ts + log-agent.ts → built and wired to CI
- Scanned hadith-reels CI → applied HR patterns to Idris
- agent-upskilling.md → tool scouting (Supertonic, OpenUI, etc.)
- accessibility.spec.ts → WCAG 2.1 AA + 72px ASD tests

**Pending (post-Hajj):**
- CI verify-agent green (match-pairs emoji selector fixes in progress)
- Page Object Model (POM) for shared onboarding fixture
- Drag and drop shapes game
- Colors + Food games in main UI
- Doctor portal (Ms. Brower Kaitlin)
- Progress tracking (child_progress table)
- Gavkhar voice note → Whisper transcription → content fixes
- Anthropic prompt caching (agent-upskilling.md Candidate 6)
- Lighthouse CI + axe-core in every push
- OpenAI Nova TTS for UZ/TJ (HR P071 pattern)
- Weekly PDF progress report for doctor
- ElevenLabs voice enrollment (Mama, Papa, Deda, Babushka)

**Hajj break:** 2026-05-19 → 2026-06-06
**Next session:** 2026-06-06

---

## For Claude (Self-Rules Going Forward)

Per QA_STANDARDS_AGENT_RULES.md — every session must:

1. Run docs-agent at END of session — not just build it
2. Update CHANGELOG.md with every fix in same commit
3. Update AGENTS.md session log before closing
4. Save all code as .md files for download — not direction instructions
5. Use Python (not PowerShell Set-Content) for UTF-8 file writes
6. Use CSS selectors not emoji text in Playwright specs
7. Check HR/HV repos for new patterns at START of every session
8. Log every fix pattern discovered to FIX_PATTERNS.md
9. Never give "directions" — give ready-to-paste complete files
10. **ONE TASK AT A TIME** (Farhod's rule) — Give ONE task per response. STOP. Wait for explicit confirmation of completion + result before giving next task. No pipelines. No "and then". Atomic git groups (add+commit+push) count as one task. See full rule above in "Workflow Rule" section.
