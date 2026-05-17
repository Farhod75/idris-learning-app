# agent-upskilling.md
# Idris Learning App — Agent Upskilling & Tool Evaluation

> **Author:** Farhod Elbekov + Claude session, 2026-05-16
> **Status:** Draft — informational scouting, NOT a commitment to adopt
> **Project:** idris-learning-app (github.com/Farhod75/idris-learning-app)
> **Target user:** Idriszhon, age 7, ASD — and similar profiles in future scale
> **Companion docs:** `CLAUDE.md`, `QA_STANDARDS.md`, `FIX_PATTERNS.md`, `DOCTOR_INTEGRATION.md`

## Purpose

This document tracks emerging tools and techniques that could enhance the Idris Learning App. Unlike HR (production content channel) and HV (verification service), Idris has a **single named user as the source of truth** — Idriszhon. Every tool decision must answer: *does this serve Idriszhon's actual learning, in ways that match his ASD profile and the family-inclusive design philosophy?*

Adoption rules unique to Idris:

1. **Idriszhon's experience is the validation set** — generic ASD UX research is a starting point, not the verdict
2. **The app already works on iPad** — anything that breaks the single-file PWA approach is rejected
3. **Family inclusion is non-negotiable** — tools must support multilingual family interaction, not replace it
4. **Privacy is HIPAA-adjacent** — a child's developmental data
5. **ASD-specialist review** for behaviorally significant changes (when feasible)

This is a scouting log, not an adoption plan.

---

## Current Idris stack (what we'd be extending or replacing)

✅ **Frontend:** Vanilla HTML + CSS + JS, single-file PWA, no framework
✅ **AI:** Claude Sonnet 4 (`claude-sonnet-4-20250514`) via @anthropic-ai/sdk
✅ **Embeddings:** Voyage AI (voyageai npm) — likely used for FP_PATTERNS or content similarity
✅ **Database:** Supabase (config in supabase/, migrations including consent_and_privacy)
✅ **Voice:** Web Speech API (browser-native, in `idris-voice-module.html`)
✅ **Personalization:** Prompt injection of `idris-profile.md` (not vector RAG)
✅ **Testing:** Playwright (iPad viewport 1024×1366 + touch mode) + pytest + LLM-as-judge evals
✅ **Multi-agent QA:** `orchestrator-with-fixer.ts` — sophisticated test fix automation
✅ **Languages:** EN, RU, UZ, TG (Tajik Cyrillic), AR, ES, FR — 7 lang JSON files
✅ **Special features:** AAC board, video rewards, doctor integration, reward system
✅ **Deployment:** Vercel (`vercel.json` present)

**Critical constraints to never violate:**
- Single-file `index.html` for fast iPad install
- 72px minimum touch targets (ASD-enhanced WCAG)
- No countdown timers (self-directed pace)
- Max 6 words per instruction
- Always pair text with emoji
- Reward animations < 2 seconds
- All sounds optional, default LOW

---

## Candidates under evaluation

### Candidate 1: Supertonic TTS — replacing Web Speech API for narration

> **Source:** Mahmood Khan LinkedIn post (2026-05-13)
> **Verified via:** Supertonic GitHub + Hugging Face + MarkTechPost (2026-05-16)
> **Status:** ⚠️ MIXED FIT — strong for some Idris languages, doesn't cover all

#### Why it might fit Idris

✅ **On-device = absolute privacy** — Idriszhon's interactions never leave the iPad. For a child's developmental app, this is the killer feature, not a nice-to-have.

✅ **No network dependency** — useful for car rides, school, anywhere Wi-Fi is unreliable.

✅ **MIT license + free** — no per-character cost, no API key management for a project where calm narration is constant.

✅ **44.1kHz output** — high quality, important since ASD users may be more sensitive to compression artifacts.

✅ **Expression tags `<laugh>`, `<breath>`, `<sigh>`** — could enhance emotional warmth in reward messages.

#### Language coverage check (against Idris's lang/ folder)

| Idris Language | Supertonic v3 Support? | Notes |
|---|---|---|
| **EN** (`en.json`) | ✅ Yes | First-class — voice quality should be tested |
| **RU** (`ru.json`) | ✅ Yes | Added in v3 |
| **AR** (`ar.json`) | ✅ Yes | Added in v3 |
| **ES** (`es.json`) | ✅ Yes | Original v2 language, mature |
| **FR** (`fr.json`) | ✅ Yes | Original v2 language, mature |
| **UZ** (`uz.json`) | ❌ **NOT SUPPORTED** | Not in 31-language list — same as HR |
| **TG** (`tg.json` — Tajik) | ❌ **NOT SUPPORTED** | Not in 31-language list — same as HR |

This is the same trap as HR. Supertonic does **5 of Idris's 7 languages**. UZ and TG must stay on Web Speech API or another fallback.

#### Honest concerns specific to Idris and ASD

⚠️ **"Voice presets lack prosody range of large commercial models"** (per Supertone's FAQ) — for ASD users, this cuts both ways:
- **Pro:** Flat, predictable voice may be EASIER to process than emotionally fluctuating one
- **Con:** Some children form attachments to specific voices; switching could disrupt routine

⚠️ **Web Speech API is already free and integrated** — Idris already uses it (`idris-voice-module.html`). Supertonic adds a 305MB model download per device and ONNX runtime complexity. Not a clear win unless quality is meaningfully better.

⚠️ **Browser deployment via WebGPU/WASM is supported** — but iPad Safari WebGPU support is still maturing. May fall back to WASM (slower, larger memory footprint).

❌ **The single-file PWA philosophy** — Supertonic requires downloading and managing ONNX models. This breaks Idris's "single index.html, fast install" deliberate design choice.

#### Decision criteria

Adopt Supertonic for Idris ONLY IF:
1. Idriszhon tests it (small supervised session, with current Web Speech API as control) — does he prefer it, tolerate it, or react adversely?
2. Quality is **clearly** better than Web Speech for the high-frequency phrases (counting, animal names, reward messages)
3. WASM/WebGPU runtime works smoothly on Idriszhon's actual iPad model (verify iPad model, OS version, Safari version)
4. The model download experience fits the PWA install flow without breaking it
5. UZ + TG fallback strategy is clean (e.g., "Supertonic for EN/RU/AR/ES/FR, Web Speech for UZ/TG")

Do NOT adopt if:
- Idriszhon shows preference for current Web Speech voice
- Model download adds > 5 seconds to install
- UZ + TG handling becomes confusing in the codebase

#### Roadmap fit

**Phase A (post-Hajj test):** A/B test with Idriszhon in a single supervised session. Same game, same content, swap TTS engine. Note his reactions, attention, request rate for repetition.

**Phase B (if positive):** Roll out for EN/RU/AR/ES/FR while keeping Web Speech for UZ/TG. Document the routing.

**Phase C (if negative or neutral):** Document the experiment in FIX_PATTERNS.md as evaluated-and-declined. Helps avoid re-evaluating in 6 months.

---

### Candidate 2: OpenUI for dynamic activity generation

> **Source:** LinkedIn post (2026-05-13)
> **Verified:** Not deeply verified per scope decision
> **Status:** ❌ STRONGLY DISCOURAGED for Idris — conflicts with core design principles

#### What it claims

OpenUI is a protocol that lets LLMs generate UI components with 67% fewer tokens than JSON. Framework-neutral, compiles to React/Vue/Svelte/HTML.

#### Why this is wrong for Idris

I want to be specific about WHY this doesn't fit, because the surface pitch ("personalized activities per child") sounds aligned:

**1. Routine destruction.** Idris's CLAUDE.md explicitly says "Touch targets minimum 72px" and the games have fixed layouts. Children with ASD often rely on consistent visual positioning as anchors. Idriszhon has played "Counting 1-10" — that's a familiar experience with predictable UI. LLM-generated UI that puts the "next" button bottom-left this session and bottom-right next session is **harm disguised as personalization**.

**2. The personalization Idris needs is content, not UI.** Idriszhon loves trains and dinosaurs (per `idris-profile.md`). The right personalization is "show train emojis in counting game" — which is already implemented via prompt-injected profile. The UI itself should stay rock-solid familiar.

**3. Validation impossible at scale.** Every static screen in Idris has been (or should be) reviewed for ASD-friendly design: motion, color, contrast, layout. Dynamic UIs would need every generated variant validated. There's no realistic way to do this for a one-person app.

**4. Breaks the single-file PWA philosophy.** OpenUI implies a compilation/render step. Idris is deliberately one HTML file. Adding a UI compiler breaks the architectural integrity.

**5. WCAG 2.1 AA compliance becomes unprovable.** Static UIs can be audited once. Dynamic UIs need continuous accessibility validation — not feasible for this project's scope.

#### When OpenUI might be reconsidered

ONLY if:
1. Idris scales to multi-user (different children, different ASD profiles) AND
2. A per-child "skin" approach (themes, colors, character preferences) becomes necessary AND
3. The "skin" can be defined as a constrained, validated design system rather than free-form generation

Even then, a hand-crafted theming system is probably better than LLM-generated UI.

#### Roadmap fit

**Do not adopt.** Document this decision in FIX_PATTERNS.md as P-XXX so the question doesn't get re-asked.

---

### Candidate 3: Speechmatics for STT in voice modules

> **Source:** Pipecat / Speechmatics LinkedIn post (2026-05-14)
> **Verified via:** Speechmatics docs (2026-05-16)
> **Status:** ⚠️ EVALUATE CAREFULLY — children's speech is a known hard problem

#### The use case in Idris

Idris already has `idris-voice-module.html` (33KB — substantial). This presumably uses Web Speech API for "Speak & Repeat" type games. Speechmatics is a candidate replacement IF:

1. Current Web Speech API has accuracy issues on Idriszhon's specific speech
2. Children's-speech-specialist STT is needed
3. Cloud dependency is acceptable

#### Honest concerns about ALL adult-trained STT for children with ASD

This is critical — most STT services, including Speechmatics, are **predominantly trained on adult speech**. Performance characteristics:

- WER on children's speech: **typically 30-50% worse than adult speech**
- WER on ASD-specific patterns (echolalia, atypical prosody, scripting): **even worse**
- Idriszhon at age 7 with ASD is the **hardest profile for any general-purpose STT**

| Tool | Adult speech | Children speech | ASD speech | Cost |
|---|---|---|---|---|
| Web Speech API (current) | Good | Mediocre | Unknown for Idris | Free, browser-native |
| Speechmatics | Excellent | Mediocre-Good | Unknown | $200 free credits, then paid |
| Whisper local | Good | Poor on children | Poor | Free, local |
| **Soapbox Labs** | N/A | **Specialized** | Limited info | Paid, kid-specialized |
| Google Cloud Speech | Good | Mediocre | Unknown | Paid |

#### Honest recommendation

**Skip Speechmatics for Idris.** Reasons:

1. Speechmatics' Pipecat benchmark (1.07% WER) is on **adult speech**. Not generalizable.
2. Web Speech API is already free and integrated.
3. The right specialist provider is **Soapbox Labs** (children's speech specialist) — see watch list below.
4. Even better: **design Idris so STT accuracy isn't a barrier**. If Idriszhon mumbles or articulation is unclear, the app should celebrate the attempt, not punish the audio quality. This is already partially in CLAUDE.md: "Celebrate every attempt, not just correct answers."

#### Roadmap fit

**Don't adopt Speechmatics.** Instead, document a STT philosophy:
- Voice features are SECONDARY input, never required
- STT accuracy is a "nice to have", not a gating factor
- Touch + visual + family-prompted speech is the primary loop

---

### Candidate 4: Hyperframes for content video generation

> **Source:** Cole Medin LinkedIn post (2026-05-14)
> **Verified:** Not deeply verified per scope decision
> **Status:** ❌ NOT FOR CHILD-FACING USE, possibly for caretaker resources

#### Why direct child-facing use is wrong

Idris has `video-reward.html` (20KB). Video rewards are a known successful pattern for ASD children — predictable, soothing, sometimes special-interest themed (trains, dinosaurs).

But AI-generated video has characteristics that conflict with ASD-friendly content:

❌ **Fast cuts and motion** — AI video tends toward cinematic energy that can be overwhelming
❌ **Sensory unpredictability** — colors, sounds, transitions vary in ways that break routine
❌ **Inconsistency on rewatch** — children with ASD often re-watch favorite content. AI-generated content lacks the exact-replication value
❌ **Pacing** — AI video often paces for adult engagement, not child regulation

#### Possible caretaker-facing use

✅ Quick training videos for mom (questionnaire context, in `idris-mom-questionnaire-RU.md`)
✅ Updates to grandfather (Farhod) on Idris's progress in narrated form
✅ Tutorials for new family members joining sessions

#### Roadmap fit

- Don't use for Idriszhon's video rewards (continue hand-curated approach)
- Possibly evaluate for **adult-facing content** (parent training, progress updates) post-Hajj
- Even then: ASD-specialist review of any video before showing to children

---

### Candidate 5: Voyage AI embeddings — what are they currently used for?

> **Source:** Inferred from `package.json` dependency on `voyageai`
> **Status:** ⚠️ NEED CONTEXT — already integrated, want to understand use case

#### What I can infer

Voyage AI is in `dependencies` (not devDependencies — it's runtime), suggesting embeddings are used in production. Possible uses given the file structure:

- **FIX_PATTERNS.md** is 71KB — possibly indexed via embeddings for semantic retrieval
- **supabase/migrations/001_fix_patterns_vectors.sql** suggests a vector store for fix patterns
- **idris-profile.md** could be embedded for similarity search (e.g., "find similar games this child would like")

#### Honest assessment

I can't evaluate without knowing the actual use case. But generally:

✅ Voyage AI is a credible embedding provider, competitive with OpenAI's text-embedding-3
✅ If you're using it for FIX_PATTERNS semantic retrieval, that's a sophisticated QA tooling pattern
⚠️ Alternative: Anthropic doesn't have a first-party embeddings API. Voyage is a reasonable choice.

#### Future consideration

If Anthropic releases a first-party embeddings API, evaluate switching. Otherwise, Voyage AI is fine. Note Voyage's pricing (per-token like everyone else) and monitor cost as the app scales.

---

### Candidate 6: Anthropic Claude prompt caching for Idris

> **Source:** Anthropic API docs (current capability)
> **Status:** ✅ HIGH VALUE for Idris's specific architecture

#### Why this fits perfectly

Per Idris's CLAUDE.md, every Claude API call includes:
```javascript
const systemPrompt = `
You are a gentle learning assistant for Idriszhon, age 7, ASD.

CHILD PROFILE:
${await loadFile('idris-profile.md')}   // always inject full profile

CURRENT SESSION:
- Language: ${lang}
- Family member present: ${selectedFamilyMember}
- ...

CONTENT RULES (MUST follow):
- Max 6 words per instruction
- ...
`;
```

The **first half of this prompt (child profile + content rules) is identical across every Idris API call**. That's a perfect cacheable prefix.

#### Quantified benefit

If `idris-profile.md` is 8KB (per file structure) and content rules add another 1-2KB, you're paying for ~9-10KB of prompt tokens on every single Claude call.

**With prompt caching:**
- First call: full cost
- Subsequent calls (within cache TTL, typically 5 min): 10× cheaper on the cached prefix
- For a play session with 10+ API calls in a few minutes, this is meaningful cost reduction

#### Decision criteria

Adopt prompt caching for Idris IF:
1. Claude Sonnet API supports it for `claude-sonnet-4-20250514` (verify in Anthropic docs)
2. The profile + rules prefix is stable across calls in a session
3. Refactor is < 1 day

#### Roadmap fit

**Quick win, post-Hajj.** Estimated effort: 0.5 day. Estimated savings: depends on volume, but at typical session rates probably $5-15/month at current scale, more as Idris scales.

#### Implementation sketch

```javascript
// BEFORE
const response = await claude.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: systemPrompt, // full prompt every time
  messages: [{ role: 'user', content: userMsg }]
});

// AFTER (with prompt caching)
const response = await claude.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: [
    {
      type: 'text',
      text: stableProfileAndRulesPrefix, // cached
      cache_control: { type: 'ephemeral' }
    },
    {
      type: 'text',
      text: sessionContextSuffix // varies per call
    }
  ],
  messages: [{ role: 'user', content: userMsg }]
});
```

---

## Candidates explicitly NOT adopting (and why)

### Vector RAG for personalization

Idris uses **prompt-based personalization** (inject `idris-profile.md` into system prompt). This is the right choice for Idris because:

- Single-user app — vector retrieval is overkill
- Profile is small (8KB) — fits in context easily
- Prompt injection is simpler, deterministic, easier to debug
- No retrieval misses, no chunking concerns

Don't add vector RAG just because it's trendy. The current approach is correct.

### Native iOS app

Tempting because of better iPad capabilities, but:
- Single-file PWA install works (already deployed)
- App Store submission process introduces friction for a family-built app
- Native development effort doesn't pay for itself at single-user scale
- iOS Safari is already a viable target

Keep PWA. Revisit only if multi-user scale demands it.

### React Native / Flutter rewrite

Same reasoning. Vanilla JS + single HTML file is a legitimate architectural choice for this app's constraints. Don't add framework complexity without a forcing function.

---

## Watch list (not evaluated tonight)

| Tool / Tech | Why interesting | Priority for Idris |
|---|---|---|
| **Soapbox Labs** | Children's speech specialist STT | Medium (only if voice accuracy becomes blocker) |
| **Tobii Eye Tracker** | Alternative input for non-verbal moments | Low (AAC board already serves) |
| **Proloquo2Go integration** | AAC interop with industry standard | Low (Idris's AAC board may suffice) |
| **Anthropic prompt caching** | Reduce API cost (see Candidate 6 above) | **HIGH** |
| **Anthropic batch processing** | Bulk evals for AI content quality tests | Medium |
| **Supabase Realtime** | Live family-member sync if multiple devices | Low |
| **Sentry error tracking** | Production error visibility | Medium |
| **Lighthouse CI** | PWA performance regression detection | Medium |
| **axe-core in CI** | Automated accessibility audits | High |
| **Otsimo (competitor)** | Competitive intelligence | Low (don't copy, learn) |
| **Forbrain (auditory training)** | ASD therapy device — not software, but worth understanding | Low |

---

## Idris-specific hard constraints (NEVER violate)

1. **Privacy** — child developmental data. No tool that sends Idriszhon's interactions to a third party without explicit family consent.
2. **Predictability** — never adopt tools that randomize the child-facing UI without parent opt-in.
3. **Sensory safety** — no flashing > 3/sec, no sudden loud audio, no high-contrast strobing.
4. **Caretaker control** — every AI behavior parent-toggleable. Default to less, opt into more.
5. **Family inclusion** — every session must keep the family-moment requirement. Tools that enable solo screen time over family interaction are rejected.
6. **No countdown timers** — ever. Self-directed pace only.
7. **WCAG 2.1 AA + ASD extensions** — 72px touch targets, 24px game text. New tools must maintain this.
8. **Domain expert review** for behaviorally significant changes — if feasible, consult Idriszhon's therapists or an OT/SLP before adopting tools that change interaction patterns.

---

## Specific upgrades to consider for Idris (NOT from the LinkedIn posts)

These are ideas surfaced from looking at the actual project structure:

### 1. Document the multi-agent orchestrator pattern

`tests/playwright/multi-agent/orchestrator-with-fixer.ts` is mentioned in `package.json` scripts. This is a sophisticated pattern. Worth:
- Documenting in QA_STANDARDS.md (already aligned per CLAUDE.md)
- Cross-referencing in HR's `agent-architecture-roadmap.md` Phase 4 (Auditor agent design) — Idris already has prior art here

### 2. Formalize the FIX_PATTERNS approach

FIX_PATTERNS.md is 71KB. That's substantial domain knowledge. Two questions:
- Is this Idris-specific, or could it be merged with HR/HV's `fix_patterns.md` discipline?
- Is the vector embedding (Voyage AI) used for searching FIX_PATTERNS? If so, document that pattern as a reusable QA technique.

### 3. The doctor integration

`DOCTOR_INTEGRATION.md` is 20KB. Curious about this. Worth understanding because:
- Healthcare integration introduces HIPAA-adjacent compliance considerations
- Could affect privacy stance on cloud-based tool adoption
- May limit which AI vendors are acceptable (data residency, BAAs)

### 4. The consent and privacy migration

`supabase/migrations/002_consent_and_privacy.sql` (12KB) suggests thoughtful privacy schema. Worth:
- Aligning with HR's "human reviews all flagged content" pattern
- Documenting consent flow for any future voice/video data collection
- Establishing principles for AI tool data processing agreements

---

## Action items for post-Hajj

1. **Quick win:** Implement Anthropic prompt caching (Candidate 6). ~0.5 day, immediate cost savings.
2. **Quick win:** Add Lighthouse CI and axe-core to GitHub Actions for PWA performance + accessibility regression detection.
3. **Experiment:** Single supervised TTS A/B test session with Idriszhon — Web Speech vs Supertonic for EN. Note reactions.
4. **Document:** What Voyage AI is currently doing (FIX_PATTERNS semantic search? Profile similarity? Other?). Update CLAUDE.md to reflect.
5. **Document:** Refuse OpenUI explicitly in FIX_PATTERNS.md so the question doesn't recur.
6. **Plan:** When Idris scales beyond single-user, the multi-tenant data model needs separate design — that's a Phase 2 conversation post-monetization.

---

## Change log

| Date | Change | By |
|---|---|---|
| 2026-05-16 | Initial scouting doc with full Idris architecture context (corrected from generic v1) | Farhod / Claude session |

---

## References

- `CLAUDE.md` — Idris project context (the source of truth for design philosophy)
- `idris-profile.md` — Idriszhon's personalization profile
- `QA_STANDARDS.md` — testing standards (aligned with engineering-standards repo)
- `FIX_PATTERNS.md` — Idris-specific learnings (71KB and growing)
- `DOCTOR_INTEGRATION.md` — healthcare integration design
- `idris-mom-questionnaire-RU.md` — family profile capture flow
- `hr-agent-upskilling.md` — HR project's parallel scouting (cross-reference Supertonic + Speechmatics)
- `hv-agent-upskilling.md` — HV project's parallel scouting

## Glossary (for future Claude sessions)

- **ASD:** Autism Spectrum Disorder
- **AAC:** Augmentative and Alternative Communication (Idris has an AAC board)
- **PWA:** Progressive Web App (Idris's deployment model)
- **WCAG 2.1 AA + ASD extensions:** Standard + Idris-specific stricter rules (72px vs 44px)
- **Family moment:** Required interaction with a designated family member each session
- **Idriszhon:** The named user — age 7, ASD, English-dominant from cartoons
- **Farhod (grandfather):** Lead developer and primary caretaker for the app
