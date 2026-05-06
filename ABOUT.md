# ABOUT.md — Farhod Elbekov
# Upload this file to every new Claude Project so Claude instantly knows
# who I am, what I build, how I work, and what standards to apply.
# Pattern inspired by: github.com/Farhod75/engineering-standards

---

## Who I Am

**Farhod Elbekov** — SDET / AI QA Engineer / Full Stack Builder
- Location: Charlotte, NC (Cornelius)
- Email: felbek75@gmail.com
- GitHub: github.com/Farhod75
- LinkedIn: linkedin.com/in/farhod-elbekov-167324219

**Certifications (earned):**
- ISTQB® CT-AI (Certified Tester AI Testing) — March 2026 | ID: 26-CT-AI-00063-USA
- ISTQB® CTFL v4.0 — February 2026

**Certifications (in progress):**
- ISTQB CT-GenAI
- Claude Certified Architect (CCA) Foundations — Anthropic
- AWS Bedrock / AI-ML Learning Path

---

## My Tech Stack

### Languages
- TypeScript, JavaScript, Python, Java, SQL

### Test Automation
- Playwright (TypeScript + Python) — primary framework
- pytest, pytest-bdd
- Selenium WebDriver, TestNG
- Page Object Model (POM), data-driven testing
- axe-core (WCAG 2.1 AA accessibility)

### AI / GenAI
- Anthropic Claude API (claude-sonnet-4-6)
- Prompt engineering, LLM output validation
- Hallucination detection, non-determinism testing
- Severity scoring, CT-GenAI test patterns
- AWS Bedrock (learning)

### Frontend / Full Stack
- Next.js 14 (App Router), React, TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- Vercel (hosting), Railway (bots)

### API & Backend
- REST API testing, Postman, Newman
- FastAPI, Pydantic
- Playwright request fixture
- HTTP assertions + DB state validation

### CI/CD & Tools
- GitHub Actions, Jenkins
- Git, GitHub
- Jira, Confluence
- VS Code, PowerShell (Windows environment)

### Databases
- Supabase (PostgreSQL), MySQL, SQL Server
- Teradata, Oracle (ETL/enterprise)

---

## My Projects

### 1. Hadith Verifier App (flagship)
- **Repo:** github.com/Farhod75/hadith-verifier
- **Live:** hadithverifier.com
- **Stack:** Next.js 14, TypeScript, Anthropic Claude API, Supabase, Vercel, Tailwind CSS
- **What:** AI tool detecting fabricated/weak hadiths on social media (FB, Instagram, WhatsApp)
- **Features:** Multi-tab UI (Analyze / Dua Corrector / Sources / Admin Queue), 5 languages (EN/UZ/AR/RU/TJ), severity scoring (CRITICAL/HIGH/MEDIUM/LOW), Telegram + Slack alerts, OCR via Claude Vision, human-in-the-loop admin moderation
- **Tests:** 180 Playwright (TypeScript) + 36 pytest (Python) — CT-GenAI aligned
- **Built as sadaqah jariyah — free, no ads, for the Muslim community**

### 2. Enterprise AI Testing Suite
- **Repo:** github.com/Farhod75/ai-testing-enterprise
- **Stack:** Python, pytest, Anthropic Claude API, FastAPI, Playwright, GitHub Actions
- **What:** 5-phase AI testing framework (135 tests) — Unit, Component, Integration, System, E2E
- **Includes:** LLM evaluation harness scoring Claude responses on correctness, safety, consistency (0–1.0 scale)

### 3. ISTQB CT-AI & CT-GenAI Exam Prep App
- **Repo:** github.com/Farhod75/ct-ai-exam-prep
- **Stack:** Next.js 14, TypeScript, PostgreSQL, Prisma ORM, NextAuth.js, Google Analytics 4
- **What:** Full-stack exam prep app — 420+ questions, 271 flashcards, timed mock exams, 14-day study plan

### 4. AI Accessibility Testing
- **Repo:** github.com/Farhod75/ai-a11y-testing
- **Stack:** Claude API + Playwright + axe-core
- **What:** AI-powered WCAG 2.1 AA accessibility testing

### 5. Moody Playwright Assessment
- **Repo:** github.com/Farhod75/moody-playwright-assessment
- **Stack:** Playwright TypeScript, Page Object Model
- **What:** E2E test suite for financial services treasury app (ACH, Wires, Positive Pay)
- **Pattern:** Full POM structure — LoginPage, DashboardPage, TransactionPage, BasePage

### 6. Moody API Postman Suite
- **Repo:** github.com/Farhod75/moody-api-postman-suite
- **Stack:** Postman, Newman, CI
- **What:** 11 requests, 38 assertions, CI-integrated

### 7. Engineering Standards
- **Repo:** github.com/Farhod75/engineering-standards
- **What:** Personal QA standards for AI, RAG, agentic systems — uploaded to every Claude Project

### 8. Banking App Playwright Suite
- **Repo:** github.com/Farhod75/Banking-app-Playwright-Typescript
- **Stack:** Playwright TypeScript, POM, GitHub Actions
- **What:** API + E2E UI tests for banking app

---

## How I Work — Preferences & Principles

### Communication Style
- Give me **detailed, explicit step-by-step instructions** — I prefer not to ask twice
- Tailor commands to **Windows PowerShell + VS Code** environment
- Use **practical code examples with explanations** — not just theory
- Build iteratively: prototype → scaffold → deploy → add features

### Code Standards
- **TypeScript** for all Next.js / Playwright work
- **Python** for pytest, AI testing, agents, ETL validation
- **Never change working code during debugging** — isolate the real issue first
- **Inline critical logic in route.ts** rather than external module imports (avoids Vercel build issues)
- Check billing/API key status early when debugging 500 errors
- BOM characters can silently corrupt JSON config files on Windows — use PowerShell rewrites

### Testing Principles (ISTQB CT-AI / CT-GenAI aligned)
- Every new feature gets Playwright tests before moving on
- AI output validation: verdict, confidence, severity, language, references
- Non-determinism: use `temperature: 0` for deterministic verdicts
- Always test: happy path + edge cases + injection attempts + language variants
- `test.skip(!!process.env.CI, 'reason')` for tests that can't run in CI

### Architecture Principles
- AI flags content, **humans make all final decisions** — no auto-delete, no auto-ban
- Prompt-based AI (not RAG) for hadith verification — Claude's training knowledge is the source
- Supabase stores flagged posts AFTER analysis (admin queue only, not source of truth)
- Rate limiting: 100 requests/day/IP — generous for real users, blocks abuse
- Security: sanitizeInput() + validateOutput() + TRUSTED_DOMAINS whitelist

---

## Source Authority System (Hadith Verifier)

- **Tier 1:** Dorar.net, Sunnah.com, HadeethEnc.com
- **Tier 2:** IslamQA.info, IslamWeb.net, Yaqeen Institute, Islamhouse.com
- **Tier 3:** HadithAPI.com, AboutIslam.net, AlSunnah.com

---

## Fix Patterns Knowledge Base

I maintain `fix_patterns.md` in the hadith-verifier repo — 32+ patterns extracted from CI runs, each with root cause, fix, and test reference. Key patterns:

- **P001:** Empty references array → add CRITICAL instruction in prompt
- **P011:** Flaky tests in CI → add `test.skip(!!process.env.CI)`
- **P029:** UZ language switches Latin/Cyrillic → assertion accepts both scripts
- **P032:** No rate limiting → add rateLimitMap + checkRateLimit() to route.ts

---

## Professional Background

| Period | Company | Role |
|--------|---------|------|
| 2025–Present | Freelance | AI QA / SDET — building portfolio projects |
| 2022–2024 | Wells Fargo (via Strategic Staffing) | QA Automation / ETL Tester |
| 2021–2022 | Truist (via The Select Group) | QA Automation — Playwright TypeScript |
| 2018–2021 | TIAA (via Synechron) | QA / ETL — Big Data (Hadoop, Hive, Teradata) |
| 2016–2018 | Voya Financial | QA — Multi-asset trading platform |
| 2015–2016 | Assurant | QA — Equity trading web app |

**Domain expertise:** Banking, Treasury Management, Capital Markets, Insurance, Islamic Finance

---

## Education

- BS Computer Science — Volgograd State Technical University
- MS Finance & Econometrics — Technological University of Tajikistan
- PhD Economics (Macroeconomics) — Tajik State University of Commerce

---

## Languages Spoken

- English (professional)
- Uzbek (native)
- Russian (fluent)
- Tajik (fluent)
- Arabic (reading — Islamic studies)

---

## Current Learning Goals (2026)

1. Claude Certified Architect (CCA) Foundations
2. ISTQB CT-GenAI certification
3. AWS Bedrock for Claude deployment
4. DeepLearning.AI — Prompt Engineering + Agentic AI Systems
5. MCP (Model Context Protocol) for Claude Code
6. Agentic AI workflows and multi-agent systems
7. RAG systems — from scratch to production (see roadmap below)

---

## RAG Learning Roadmap (2026)

**Goal:** Build real production-level RAG systems for portfolio AND job interviews.
**Stack preference:** Python + Claude API + Supabase pgvector + Next.js
**Inspired by:** 10 RAG Projects for Portfolio framework

### Phase 1 — Foundation (Start here)
**Project: First RAG System from Scratch**
- Build a basic RAG pipeline manually — no LangChain, no abstractions
- Stack: Python + Claude API + FAISS or Supabase pgvector
- Input: PDF/text documents → chunk → embed → store → retrieve → Claude generates answer
- Goal: Understand every step before using frameworks
- Real use: Upgrade hadith-verifier to search authenticated hadith PDFs from Dorar.net
- Interview angle: "I built RAG from scratch before using frameworks — I understand embeddings, chunking strategies, similarity search, and context window management"

### Phase 2 — Document Intelligence
**Project: Document Analysis (LLM + PDF Processing)**
- Stack: Python + Claude API + PyPDF2/pdfplumber + Supabase
- Input: Islamic source PDFs (Bukhari, Muslim collections) → extract → analyze → answer questions
- Real use: Allow hadith-verifier to reference actual PDF source books, not just URLs
- Interview angle: "I built document intelligence pipelines handling multi-page PDFs with Claude Vision for scanned pages"

### Phase 3 — Scale
**Project: Multi-Document RAG with Vector Database**
- Stack: Python + Supabase pgvector + Claude API + embeddings (voyage-ai or text-embedding-3)
- Input: Multiple hadith collections → unified vector store → semantic search across all sources
- Real use: hadith-verifier v2 — search across Bukhari, Muslim, Abu Dawud simultaneously
- Interview angle: "I designed vector database schemas with pgvector, implemented hybrid search (semantic + keyword), and managed embedding costs"

### Phase 4 — Production Patterns
**Project: IBM RAG Guided — Production Patterns**
- Learn: chunking strategies, reranking, hybrid search, evaluation metrics (RAGAS)
- Add RAG evaluation to test suite — test retrieval quality, answer faithfulness, context relevance
- Real use: QA testing RAG systems — directly maps to CT-GenAI certification patterns
- Interview angle: "I test RAG systems using RAGAS metrics — retrieval precision, answer faithfulness, context recall"

### Phase 5 — Agentic
**Project: Agentic RAG + LangChain RAG Agent**
- Stack: Python + LangChain/LlamaIndex + Claude API + Supabase
- Build: Agent that decides WHEN to retrieve vs when to answer from memory
- Real use: Auto-Fix Agent upgrade — agent retrieves from fix_patterns.md RAG store before generating fixes
- Interview angle: "I built agentic RAG where the LLM decides retrieval strategy — not just naive always-retrieve"

### Phase 6 — Advanced (Stretch Goals)
| Project | Stack | Real Use |
|---|---|---|
| GraphRAG Pipeline | Python + Neo4j or NetworkX + Claude | Map hadith narrator chains as knowledge graph |
| Multimodal RAG | Claude Vision + pgvector | Process hadith screenshots + text together |
| Real-Time RAG | Streaming + Supabase realtime | Live hadith verification as user types |
| AI Research Agent | Claude + RAG + web search | Auto-research new hadiths from trusted sources |

### RAG Testing Standards (CT-GenAI aligned)
When I build RAG systems I test:
- **Retrieval quality:** Are the right chunks retrieved? (precision@k, recall@k)
- **Answer faithfulness:** Does the answer stick to retrieved context? (no hallucination)
- **Context relevance:** Is retrieved context actually relevant to the question?
- **Chunk boundary testing:** Do answers degrade at chunk boundaries?
- **Injection resistance:** Can retrieved content manipulate the LLM?
- **Latency:** Embedding + retrieval + generation pipeline performance

### RAG Interview Talking Points
- "I understand the difference between naive RAG, advanced RAG, and modular RAG"
- "I've tested RAG systems — retrieval quality is a separate concern from generation quality"
- "I chose Supabase pgvector over Pinecone for my projects because it unifies the app DB and vector store — fewer moving parts in production"
- "I build RAG tests first — RAGAS evaluation before the feature, same as TDD"
- "My hadith-verifier started prompt-based — I'm building the RAG upgrade as a separate branch to compare quality"

---

## Local Model Strategy — Gemma 4 / Qwen 3.6 + Pi Agent

**Philosophy:** Use the right model for the right job. Claude Code is the gold standard
for accuracy and safety — but it is expensive and system-heavy. Local models paired
with lightweight agents give faster, cheaper iteration for exploration and prototyping.
This is not "Claude vs local" — it is a portfolio strategy.

### The Core Decision Framework

| Situation | Use | Why |
|---|---|---|
| Prototyping, exploring, "vibing" | Gemma 4 + Pi locally | Free, fast, zero API cost |
| High-volume repetitive tasks | Qwen 3.6 Plus | ~5x cheaper than Claude, 1M context |
| Critical production code | Claude Sonnet/Opus | Highest accuracy, safety checks, reliable tool use |
| Multilingual output (UZ/AR/RU/TJ) | Qwen 3.6 Plus | 119 language training, strong Cyrillic/Arabic |
| Privacy-sensitive / offline | Gemma 4 local | Apache 2.0, runs on consumer hardware, no API calls |
| Long agent loops (20+ tool calls) | Claude | Best recovery from failures, coherence over long sessions |
| Multimodal (image + text + audio) | Gemma 4 | Native trimodal architecture |

### Model Profiles

**Gemma 4 (Google DeepMind — Apache 2.0)**
- Sizes: 2B, 4B, 12B, 31B — runs on consumer GPU/CPU
- Architecture: Mixture-of-experts — 31B activates only ~9B params at inference
- Strengths: Local deployment, multimodal (text + image + audio), Apache 2.0 (commercial safe), 140+ languages
- Best for: Offline/private work, rapid prototyping, hardware-constrained environments
- Run with: Ollama (`ollama run gemma4`) — zero setup
- Limitation: Weaker than Qwen on very long context agentic loops

**Qwen 3.6 Plus (Alibaba — Apache 2.0)**
- Context: 1M tokens (vs Claude's 200K)
- Hybrid thinking: Toggle between fast mode and chain-of-thought reasoning per task
- Strengths: Frontier-competitive benchmarks, multilingual (119 languages), native function calling, 65K output tokens
- Cost: ~$10–30 per 10M tokens vs Claude's $150–250 — roughly 5–10x cheaper
- Best for: High-volume pipelines, multilingual output, batch code generation, testing
- Free tier: Available on OpenRouter at no cost
- Limitation: Occasional edge cases Claude handles more reliably

**Pi (Lightweight Agent)**
- What it is: A minimal agentic shell that pairs with local models — lower overhead than Claude Code
- Best for: "Vibe coding" — fast exploration, directory-level tasks, quick scripts
- Why use it: No subscription cost, works offline, pairs naturally with Ollama + Gemma/Qwen
- Limitation: Less robust safety checking than Claude Code, no built-in CLAUDE.md awareness

### When to Use What — Practical Rules

```
Starting a new feature / exploring architecture?
  → Gemma 4 + Pi locally — zero cost, fast iteration

Need multilingual output (UZ/AR/RU/TJ) at scale?
  → Qwen 3.6 Plus — best multilingual open model, cheap API

Writing production route.ts / critical auth / security logic?
  → Claude Sonnet — accuracy matters more than cost here

Running 100+ test generations or batch analysis?
  → Qwen 3.6 Plus — 1M context handles entire test suites, low cost

Need to work offline or keep data private?
  → Gemma 4 local via Ollama — no API calls, Apache 2.0 safe

Long agentic loop (Playwright Auto-Fix Agent, CI pipeline)?
  → Claude — best recovery from tool failures, most coherent over 20+ calls

Quick script, one-off file edit, directory cleanup?
  → Pi + Gemma 4 locally — overkill to use Claude for this
```

### Interview Talking Points — Local Models
- "I use a tiered model strategy — Claude for critical paths, Qwen 3.6 for high-volume work, Gemma 4 for local/private tasks"
- "I understand the cost tradeoffs — Claude is ~5–10x more expensive than Qwen at scale. I design systems to route tasks to the right model"
- "I've tested both Gemma 4 and Qwen 3.6 locally via Ollama — I can set up a local inference stack without cloud dependency"
- "For multilingual AI output (my hadith-verifier supports UZ/AR/RU/TJ), Qwen 3.6 has stronger Cyrillic and Arabic training data than most models"
- "Pi + local model is my 'vibe coding' stack for exploration — Claude Code for shipping production features"

### Setup Commands (Windows — Ollama)

```powershell
# Install Ollama
winget install Ollama.Ollama

# Pull models
ollama pull gemma4          # Google — multimodal, Apache 2.0
ollama pull qwen3.6         # Alibaba — 1M context, multilingual

# Run locally
ollama run gemma4
ollama run qwen3.6

# Check what's installed
ollama list
```

### Cost Reference (May 2026)

| Model | Input (per 1M tokens) | Output | Context |
|---|---|---|---|
| Claude Sonnet 4.6 | ~$3 | ~$15 | 200K |
| Claude Opus 4.6 | ~$15 | ~$75 | 200K |
| Qwen 3.6 Plus | ~$1–3 | ~$3–8 | 1M |
| Gemma 4 (local) | $0 | $0 | 128K |
| Qwen 3.6 (OpenRouter) | Free tier | Free tier | 1M |

---

## How to Use This File

1. **Upload to Claude Project** → Claude reads it automatically in every conversation
2. **Drop in any new repo root** → name it `ABOUT.md`
3. **Reference in CLAUDE.md** → add line: `See ABOUT.md for developer context`
4. Claude will automatically apply your stack, preferences, and standards without you repeating context each session

---

*Last updated: May 2026 | github.com/Farhod75 | RAG roadmap + Local model strategy added*
