# QA Engineering Standards
# Farhod Elbekov — Personal Reference
# Upload to any Claude Project to apply these standards instantly

---

## Stack defaults

| Layer | Tool | Notes |
|---|---|---|
| UI/API tests | Playwright TypeScript | POM structure always |
| AI output tests | Python pytest + httpx | Classes by category |
| Backend | Next.js 14 + TypeScript | API routes in /app/api |
| AI | Anthropic Claude Sonnet | claude-sonnet-4-20250514 |
| Database | Supabase PostgreSQL | RLS disabled for server routes |
| Hosting | Vercel | vercel --prod --force |
| CI/CD | GitHub Actions | Runs on every push to main |

---

## Project structure (every project)

```
project/
├── app/
│   ├── page.tsx
│   └── api/
│       └── [feature]/route.ts
├── tests/
│   ├── fixtures/
│   │   └── test-data.ts        ← all test data here, never hardcode
│   ├── api.spec.ts             ← API tests
│   ├── [feature].spec.ts       ← UI tests
│   ├── severity.spec.ts        ← severity/scoring tests
│   └── accessibility.spec.ts   ← WCAG 2.1 AA
├── tests/python/
│   ├── test_[feature]_api.py   ← pytest suite
│   ├── conftest.py
│   └── requirements.txt
├── .env.local                  ← never commit
├── CLAUDE.md                   ← project-specific context
└── QA_STANDARDS.md             ← this file
```

---

## Rules — three tiers

**MUST** = hard requirement, always apply, blocks CI if missing
**SHOULD** = default approach, override only with good reason
**OPTIONAL** = context-dependent, use when relevant

---

## Playwright test structure

### MUST
- Use `BASE_URL = process.env.BASE_URL || 'http://localhost:3000'`
- Use `test.setTimeout(90000)` for any test that calls an AI API
- Import all test data from `fixtures/test-data.ts`
- Validate HTTP status codes before asserting body content
- Group tests in `test.describe` blocks by category

### SHOULD
- Follow this describe block order per spec file:
  1. Request validation (400/200)
  2. Response schema (fields, types, enums)
  3. AI quality (correct output for known inputs)
  4. Hallucination detection (URLs, no placeholders)
  5. Language output (all fields, not just one)
  6. Severity/scoring logic
  7. Persistence (DB saved correctly)
- Use `CT-GenAI` label in test names for AI output tests
- Add `--grep "CT-GenAI"` tag to run only AI tests in CI

### OPTIONAL
- Add `--headed` flag when debugging locally
- Use `page.pause()` for interactive debugging

---

## Python pytest structure

### MUST
- Use `httpx` for HTTP requests (not `requests`)
- Group tests in classes: `TestRequestValidation`, `TestResponseSchema`, `TestAIQuality`, `TestHallucination`, `TestLanguageOutput`, `TestSeverityScoring`, `TestAdminQueue`
- Use `conftest.py` for BASE_URL and shared config
- Assert enums against `set` not `list`

### SHOULD
- Mirror server-side logic in helper functions (e.g. `get_severity()`)
- Print BASE_URL in `pytest_configure` so logs show which env was tested
- Use `TIMEOUT = 90.0` for all AI API calls

---

## AI/LLM testing — non-determinism rules

### MUST
- Never assert exact AI output — assert valid range or enum membership
- Always test schema first, then content
- Always test that fabricated/weak inputs are detected correctly
- Always test that authentic inputs are NOT incorrectly flagged

### SHOULD
- Run flaky AI tests with retry: `npx playwright test --retries=1`
- For consistency evals: run same input 3 times, assert all return same verdict enum

### Scoring rubric (0-1.0 scale)
| Score | Meaning |
|---|---|
| 1.0 | Fully correct, grounded, safe, matches golden dataset |
| 0.7 | Minor issues, still usable, no hallucination |
| 0.4 | Partial correctness, noticeable issues |
| 0.0 | Unsafe, incorrect, or hallucinated |

---

## Hallucination detection rules

### MUST
- Validate all URLs in AI responses are from approved domain list
- Assert no `[placeholder]`, `undefined`, or `null` in text fields
- Assert no duplicate references
- Assert suggested comments are non-empty and > 30 chars

### SHOULD
- Keep `VALID_SOURCE_DOMAINS` list in `test-data.ts` per project
- Use `VALID_SOURCE_DOMAINS.some(d => url.includes(d))` pattern

---

## Language output rules

### MUST
- Test ALL text fields for correct language, not just `suggested_comment`
- Fields to check: `claim_summary`, `analysis`, `red_flags`, `authentic_alternative`, `suggested_comment`
- Use character range assertions:
  - Uzbek/Russian Cyrillic: `/[\u0400-\u04FF]/`
  - Arabic: `/[\u0600-\u06FF]/`
- Always add keyword fallback OR Cyrillic/Arabic regex as safety net

### SHOULD
- Test that English mode does NOT contain Arabic or Cyrillic in `analysis`

---

## Severity scoring rules

### MUST
- Define severity function in `test-data.ts` that mirrors server logic exactly
- Test CRITICAL, HIGH, MEDIUM, LOW cases explicitly
- Assert authentic/no_hadith verdicts never return CRITICAL or HIGH
- Assert CRITICAL only appears with fabricated or weak verdicts

### Standard severity matrix (customize per project)
| Verdict | Confidence | Severity |
|---|---|---|
| fabricated | high | CRITICAL |
| fabricated | medium/low | HIGH |
| weak | high | HIGH |
| weak | medium/low | MEDIUM |
| authentic | any | LOW |
| no_hadith | any | LOW |
| unclear | any | MEDIUM |

---

## RAG testing rules

### MUST
- Test that retrieved context appears in response (groundedness)
- Test that model uses retrieved docs, not invented facts
- Test source attribution: references match retrieved documents
- Test retrieval with corrupted/missing chunks (graceful degradation)

### SHOULD
- Test recall@k: top-k results contain relevant document
- Test conflicting sources: model picks higher authority source
- Version eval datasets: `/evals/datasets/v1.json`

### Dataset structure
```json
{
  "version": "1.0",
  "items": [
    {
      "id": "001",
      "input": "query text",
      "expected_verdict": "fabricated",
      "expected_sources": ["sunnah.com"],
      "difficulty": "easy|medium|hard",
      "domain": "category"
    }
  ]
}
```

---

## Agentic system testing

### MUST
- Test tool calling: correct tool selected for task type
- Test failure handling: agent recovers from tool errors gracefully
- Test human-in-the-loop: escalation triggers fire correctly
- Set max_steps limit to prevent infinite loops
- Set max_tokens per task to control cost

### SHOULD
- Test multi-step workflows: each intermediate step produces valid output
- Test agent handoff: output from agent A is valid input for agent B
- Never auto-delete or auto-ban based on AI verdict alone

---

## MCP testing rules

### MUST
- Test context accuracy: MCP server returns correct data
- Test authorization: unauthorized requests rejected
- Test graceful degradation: app works when MCP unavailable

### SHOULD
- Test context boundaries: sensitive data not leaked to LLM
- Test tool schema: MCP tool definitions match actual behavior

---

## LLM-as-judge pattern

### SHOULD
- Use separate Claude call to score main Claude output
- Judge prompt must specify: criteria, scale (0-1.0), JSON output format
- Use `temperature=0` for judge calls
- Store scores in DB for trend tracking

### Judge prompt template
```
You are an evaluation judge. Score this AI response on a 0-1.0 scale.

Criteria:
- Correctness: is the verdict accurate?
- Groundedness: are claims supported by sources?
- Safety: is the response appropriate?
- Completeness: are all required fields populated?

Response to evaluate: {response}

Return JSON only: {"score": 0.0, "reason": "one sentence"}
```

---

## Prompt versioning

### SHOULD
- Store prompts in `/prompts/v{n}/{feature}.md`
- Each prompt file includes: system prompt, examples, changelog
- Bump version when prompt changes significantly
- Run regression evals after every prompt version change

---

## Security testing for AI systems

### MUST
- Test prompt injection: user input cannot override system prompt
- Test PII leakage: personal data not exposed in responses
- Test rate limiting: API rejects abuse (429 response)
- Test authentication: unauthorized requests return 401/403

### SHOULD
- Test jailbreak attempts: model stays within defined role
- Test indirect prompt injection via RAG: malicious doc cannot hijack agent
- Test tool injection: malicious tool call cannot exfiltrate data

---

## Accessibility testing

### MUST (UI projects only — skip for API-only projects)
- Use `@axe-core/playwright`
- Use `.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])`
- Run on every tab/page of the UI
- Always test mobile viewport (390x844)

### SHOULD
- Disable color-contrast in main suite, test separately with soft assertion
- Test RTL layout for Arabic/Hebrew content
- Assert touch targets minimum 36x36px on mobile

---

## Observability and logging

### MUST
- Log verdict distributions over time to detect model drift
- Use structured JSON logs for AI decisions:
```json
{
  "timestamp": "ISO8601",
  "input_hash": "sha256",
  "verdict": "fabricated",
  "confidence": "high",
  "severity": "CRITICAL",
  "score": 0.95,
  "latency_ms": 1240,
  "tokens_used": 850
}
```

### SHOULD
- Alert when hallucination rate exceeds threshold
- Track p95 latency trends after deployments
- Monitor token cost per request

---

## CI/CD standards

### MUST
- GitHub Actions runs on every push to main
- Never commit `.env.local` or API keys
- Always use service role key server-side, never anon key
- Run tests against production after deploy using `BASE_URL` env var

### SHOULD
- Separate fast tests (no AI calls) from slow tests (AI calls)
- Add `--retries=1` for flaky AI tests in CI
- Run fast tests first, slow tests second
- Cache `node_modules` and pip dependencies in CI

### CI test run order
1. Lint + type check (fastest)
2. Request validation tests (no AI, fast)
3. Schema tests (no AI, fast)
4. AI quality tests (slow, need API key)
5. Accessibility tests (medium)
6. Full E2E UI tests (slowest)

---

## Environment separation

| Setting | Local dev | CI | Production |
|---|---|---|---|
| BASE_URL | localhost:3000 | localhost:3000 | Vercel URL |
| Timeouts | relaxed | strict | n/a |
| Logging | verbose | structured JSON | structured JSON |
| Retries | 0 | 1 | n/a |
| AI calls | real | real | real |

---

## Claude Code workflow

### MUST
- Keep `CLAUDE.md` in every project root
- `CLAUDE.md` contains: project purpose, tech stack, API shape, severity rules, run commands, known issues

### SHOULD
- Use Claude Code for direct file editing instead of copy-paste
- Use MCP filesystem server for reading/writing test files
- Reference this file at start of any new project

---

## Project kickstart checklist

When starting a new project, do these in order:

- [ ] Create `CLAUDE.md` with project context
- [ ] Upload this `QA_STANDARDS.md` to Claude Project files
- [ ] Set up `.env.local` and `.env.example`
- [ ] Add `.env.local` to `.gitignore`
- [ ] Create `tests/fixtures/test-data.ts` with test data
- [ ] Write request validation tests first
- [ ] Write schema tests second
- [ ] Write AI quality tests third
- [ ] Write hallucination tests fourth
- [ ] Write language tests fifth (if multilingual)
- [ ] Write severity tests sixth (if scoring)
- [ ] Write accessibility tests last (UI projects)
- [ ] Set up GitHub Actions CI
- [ ] Deploy to Vercel
- [ ] Run full suite against production URL
- [ ] Update `CLAUDE.md` with known issues
