# Multi-Agent QA System — Idris Learning App

Seven language agents, Playwright trace recorder, Claude Sonnet 4.6 judge, bug reporter, and FP-logger.

## Architecture

```
orchestrator.spec.ts
  ├── LanguageAgent × 7 (EN, RU, UZ, TG, AR, ES, FR)
  │     ├── localStorage profile injection (bypass onboarding)
  │     ├── direction check (RTL for Arabic)
  │     ├── character encoding check (Cyrillic, Arabic scripts)
  │     ├── touch targets ≥ 72px (ASD override, CLAUDE.md)
  │     └── game launch check
  │
  ├── QAJudgeAgent (claude-sonnet-4-6, temp=0)
  │     └── scores each language 0.0–1.0 per QA_STANDARDS rubric
  │
  ├── BugReportAgent
  │     ├── Markdown reports → reports/bugs/*.md
  │     └── GitHub Issues JSON → reports/bugs/*.github.json
  │
  └── FPLoggerAgent
        └── auto-appends new patterns to FIX_PATTERNS.md
```

## Setup

```bash
cd tests/playwright/multi-agent
npm install
npx playwright install chromium
```

Set environment variable:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
export BASE_URL=http://localhost:3000   # or your Vercel preview URL
```

## Running

```bash
# Full orchestrator (all agents + AI judge + reports)
npm run test:orchestrator

# Individual language suite
npm run test:lang

# Accessibility only
npm run test:a11y

# Smoke tests (no AI calls, fast)
npx playwright test specs/orchestrator.spec.ts --grep "Smoke"

# View HTML report
npm run report
```

## Outputs

| Path | Contents |
|------|----------|
| `reports/html/` | Playwright HTML report with traces |
| `reports/traces/*.zip` | Playwright trace files (open with `npx playwright show-trace`) |
| `reports/screenshots/` | Per-language screenshots |
| `reports/bugs/*.md` | Markdown bug reports |
| `reports/bugs/*.github.json` | GitHub Issues payloads |
| `reports/bugs/SUMMARY.md` | Suite summary |
| `reports/results.json` | Raw test results |

## QA Judge Scoring (QA_STANDARDS.md)

| Score | Verdict | Meaning |
|-------|---------|---------|
| ≥ 0.7 | pass | Core functionality works |
| 0.4–0.69 | warn | Partial issues, investigate |
| < 0.4 | fail | Critical failure, block deploy |

## Touch Target Rule

CLAUDE.md overrides QA_STANDARDS.md: minimum **72px × 72px** (ASD children, not standard 44px).
All tests enforce this. No exceptions.

## Adding a New Language Agent

1. Add language to `LANGUAGES` array in `fixtures/test-data.ts`
2. Verify entry exists in `LANGS_CFG` in `index.html`
3. Language agent and orchestrator pick it up automatically (no other changes)
