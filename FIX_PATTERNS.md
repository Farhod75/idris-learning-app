# FIX_PATTERNS.md
# Real bug fixes from production — extracted from HadithVerifier + Idris App
# Author: Farhod Elbekov | github.com/Farhod75
# Aligned with: QA_STANDARDS.md (hadith-verifier repo)
# Upload to every Claude Project alongside QA_STANDARDS.md + CLAUDE.md
# Updated: 2026-05-01

---

## HOW TO USE
1. Upload to every Claude Project (alongside QA_STANDARDS.md, CLAUDE.md)
2. When a bug appears → search here FIRST before asking Claude to fix
3. When you fix a new bug → ADD IT HERE immediately with the template at bottom
4. Prompt Claude: "Check FIX_PATTERNS.md before implementing any fix"

---

## PATTERN INDEX

| ID | Source | Category | Pattern |
|----|--------|----------|---------|
| FP-001 | HadithVerifier | Supabase | RLS silently blocks all reads |
| FP-002 | HadithVerifier | Vercel/ENV | Placeholder values survive to production |
| FP-003 | HadithVerifier | Supabase | SUPABASE_URL double https:// prefix |
| FP-004 | HadithVerifier | Supabase | Boolean filter misses NULL values |
| FP-005 | HadithVerifier | Vercel | Stale build without --force |
| FP-006 | HadithVerifier | Accessibility | text-gray-400 fails WCAG 2.1 AA (2.53:1) |
| FP-007 | Both | Claude API | Empty content array crash |
| FP-008 | Both | Claude API | JSON wrapped in markdown fences |
| FP-009 | Both | Claude API | Rate limit (429) silent failure |
| FP-010 | Idris App | Safari/iOS | Web Speech API silent fail — Siri conflict |
| FP-011 | Idris App | Safari/iOS | PWA loses mic permission after install |
| FP-012 | Idris App | Safari/iOS | SpeechSynthesis cuts off at ~15s on iOS |
| FP-013 | Idris App | PWA | Service Worker serves stale cache |
| FP-014 | Idris App | Multilingual | Wrong BCP-47 tag breaks ASR |
| FP-015 | Both | Claude API | Profile file not injected into API calls |
| FP-016 | Idris App | General | Double-tap starts two voice sessions |
| FP-017 | Both | Storage | localStorage cleared in iOS PWA |

---

## SECTION A — HADITH VERIFIER (Production-confirmed real fixes)

## FP-001 — Supabase RLS silently blocks all reads
**Source:** HadithVerifier CLAUDE.md — "Known fixes applied" #1
**Symptom:** `GET /api/queue` returns `[]`. No error. DB has rows. Supabase logs show nothing.
**Root cause:** RLS enabled by default on new Supabase tables. No policies = all reads silently return empty.

**Fix:**
```sql
ALTER TABLE flagged_posts DISABLE ROW LEVEL SECURITY;
GRANT ALL ON flagged_posts TO service_role;
GRANT ALL ON flagged_posts TO anon;
```

**Prevention — verify after every table creation:**
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table';
-- rowsecurity must be false for server routes without explicit policies
```

**Test to catch it:**
```typescript
test('queue returns data when table has rows', async ({ request }) => {
  const res = await request.get('/api/queue');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  // If empty AND you know rows exist → RLS is the culprit
});
```
**Applies to:** Every Supabase project. Add to kickstart checklist.

---

## FP-002 — ENV placeholder values survive to Vercel production
**Source:** HadithVerifier CLAUDE.md — "Known fixes applied" #2
**Symptom:** Works locally. On Vercel: auth errors, 401s. `process.env.ANTHROPIC_API_KEY === "sk-ant-..."` (literal placeholder).
**Root cause:** `.env.example` placeholders copied to `.env.local` and pushed to Vercel env store before being replaced.

**Fix:**
```bash
vercel env pull .env.local        # pull real values from Vercel dashboard
cat .env.local | grep "REPLACE"   # must return nothing
vercel --prod --force             # redeploy with real values
```

**Prevention — .env.example header:**
```bash
# !! REPLACE ALL VALUES BELOW BEFORE DEPLOYING !!
# Run: vercel env pull .env.local  to get real values
ANTHROPIC_API_KEY=REPLACE_THIS
NEXT_PUBLIC_SUPABASE_URL=REPLACE_THIS
```

**CI detection test:**
```typescript
test('API key is not a placeholder', async ({ request }) => {
  const res = await request.post('/api/analyze', { data: { postText: 'test', lang: 'en' } });
  expect(res.status()).not.toBe(401); // 401 = placeholder key deployed
});
```
**Applies to:** All Vercel + Anthropic/Supabase projects.

---

## FP-003 — Supabase URL has double https:// prefix
**Source:** HadithVerifier CLAUDE.md — "Known fixes applied" #3
**Symptom:** All Supabase calls fail with `Invalid URL` or DNS error. URL in logs: `https://https://project.supabase.co`.
**Root cause:** `.env.local` had URL with `https://` prefix AND some SDK versions also prepend it.

**Fix:**
```bash
# Check which format your SDK version expects — test both:
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co   # @supabase/supabase-js v2
NEXT_PUBLIC_SUPABASE_URL=xyz.supabase.co           # some older versions
```

**Detection — add to lib/supabase.ts startup:**
```typescript
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (url.startsWith('https://https://')) {
  throw new Error('SUPABASE_URL double prefix detected — fix .env.local');
}
```
**Applies to:** All Supabase projects. Check on every new setup.

---

## FP-004 — Supabase boolean filter misses NULL rows
**Source:** HadithVerifier CLAUDE.md — "Known fixes applied" #4
**Symptom:** Admin queue empty. Posts in DB. `GET /api/queue` returns `[]`. Filter was `.eq('reviewed', false)`.
**Root cause:** Newly inserted rows have `reviewed = NULL`. Supabase strict equality: `NULL != false` → all filtered out.

**Fix:**
```typescript
// WRONG — misses NULL
.eq('reviewed', false)

// CORRECT — includes NULL and false
.or('reviewed.is.null,reviewed.eq.false')
.order('created_at', { ascending: false })
.limit(50)
```

**Prevention — explicit default in schema:**
```sql
ALTER TABLE flagged_posts ALTER COLUMN reviewed SET DEFAULT false;
-- Now all inserts get false, never NULL
```
**Applies to:** All Supabase projects with boolean filter columns.

---

## FP-005 — Vercel deploy serves stale build
**Source:** HadithVerifier CLAUDE.md — "Known fixes applied" #5
**Symptom:** Code pushed. Vercel says "Success". Production shows old behavior.
**Root cause:** Vercel caches build output. ENV changes especially get stuck without cache bust.

**Fix:**
```bash
vercel --prod --force   # always use --force after env changes

# Or via dashboard: Project → Settings → Clear Build Cache → Redeploy
```

**CI/CD rule — GitHub Actions:**
```yaml
- run: vercel --prod --force --token=${{ secrets.VERCEL_TOKEN }}
# --force ensures fresh build in every CI run
```
**Rule:** Every ENV variable change → `vercel --prod --force`. No exceptions.

---

## FP-006 — text-gray-400 fails WCAG 2.1 AA contrast (2.53:1)
**Source:** HadithVerifier README.md — "Known issues"
**Symptom:** axe-core fails `color-contrast`. Ratio 2.53:1, minimum required 4.5:1.
**Root cause:** `text-gray-400` (#9CA3AF on white) = 2.53:1. Below WCAG AA threshold.

**Fix:**
```html
<!-- WRONG -->  <p class="text-gray-400">Hint text</p>
<!-- CORRECT --> <p class="text-gray-600">Hint text</p>
```

**Tailwind text color contrast (on white bg):**
```
gray-300 → 1.88:1  ❌
gray-400 → 2.53:1  ❌  ← HadithVerifier bug
gray-500 → 3.95:1  ❌
gray-600 → 5.74:1  ✅  ← minimum safe
gray-700 → 8.59:1  ✅  ← preferred
```

**axe-core test:**
```typescript
import AxeBuilder from '@axe-core/playwright';
test('no color contrast violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag21aa']).analyze();
  const contrast = results.violations.filter(v => v.id === 'color-contrast');
  expect(contrast).toHaveLength(0);
});
```
**Rule:** Never use `text-gray-500` or lower for any visible text. Applies to all UI projects.

---

## SECTION B — SHARED PATTERNS (Both projects)

## FP-007 — Claude API empty content array crash
**Symptom:** `TypeError: Cannot read property 'text' of undefined` on `data.content[0].text`.
**Root cause:** Claude returns `content: []` on token limit, malformed request, or certain error states.

**Fix — universal safe accessor:**
```typescript
const text =
  data?.content?.find((b: { type: string; text?: string }) => b.type === 'text')?.text
  ?? getFallback();

// HadithVerifier fallback:
function getFallback() {
  return JSON.stringify({ verdict: 'unclear', confidence: 'low', severity: 'MEDIUM',
    claim_summary: 'Analysis unavailable. Please try again.',
    analysis: '', suggested_comment: '', red_flags: [], references: [] });
}

// Idris App fallback:
const IDRIS_FALLBACKS = ['Great try! 🌟', 'Молодец! 🚂', 'Barakalla! 🦕', 'Зӯр! 🌟'];
function getFallback() { return IDRIS_FALLBACKS[Math.floor(Math.random() * 4)]; }
```
**Applies to:** ALL Claude API projects. Add to every route that calls the API.

---

## FP-008 — Claude returns JSON wrapped in markdown fences
**Symptom:** `JSON.parse()` throws on valid JSON because response starts with ` ```json `.
**Root cause:** Vague "return JSON" instruction — Claude adds fences anyway.

**Prevention — exact system prompt wording:**
```
// WRONG: "Return your response as JSON"
// CORRECT: "Return ONLY raw JSON. No markdown. No code fences. No preamble.
//           First character must be {  Last character must be }"
```

**Defense — always strip before parsing:**
```typescript
function safeParseJSON<T>(raw: string, fallback: T): T {
  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(clean) as T; }
  catch { console.error('JSON parse failed:', clean.slice(0, 200)); return fallback; }
}
```
**Applies to:** HadithVerifier `/api/analyze`, Idris App content generation, all JSON-from-Claude usage.

---

## FP-009 — Claude API rate limit (429) causes silent failure
**Symptom:** App goes quiet during heavy use. No user-facing error. Console: `429 Too Many Requests`.
**Root cause:** Rate limits hit during rapid sequential calls or concurrent family sessions.

**Fix:**
```typescript
async function callClaudeWithRetry(params: object, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (res.status === 429) {
      const wait = (parseInt(res.headers.get('retry-after') ?? '5') + i * 2) * 1000;
      console.warn(`Rate limited — waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error('Claude API: max retries exceeded');
}
```
**Applies to:** Both projects. Any high-frequency Claude API usage.

---

## SECTION C — IDRIS APP (iPad PWA + Voice)

## FP-010 — Web Speech API silent fail — Siri conflict
**Symptom:** `onstart` fires, `onresult` NEVER fires. No error. No timeout. Mic appears active.
**Root cause:** "Hey Siri" in Settings intercepts microphone before Web Speech API gets audio.

**Fix:**
```javascript
// One-time user instruction (cannot detect programmatically)
if (!sessionStorage.getItem('siri-warned')) {
  showToast('💡 Voice not working? Settings → Siri → disable "Listen for Hey Siri"');
  sessionStorage.setItem('siri-warned', '1');
}
// Also: delay .start() by 2s on Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (isSafari) await new Promise(r => setTimeout(r, 2000));
recognition.start();
```

---

## FP-011 — PWA loses microphone permission after Add to Home Screen
**Symptom:** Mic works in Safari. After home screen install, silently denied.
**Root cause:** iOS Safari PWA and Safari browser have SEPARATE permission stores.

**Fix:**
```javascript
// Proactively request mic on first PWA launch — before any voice button shown
async function requestMicOnFirstPWALaunch() {
  if (!window.navigator.standalone) return; // not a PWA
  if (localStorage.getItem('mic-asked')) return;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach(t => t.stop());
    localStorage.setItem('mic-asked', '1');
  } catch {
    alert('Settings → Safari → [App Name] → Microphone → Allow');
  }
}
```
**Rule:** Always test voice AFTER PWA install, not just in browser. Different permission context.

---

## FP-012 — SpeechSynthesis cuts off at ~15s on iOS
**Symptom:** TTS starts, stops mid-sentence after ~15 seconds. No error.
**Root cause:** iOS watchdog timer. Known Apple bug, unfixed as of iOS 17.

**Fix:**
```javascript
function speakSafe(text, lang) {
  window.speechSynthesis.cancel();
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  let i = 0;
  const guard = setInterval(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  }, 5000);
  function next() {
    if (i >= sentences.length) { clearInterval(guard); return; }
    const u = new SpeechSynthesisUtterance(sentences[i++].trim());
    u.lang = lang; u.rate = 0.85; u.pitch = 1.1;
    u.onend = next;
    window.speechSynthesis.speak(u);
  }
  next();
}
```

---

## FP-013 — Service Worker serves stale cache after update
**Symptom:** Fix deployed. iPad still shows old broken version.
**Root cause:** SW caches old `index.html`. Never re-fetches unless cache name changes.

**Fix:**
```javascript
// sw.js — ALWAYS increment on every deploy
const CACHE = 'idris-v2'; // ← bump this each deploy

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
```
**Rule:** Bump `CACHE` version in `sw.js` on every deploy. Add to deployment checklist.

---

## FP-014 — Wrong BCP-47 tag breaks ASR
**Symptom:** ASR returns gibberish for Uzbek/Tajik. Safari strict about exact tag format.

**Fix:**
```typescript
const LANG_TAGS = { en: 'en-US', ru: 'ru-RU', uz: 'uz-UZ', tg: 'tg-TG' };
// ⚠️ tg-TG NOT supported by Safari ASR — use ru-RU fallback for Deda's sessions
// TTS (SpeechSynthesis) can still use tg-TG for output
const ASR_SAFE = ['en-US', 'ru-RU', 'uz-UZ'];
function getSafeASR(lang: string) {
  const tag = LANG_TAGS[lang] ?? 'en-US';
  return ASR_SAFE.includes(tag) ? tag : 'ru-RU';
}
```

---

## FP-015 — Profile/context not injected into Claude API calls
**Symptom:** Claude ignores profile — generates generic content, not Idris-specific.
**Root cause:** Project Knowledge files are for Claude.ai chat only. `fetch()` API calls don't see them.

**Fix:**
```typescript
let _profile: string | null = null;
async function getProfile() {
  if (!_profile) _profile = await fetch('/idris-profile.md').then(r => r.text());
  return _profile;
}
// Inject into EVERY API call system prompt
body: JSON.stringify({
  system: `Child profile:\n${await getProfile()}\n\nPersonalize all content to this profile.`,
  messages: [{ role: 'user', content: prompt }]
})
```
**Applies to:** Idris App, any file-based RAG with Claude API.

---

## FP-016 — Double-tap starts two voice sessions
**Symptom:** `InvalidStateError: recognition already started`. App freezes.
**Root cause:** Async handler — second tap fires before first completes.

**Fix:**
```typescript
let _starting = false;
async function startListening() {
  if (_starting || isListening) return;
  _starting = true;
  micBtn.disabled = true;
  try { await _doStart(); }
  finally { _starting = false; micBtn.disabled = false; }
}
```

---

## FP-017 — localStorage cleared in iOS PWA
**Symptom:** Voice profiles lost between sessions. Progress resets. Settings gone.
**Root cause:** iOS clears localStorage under storage pressure. Private mode blocks it.

**Fix — IndexedDB primary, localStorage fallback:**
```typescript
async function save(key: string, val: unknown) {
  try { /* IndexedDB write */ }
  catch { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
}
```
**Critical:** Voice profiles MUST use IndexedDB — loss requires full re-enrollment of all family members.

---

## ADDING NEW PATTERNS

```markdown
## FP-XXX — [Name]
**Source:** [Project name]
**Symptom:** [What you see]
**Root cause:** [Why it happens]
**Fix:**
```code```
**Applies to:** [Which projects]
```

---

## STATS
| Source | Count | Most critical |
|--------|-------|--------------|
| HadithVerifier (real) | 6 | FP-001 RLS, FP-002 ENV |
| Shared | 3 | FP-007 empty content, FP-008 JSON fences |
| Idris App | 8 | FP-011 PWA mic, FP-015 profile injection |
| **Total** | **17** | |

Last updated: 2026-05-01 | Next review: after Idris App Phase 2
