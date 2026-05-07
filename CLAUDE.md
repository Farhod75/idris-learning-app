# CLAUDE.md — Idris Learning App Project
# Aligned with: QA_STANDARDS.md from github.com/Farhod75/engineering-standards
# Author: Farhod Elbekov | ISTQB CT-AI | CTFL v4.0 | CT-GenAI (in progress)
# Last updated: 2026-05-01

---

## 📌 What This Project Is

An **AI-powered, multilingual, family-inclusive learning PWA** for Idriszhon (age 7, ASD).
Installs on iPad via Safari. No App Store needed.

**Aligned standards:** `QA_STANDARDS.md` covers test structure, AI/LLM testing, accessibility,
RAG patterns, and CI/CD. This file extends those for the Idris app domain specifically.

---

## 🧒 Child Context (always load before generating content)

```yaml
name: Idriszhon (nickname: Idris)
age: 7
condition: ASD (Autism Spectrum Disorder)
primary_input_language: English   # dominant from cartoons — use as app UI language
home_languages: [Uzbek, Russian, Tajik, English]
profile_file: idris-profile.md    # MUST be loaded into system prompt for AI content generation
interests: [trains, dinosaurs, drawing, music]
```

> ⚠️ Always read `idris-profile.md` before generating any game content, challenges,
> word lists, or reward animations. Content must reflect Idris's actual preferences.

---

## 🗂️ Project File Structure

```
idris-app/
├── CLAUDE.md                   ← this file (Claude Project context)
├── idris-profile.md            ← child personalization (feed to Claude API)
├── idris-mom-questionnaire.md  ← family fills this → updates idris-profile.md
├── index.html                  ← main PWA (single file, iPad Safari target)
├── manifest.json               ← PWA install manifest
├── sw.js                       ← Service Worker (offline support)
├── lang/
│   ├── en.json                 ← English strings
│   ├── ru.json                 ← Russian strings
│   ├── uz.json                 ← Uzbek strings
│   └── tg.json                 ← Tajik strings
├── assets/
│   ├── sounds/                 ← gentle reward sounds (no sudden loud SFX)
│   └── icons/                  ← iPad home screen icons
└── tests/
    ├── playwright/             ← iPad touch simulation tests
    ├── pytest/                 ← AI content quality evals
    └── evals/                  ← LLM-as-judge for generated game content
```

---

## 🛠️ Stack Defaults
*(extends QA_STANDARDS.md stack section)*

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | HTML + CSS + Vanilla JS | No framework — keeps iPad PWA fast |
| AI API | Claude API `claude-sonnet-4-20250514` | Content generation, personalization |
| Personalization | Prompt-based RAG via `idris-profile.md` | Phase 1 |
| Test E2E | Playwright | iPad viewport: 1024×1366, touch mode |
| Test AI | pytest + LLM-as-judge | Eval generated content safety & age-appropriateness |
| CI/CD | GitHub Actions | Lint → Test → Deploy to GitHub Pages |
| Accessibility | WCAG 2.1 AA (ASD-enhanced) | See extended rules below |

---

## 🤖 Claude API Usage Pattern

### System prompt structure (MUST follow this order):
```javascript
const systemPrompt = `
You are a gentle learning assistant for Idriszhon, age 7, ASD.

CHILD PROFILE:
${await loadFile('idris-profile.md')}   // always inject full profile

CURRENT SESSION:
- Language: ${lang}
- Family member present: ${selectedFamilyMember}
- Game type: ${gameType}
- Stars earned today: ${starsToday}

CONTENT RULES (MUST follow):
- Max 6 words per instruction
- Always pair text with emoji
- Celebrate every attempt, not just correct answers
- Never use countdown timers or pressure language
- Connect content to: trains 🚂, dinosaurs 🦕, or his known cartoons
- Output language: ${lang}
- Return JSON only, no markdown, no preamble
`;
```

### Expected response shape (always request JSON):
```typescript
interface GameContent {
  items: Array<{
    emoji: string;
    word: { en: string; ru: string; uz: string; tg: string; };
    category: string;        // "transport" | "animal" | "food" | "color"
    idrisRelevance: "high" | "medium" | "low";
  }>;
  familyChallenge: {
    emoji: string;
    instruction: string;     // max 10 words
    familyMember: string;
  };
  rewardMessage: string;     // in selected language, max 5 words
}
```

---

## ♿ Accessibility Rules — WCAG 2.1 AA + ASD Extensions
*(extends QA_STANDARDS.md accessibility section)*

### Hard requirements (MUST — same level as QA_STANDARDS MUST):
```
Touch targets:        min 72px × 72px  (QA_STANDARDS says 44px — override for ASD)
Font size body:       min 18px
Font size game text:  min 24px
Color contrast:       min 4.5:1 (AA)
Animation:           respect prefers-reduced-motion
Flashing:            NEVER > 3 flashes/second (WCAG 2.3.1 — seizure threshold)
Timers:              NEVER add countdown pressure — self-directed pace only
Audio:               All sounds OPTIONAL, default LOW volume
```

### Should (same convention as QA_STANDARDS SHOULD):
```
Haptic feedback:     gentle only, never startling
Background motion:   minimal, no parallax
Reward animations:   subtle, < 2 seconds
Session break cue:   suggest break every 10 minutes
```

---

## 🎮 Games Backlog
*(treat like QA_STANDARDS project kickstart checklist)*

| Priority | Game | Status | Language | Notes |
|----------|------|--------|----------|-------|
| P0 | Counting 1–10 | ✅ Prototype | All 4 | Add train/dino emojis from profile |
| P0 | Picture Match | ✅ Prototype | All 4 | Expand category library |
| P0 | Speak & Repeat | ✅ Prototype | All 4 | Integrate Web Speech API |
| P0 | Family Challenges | ✅ Prototype | All 4 | Expand to 20+ challenges |
| P1 | Letter Recognition | 🔲 TODO | EN first | A–Z with his cartoon characters |
| P1 | Color Matching | 🔲 TODO | All 4 | Use his favorite colors from profile |
| P1 | Animal Sounds | 🔲 TODO | All 4 | High interest — use profile animals |
| P2 | Draw & Tap | 🔲 TODO | All 4 | Tablet finger drawing mini-game |
| P2 | Sing Along | 🔲 TODO | All 4 | Family karaoke mode, soft mic |
| P3 | Shape Recognition | 🔲 TODO | All 4 | Basic geometry |

---

## 🧪 Test Strategy
*(aligned with QA_STANDARDS.md test structure rules)*

### E2E Tests (Playwright)
```python
# Target: iPad Safari simulation
# viewport: {"width": 1024, "height": 1366}
# touch: True

# MUST test:
- All touch targets are ≥ 72px
- Language switch works for all 4 languages
- Game completes and awards star
- Family challenge loads based on selected family member
- No animation flashes more than 3 times

# SHOULD test:
- Offline mode via Service Worker
- PWA install prompt appears
- Profile loads correctly from idris-profile.md
```

### AI Content Evals (pytest + LLM-as-judge)
```python
# Per QA_STANDARDS.md AI/LLM testing patterns:

def eval_generated_content(content: GameContent) -> EvalResult:
    """
    LLM-as-judge: is this content safe and appropriate for Idris?
    Judge model: claude-sonnet-4-20250514
    """
    criteria = [
        "age_appropriate",        # 7-year-old level
        "asd_safe",               # no sudden scary content  
        "language_correct",       # correct target language
        "idris_relevant",         # matches his interests from profile
        "family_inclusive",       # involves family member
        "instruction_brevity",    # max 6 words per instruction
    ]
```

### RAG Quality Tests
```python
# Per QA_STANDARDS.md RAG testing rules:
# Test that profile data actually influences generated content

def test_profile_influences_content():
    # Given: idris-profile.md says Idris likes trains
    # When: counting game content is generated
    # Then: at least 50% of emojis should be transport-related
    assert train_emoji_ratio(generated_content) >= 0.5
```

---

## 👨‍👩‍👧‍👦 Family Involvement — Non-Negotiable Rules

Every session MUST contain at least one "family moment" activity.
The app NEVER rewards solo screen time over human interaction.
Family challenges MUST use the language of the family member selected.

These are functional requirements, not nice-to-haves. Test them like any P0 feature.

---

## 🔄 Profile Update Workflow

```
Mom fills idris-mom-questionnaire.md
        ↓
Grandfather (Farhod) reviews answers
        ↓
Updates idris-profile.md
        ↓
Commits to repo (triggers CI)
        ↓
CI runs eval tests: does new content reflect updated profile?
        ↓
Deploy updated app to GitHub Pages
        ↓
Family uses updated app on iPad
```

---

## 💬 Effective Prompts for This Project

When asking Claude to help, always specify:

**Good pattern:**
```
"Using Idris's profile (loves trains, age 7, ASD), generate 10 new 
family challenge cards in Uzbek for the papa family member. 
Return JSON matching GameContent interface. Keep instructions under 6 words."
```

**Good pattern:**
```
"Add a new 'Animal Sounds' game to index.html. 
Use animals from idris-profile.md favorites list. 
Touch targets minimum 72px. No countdown timers. 
Support all 4 languages. Follow WCAG 2.1 AA."
```

**Avoid:**
```
"Make a new game for Idris"  ← too vague, Claude won't apply profile
"Add sounds"                 ← missing accessibility constraints
```

---

## 📅 Session Log (append after each play session)

```markdown
| Date | Family Member | Lang | Games | Idris Mood | Stars | Notes |
|------|--------------|------|-------|------------|-------|-------|
| 2026-05-01 | Grandfather | RU | Count, Match | happy | 12 | First session |
```

## Auto-logged FP-044 (2026-05-07)
Card 0: height 450px >= 200px [FP-039 regression]
