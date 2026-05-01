# DOCTOR_INTEGRATION.md
# Self-learning + doctor approval + progress tracking for Idris App
# Author: Farhod Elbekov | github.com/Farhod75
# Add to Claude Project alongside CLAUDE.md + QA_STANDARDS.md + FIX_PATTERNS.md
# Updated: 2026-05-01

---

## CORE PRINCIPLE (never override this)

```
AI SUGGESTS → DOCTOR APPROVES → APP EXECUTES → AI LEARNS → REPEAT
```

The app NEVER adds new therapeutic tasks, difficulty levels, or behavioral goals
without doctor sign-off. AI proposes, humans decide. Same principle as HadithVerifier.

---

## 1. VERIFIED KNOWLEDGE SOURCES (RAG layer)

The AI reads from these sources to propose new tasks. All sources are
cross-referenced — a task only gets proposed if supported by 2+ sources.

### Tier 1 — Clinical guidelines (highest authority)
```yaml
sources:
  - name: "CDC Autism Spectrum Disorder"
    url: "https://www.cdc.gov/autism"
    type: "government"
    used_for: ["milestone_benchmarks", "red_flags"]

  - name: "WHO ICD-11 Autism guidelines"
    url: "https://www.who.int/news-room/fact-sheets/detail/autism-spectrum-disorders"
    type: "international_health"
    used_for: ["diagnosis_criteria", "intervention_principles"]

  - name: "ASHA (American Speech-Language-Hearing Association)"
    url: "https://www.asha.org/public/speech/disorders/autism/"
    type: "professional_body"
    used_for: ["speech_tasks", "language_milestones"]

  - name: "BACB ABA Guidelines"
    url: "https://www.bacb.com"
    type: "behavioral_therapy"
    used_for: ["task_structure", "reinforcement_schedules", "skill_progression"]
```

### Tier 2 — Research and practice (must match Tier 1)
```yaml
sources:
  - name: "Autism Speaks Resource Library"
    url: "https://www.autismspeaks.org/resource-library"
    type: "advocacy_research"

  - name: "Journal of Autism and Developmental Disorders"
    url: "https://link.springer.com/journal/10803"
    type: "peer_reviewed"

  - name: "National Autistic Society (UK)"
    url: "https://www.autism.org.uk/advice-and-guidance"
    type: "national_org"
```

### Tier 3 — Doctor's own instructions (highest priority — overrides all)
```yaml
sources:
  - name: "Dr. [Name] personal instructions"
    type: "doctor_input"
    format: "text entered in doctor portal OR uploaded PDF"
    overrides: "all_other_sources"
    note: "Doctor instructions always win, even if they differ from guidelines"
```

### How RAG works in practice
```
1. App detects: "Idris struggled with counting to 5 three sessions in a row"
2. Claude queries verified sources: "What is the recommended intervention
   for a 7-year-old with ASD who cannot count to 5 after 3 attempts?"
3. Sources return: structured practice, visual aids, backward chaining method
4. Claude drafts a task proposal with source citations
5. Task is sent to doctor portal — NOT to the app yet
6. Doctor reviews, approves/modifies/rejects
7. Only approved tasks appear in the app
```

---

## 2. DOCTOR PORTAL (separate web page, not visible to Idris)

URL pattern: `https://your-app.vercel.app/doctor?token=SECRET_TOKEN`

### What the doctor sees

```
┌─────────────────────────────────────────────┐
│  Idris — Weekly Progress Report             │
│  Week of: May 1-7, 2026                    │
├─────────────────────────────────────────────┤
│  SKILL SCORES (auto-calculated)             │
│  Counting 1-5:     ████████░░  78%  ↑+12%  │
│  Color naming:     ██████░░░░  60%  ↑+5%   │
│  Vocabulary (EN):  █████████░  90%  ↑+3%   │
│  Family interaction: ████░░░░  40%  ↔0%    │
├─────────────────────────────────────────────┤
│  PROPOSED NEW TASKS (AI-generated)          │
│  Source: BACB + ASHA guidelines             │
│                                             │
│  Task: "Counting 6-10 with train wagons"    │
│  Rationale: Idris mastered 1-5 (78% > 75%) │
│  Method: backward chaining, visual first   │
│  [APPROVE] [MODIFY] [REJECT] [ASK AI MORE] │
│                                             │
│  Task: "Name 3 emotions using face cards"  │
│  Rationale: family interaction score low   │
│  [APPROVE] [MODIFY] [REJECT] [ASK AI MORE] │
├─────────────────────────────────────────────┤
│  ADD YOUR OWN INSTRUCTION                   │
│  ┌──────────────────────────────────────┐  │
│  │ Type instruction here...            │  │
│  └──────────────────────────────────────┘  │
│  [SAVE INSTRUCTION → Goes to app tonight]  │
├─────────────────────────────────────────────┤
│  [DOWNLOAD PDF REPORT] [SHARE WITH FAMILY] │
└─────────────────────────────────────────────┘
```

### Doctor portal API routes (Next.js, same pattern as HadithVerifier)

```typescript
// POST /api/doctor/propose
// AI submits new task proposal for doctor review
// Body: { task, rationale, sources, skillArea, difficulty }
// Returns: { proposalId, status: "pending" }

// GET /api/doctor/proposals
// Doctor fetches all pending proposals
// Returns: [ { id, task, rationale, sources, status, createdAt } ]

// PATCH /api/doctor/proposals/:id
// Doctor approves/modifies/rejects
// Body: { action: "approve"|"reject"|"modify", doctorNotes, modifiedTask? }
// Effect: approved tasks → written to idris-profile.md active_tasks[]

// POST /api/doctor/instructions
// Doctor adds free-text instruction
// Body: { instruction, priority: "high"|"normal", effectiveFrom }
// Effect: instruction → written to idris-profile.md doctor_instructions[]

// GET /api/doctor/report?week=2026-W18
// Generate weekly PDF report
// Returns: PDF blob with progress charts + session logs
```

### Supabase schema (same pattern as HadithVerifier)

```sql
-- Task proposals from AI → awaiting doctor review
CREATE TABLE task_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_title TEXT NOT NULL,
  task_description TEXT NOT NULL,
  rationale TEXT NOT NULL,
  sources JSONB,               -- [{ name, url, tier }]
  skill_area TEXT NOT NULL,    -- "counting"|"speech"|"social"|"reading"
  difficulty TEXT NOT NULL,    -- "easier"|"same"|"harder"
  status TEXT DEFAULT 'pending', -- "pending"|"approved"|"rejected"|"modified"
  doctor_notes TEXT,
  modified_task TEXT,
  proposed_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Doctor's own free-text instructions
CREATE TABLE doctor_instructions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instruction TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  effective_from DATE DEFAULT CURRENT_DATE
);

-- Progress sessions (every play session logged)
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  family_member TEXT,           -- "mama"|"papa"|"deda" etc.
  game_type TEXT NOT NULL,      -- "counting"|"matching"|"speaking"|"family"
  duration_minutes INTEGER,
  stars_earned INTEGER,
  skill_area TEXT,
  score_pct INTEGER,            -- 0-100
  mood TEXT,                    -- "happy"|"calm"|"frustrated"|"excited"
  notes TEXT,
  lang TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Skill snapshots (weekly rollup)
CREATE TABLE skill_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week TEXT NOT NULL,           -- "2026-W18"
  skill_area TEXT NOT NULL,
  score_pct INTEGER,
  sessions_count INTEGER,
  trend TEXT,                   -- "improving"|"stable"|"declining"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS (per FP-001 in FIX_PATTERNS.md)
ALTER TABLE task_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_instructions DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE skill_snapshots DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
```

---

## 3. PROGRESS TRACKING (what gets logged every session)

### Session log format (logged to Supabase after EVERY play session)

```typescript
interface SessionLog {
  date: string;               // "2026-05-01"
  familyMember: string;       // "mama" | "papa" | "deda" | "babushka"
  gameType: string;           // "counting" | "matching" | "speaking" | "family_challenge"
  durationMinutes: number;
  starsEarned: number;
  skillArea: string;          // "numbers" | "language" | "social" | "motor"
  scorePct: number;           // 0-100 (correct answers / total)
  mood: string;               // observed by family member
  lang: string;               // which language was used
  wordsSpoken: string[];      // words Idris said during session (for speech tracking)
  completedTasks: string[];   // which task IDs were practiced
  notes: string;              // family member's free-text note
}
```

### Skill scoring (how Claude calculates progress)

```typescript
// Per skill area, calculate rolling 7-day average
function calculateSkillScore(sessions: SessionLog[], skillArea: string): number {
  const recent = sessions
    .filter(s => s.skillArea === skillArea)
    .filter(s => isWithinDays(s.date, 7))
    .map(s => s.scorePct);

  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}

// Milestone thresholds (from BACB guidelines)
const MILESTONES = {
  counting_1_5:     { mastery: 80, sessions_needed: 3 },
  counting_6_10:    { mastery: 80, sessions_needed: 3 },
  color_naming:     { mastery: 75, sessions_needed: 4 },
  vocabulary_basic: { mastery: 85, sessions_needed: 5 },
  social_greeting:  { mastery: 70, sessions_needed: 3 },
  family_names:     { mastery: 90, sessions_needed: 2 },
};

// Triggers a task proposal to doctor when milestone reached
function checkMilestones(snapshots: SkillSnapshot[]): TaskProposal[] {
  const proposals: TaskProposal[] = [];
  for (const [skill, threshold] of Object.entries(MILESTONES)) {
    const snapshot = snapshots.find(s => s.skillArea === skill);
    if (snapshot?.scorePct >= threshold.mastery
        && snapshot?.sessionsCount >= threshold.sessionsNeeded) {
      proposals.push(generateNextTaskProposal(skill, snapshot));
    }
  }
  return proposals;
}
```

---

## 4. SELF-LEARNING LOOP (how the app gets smarter)

### The weekly cycle

```
MONDAY    Sessions logged all week
          ↓
SUNDAY    Claude runs weekly analysis:
          - calculates skill scores
          - detects struggling areas (score < 50%)
          - detects mastered areas (score > 80% for 3+ sessions)
          - queries RAG sources for next steps
          - generates task proposals
          ↓
MONDAY    Doctor portal shows new proposals
          Doctor reviews during the week
          ↓
NEXT WEEK Approved tasks appear in app
          idris-profile.md updated
          Claude system prompt updated
```

### Claude's self-learning prompt (weekly analysis)

```typescript
const weeklyAnalysisPrompt = `
You are analyzing Idriszhon's learning progress for the week of ${weekOf}.

CHILD PROFILE:
${profile}

THIS WEEK'S SESSION DATA:
${JSON.stringify(sessionData, null, 2)}

DOCTOR'S CURRENT INSTRUCTIONS:
${doctorInstructions.map(i => i.instruction).join('\n')}

CURRENT ACTIVE TASKS:
${activeTasks.map(t => t.title).join('\n')}

VERIFIED SOURCES AVAILABLE: CDC autism guidelines, BACB ABA standards, ASHA speech guidelines.

Analyze:
1. Which skills improved this week? (score delta vs last week)
2. Which skills need more practice? (score < 50%)
3. Which skills are mastered and ready for next level? (score > 80% for 3+ sessions)
4. Are there any concerning patterns? (mood "frustrated" 3+ times, declining trend)

Then propose 1-3 new tasks for doctor review. For each task:
- State the skill area and specific task
- Cite the source guideline that supports it
- Explain why now (based on Idris's current data)
- Suggest difficulty: easier/same/harder vs current
- Suggest family member involvement

Return ONLY raw JSON. No markdown. No preamble.
{
  "weekSummary": "2-3 sentence summary for doctor",
  "skillScores": { "counting": 78, "speech": 60, ... },
  "concerns": ["string"],
  "proposedTasks": [
    {
      "title": "string",
      "description": "string",
      "rationale": "string",
      "source": "string",
      "sourceUrl": "string",
      "skillArea": "string",
      "difficulty": "easier|same|harder",
      "familyRole": "string"
    }
  ]
}
`;
```

---

## 5. DOCTOR PDF REPORT (shareable, professional)

### Report structure (generated weekly, downloadable from doctor portal)

```
IDRISZHON — WEEKLY PROGRESS REPORT
Week: May 1-7, 2026 | Generated by: Idris Learning App

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SKILL OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Counting (numbers):      78%  ↑ +12% vs last week
Vocabulary (English):    90%  ↑ +3%
Color recognition:       60%  ↑ +5%
Family interaction:      40%  ↔ no change
Speech clarity:          55%  ↑ +8%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THIS WEEK'S SESSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mon May 1 | Mama (Uzbek)    | Counting + Matching | 12min | 😊 happy   | 4⭐
Tue May 2 | Papa (Uzbek)    | Family challenge    | 8min  | 😌 calm    | 2⭐
Wed May 3 | Babushka (RU)   | Speaking game       | 10min | 😤 frustrated | 1⭐
Thu May 4 | Deda (Tajik)    | Counting            | 15min | 😊 happy   | 5⭐
Fri May 5 | Mama (Uzbek)    | Matching + Speaking | 11min | 😊 happy   | 4⭐

Total: 5 sessions | 56 minutes | 16 stars | Avg mood: positive

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI OBSERVATIONS (for doctor review)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Strong improvement in counting — ready for numbers 6-10
• Wednesday frustration noted during speaking game with Babushka (Russian)
  → Consider shorter speaking sessions or different prompts in Russian
• Family interaction score unchanged — recommend increasing family challenges

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORDS SPOKEN THIS WEEK (speech log)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
English: train, apple, one, two, three, cat, moon
Uzbek:   olma, mushuk
Russian: кошка, яблоко

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PENDING YOUR APPROVAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[See doctor portal for proposed new tasks]

Generated: 2026-05-07 | App version: 1.2
Doctor portal: https://your-app.vercel.app/doctor?token=XXX
```

### PDF generation (using existing Next.js stack)

```typescript
// app/api/doctor/report/route.ts
import puppeteer from 'puppeteer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get('week') ?? getCurrentWeek();

  // Fetch data
  const sessions = await getSessionsForWeek(week);
  const skillScores = calculateSkillScores(sessions);
  const words = extractWordsSpoken(sessions);

  // Generate HTML report
  const html = generateReportHTML({ sessions, skillScores, words, week });

  // Convert to PDF with puppeteer
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="idris-report-${week}.pdf"`
    }
  });
}
```

---

## 6. PROGRESS SECTION IN idris-profile.md

Add this section to `idris-profile.md` — it gets updated automatically:

```yaml
## 📊 Active Tasks (doctor-approved, currently in app)

active_tasks:
  - id: "task-001"
    title: "Counting 1-5 with train wagons"
    skill_area: "numbers"
    approved_by: "Dr. [Name]"
    approved_date: "2026-04-28"
    source: "BACB skill acquisition guidelines"
    status: "active"
    mastery_target: 80   # % correct to consider mastered

  - id: "task-002"
    title: "Name 5 animals in English"
    skill_area: "vocabulary"
    approved_by: "Dr. [Name]"
    approved_date: "2026-04-28"
    source: "ASHA language development benchmarks"
    status: "active"
    mastery_target: 85

## 📈 Current Skill Scores (auto-updated weekly)

skill_scores:
  counting:         78   # % (7-day rolling average)
  vocabulary_en:    90
  color_naming:     60
  family_interact:  40
  speech_clarity:   55
  last_updated: "2026-05-07"

## 🩺 Doctor Instructions (directly from doctor portal)

doctor_instructions:
  - date: "2026-04-30"
    instruction: "Keep counting sessions under 10 minutes — Idris loses focus after that"
    priority: "high"
    active: true

  - date: "2026-05-02"
    instruction: "Russian sessions are less effective — prioritize Uzbek and English"
    priority: "normal"
    active: true

## 📋 Milestones Achieved

milestones:
  - date: "2026-05-01"
    milestone: "First app session completed"
    notes: "Played with grandfather"

  - date: "2026-05-05"
    milestone: "Counted to 5 correctly without help"
    witnessed_by: "Mama"
    notes: "Very excited, did it twice in a row"
```

---

## 7. WHAT TO ADD TO CLAUDE.md (idris project)

Add this section to `CLAUDE.md`:

```markdown
## Doctor integration rules (MUST follow)

- NEVER add a task to the app without it appearing in active_tasks[] in idris-profile.md
- active_tasks[] is ONLY updated after doctor approval via the portal
- All task proposals MUST cite a verified source (Tier 1 or Tier 2)
- Doctor instructions in doctor_instructions[] OVERRIDE all other logic
- Weekly analysis runs Sunday night — proposals ready Monday morning for doctor

## Progress tracking rules

- Every session logs to Supabase sessions table immediately on completion
- Skill scores recalculate weekly from sessions data
- idris-profile.md skill_scores[] updates after each weekly calculation
- Claude system prompt is rebuilt from latest idris-profile.md before each API call
```

---

## 8. FILE LOCATIONS (where everything lives)

```
idris-learning-app/
├── app/
│   └── api/
│       ├── doctor/
│       │   ├── proposals/route.ts    ← PATCH approve/reject
│       │   ├── instructions/route.ts ← POST doctor's own text
│       │   └── report/route.ts       ← GET PDF report
│       └── sessions/
│           ├── log/route.ts          ← POST session after each game
│           └── analyze/route.ts      ← GET weekly skill analysis
├── pages/
│   └── doctor.tsx                    ← Doctor portal UI (token-gated)
├── idris-profile.md                  ← Updated weekly by analysis job
├── DOCTOR_INTEGRATION.md             ← This file
└── scripts/
    └── weekly-analysis.ts            ← Cron job (runs Sunday night)
```

---

## 9. SHARING WITH DOCTOR (3 ways)

```
1. PDF email   → doctor portal → Download PDF → Email/WhatsApp to doctor
2. Portal link → Share token URL → Doctor bookmarks → Checks weekly
3. Print       → PDF → print at home → bring to appointment
```

The token in the URL is a simple secret that only the doctor and family know.
No login system needed — keep it simple for family to share.
