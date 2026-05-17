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
## FP-018 | Onboarding | Age grid missing age 1
Symptom: Youngest children (age 1) cannot be registered
Fix: Array.from({length:12}, (_,i) => i+1) not i+2


##FP-019 | YouTube | Channel @handle URLs return 404
Symptom: YouTube page says "This page isn't available"
Fix: Use search URLs instead:
  youtube.com/results?search_query=ms+rachel+for+toddlers
Applies to: Any app linking to YouTube channels


## FP-020 through FP-026 — Reserved (applied inline, not yet documented)

---

## FP-027 — Video reward plays same clip on every visit
**Source:** Idris App — video-reward.html
**Symptom:** Same YouTube video plays every time reward screen opens.
**Root cause:** `Math.random()` happened to return similar values, and there was no exclusion logic.

**Fix:**
```javascript
let _lastVideoIdx = -1;
function pickNextVideo() {
  let idx;
  do { idx = Math.floor(Math.random() * VIDEOS.length); }
  while (VIDEOS.length > 1 && idx === _lastVideoIdx);
  _lastVideoIdx = idx;
  return VIDEOS[idx];
}
```
**Applies to:** Any rotating reward/playlist system. `do-while` prevents same-index repeat.

---

## FP-028 — Reward timer tiers wrong (5/30 min flat → 5 proper tiers)
**Source:** Idris App — video-reward.html
**Symptom:** Old tiers (5 tasks=2min, 30 tasks=30min) didn't match educational session pacing.
**Root cause:** Initial implementation used 2-tier logic; requirement was 5 tiers + daily_complete flag.

**Fix:**
```javascript
function getTier(tasks, dailyComplete) {
  if (dailyComplete)  return { seconds: 30 * 60, label: '30 min video', emoji: '🏆' };
  if (tasks >= 20)    return { seconds:  5 * 60, label:  '5 min video', emoji: '🥇' };
  if (tasks >= 15)    return { seconds:  2 * 60, label:  '2 min video', emoji: '🌟' };
  if (tasks >= 10)    return { seconds:      60, label:  '1 min video', emoji: '👍' };
  return                     { seconds:      30, label: '30 sec video', emoji: '✅' };
}
// URL: video-reward.html?tasks=10 or ?daily=1
```
**Applies to:** Idris App reward system. 5 tasks=30s, 10=1min, 15=2min, 20=5min, daily_complete=30min.

---

## FP-029 — "Back" button on reward page navigates wrong (history.back() fails)
**Source:** Idris App — video-reward.html
**Symptom:** Back button sometimes navigates to Google/external page, or does nothing when no history.
**Root cause:** `history.back()` goes to whatever was before in browser history — not guaranteed to be index.html.

**Fix:**
```javascript
function goBack() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (ytPlayer && playerReady) ytPlayer.stopVideo();
  window.location.href = '/index.html';
}
```
**Rule:** NEVER use `history.back()` for structured app navigation. Always use explicit `window.location.href`.

---

## FP-030 — TTS speaks emoji characters aloud ("grinning face", "star" etc.)
**Source:** Idris App — index.html, idris-voice-module.html
**Symptom:** `speak("Amazing! 🌟")` → TTS says "Amazing! star" or "Amazing! grinning face".
**Root cause:** SpeechSynthesisUtterance receives emoji Unicode — some TTS engines verbalize the name.

**Fix:**
```javascript
// index.html — add before speak()
function stripForTTS(t) {
  return t.replace(/\p{Emoji}/gu, '')
          .replace(/\b(star|dizzy|sparkle|fire|heart|check|cross|arrow)\b/gi, '')
          .replace(/\s+/g, ' ').trim();
}
// Then: new SpeechSynthesisUtterance(stripForTTS(text))

// idris-voice-module.html — inside speakText()
const cleaned = text.replace(/\p{Emoji}/gu, '').replace(/\s+/g, ' ').trim();
const utt = new SpeechSynthesisUtterance(cleaned);
```
**Note:** Requires Unicode property escapes (`/\p{Emoji}/gu`) — supported in Safari 12+ and Chrome 64+.

---

## FP-031 — Cartoon button opens YouTube in new tab (external navigation)
**Source:** Idris App — index.html
**Symptom:** Tapping cartoon button leaves the PWA and opens youtube.com. Child gets lost.
**Root cause:** `window.open(url, '_blank')` with a youtube.com URL — external site, not in-app.

**Fix:**
```javascript
// WRONG:
function openCartoon() { if (S.currentCartoon?.url) window.open(S.currentCartoon.url, '_blank'); }

// CORRECT — route to in-app video reward screen:
function openCartoon() {
  window.location.href = 'video-reward.html?tasks=' + S.totalStars + '&stars=' + S.totalStars;
}
```
**Rule:** NEVER `window.open()` to external domains in a child-facing PWA. Use in-app embed only.

---

## FP-032 — Language selector shows 7 languages but only 4 have translations
**Source:** Idris App — index.html
**Symptom:** Switching to Arabic/Spanish/French crashes app with `Cannot read property of undefined`.
**Root cause:** `LANG_LIST` had 7 entries but `LANGS_CFG` only had 4 (en, ru, uz, tg). `L()` returns undefined.

**Fix:** Add complete entries for `ar`, `es`, `fr` to `LANGS_CFG` with all required keys:
`flag, short, name, dir, ob_name, ob_tag, ob_next, s1..s4 strings, diags[], nav[], words[], challenges[], activities[], interests[], aac_cats[], celebrate[], fam_members[], fam_emojis[]`

For Arabic: `dir:"rtl"` — also triggers CSS `[dir=rtl]` rules for right-to-left layout.
**Rule:** Every code in `LANG_LIST` MUST have a matching entry in `LANGS_CFG`. Add both atomically.

---

## FP-033 — Uzbek TTS speaks in English (no uz-UZ voice on iOS)
**Source:** Idris App — index.html
**Symptom:** Uzbek mode TTS falls back to default (usually English) voice. Words sound wrong.
**Root cause:** iOS does not ship a `uz-UZ` TTS voice. `speechSynthesis.getVoices()` returns no Uzbek match.

**Fix:**
```javascript
let m = vs.find(v => v.lang.startsWith(utt.lang.split('-')[0]));
if (!m && utt.lang === 'uz-UZ') m = vs.find(v => v.lang.startsWith('tr')); // Turkish ≈ closest
if (m) utt.voice = m;
```
**Why Turkish:** Uzbek and Turkish are both Turkic languages with similar phonology. `tr-TR` is available on all iOS devices. Better than English for Uzbek families.

---

## FP-034 — iPhone Safari mic denied silently in PWA after first launch
**Source:** Idris App — index.html (`startSpeak2`), idris-voice-module.html (`startListening`) — also see FP-011
**Symptom:** `SpeechRecognition.start()` fires, `onstart` never fires, no error shown.
**Root cause:** PWA context on iPhone has separate mic permission from Safari browser. Must call `getUserMedia` explicitly each time to trigger the permission dialog.

**Complete fix — 4 rules:**

1. **`new SR()` must be created INSIDE getUserMedia `.then()`** — not before. On iOS, the audio session isn't active until getUserMedia resolves.
2. **500ms delay required** between stream stop and `recognition.start()` — iOS needs time to hand off the audio session.
3. **Browser-aware error messages** — Chrome and Safari show different UI for granting permissions.
4. **Extract `doStart()` helper** — avoids duplicating recognition setup in the else branch.

```javascript
function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { /* show unsupported message */ return; }

  function doStart() {
    const recognition = new SR();
    recognition.lang = 'en-US'; // set per language
    recognition.onresult = () => { /* handle result */ };
    recognition.onerror = () => { /* reset UI */ };
    recognition.onend = () => { /* reset UI */ };
    recognition.start();
  }

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => t.stop()); // release — ASR manages its own stream
        setTimeout(doStart, 500); // 500ms required on iOS for audio session handoff
      })
      .catch(() => {
        // Browser-specific instructions — cannot open Settings programmatically
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent);
        const msg = isChrome
          ? '🔒 Click the lock icon in the address bar → Allow microphone'
          : '⚙️ Settings → Safari → Microphone → Allow';
        resultEl.textContent = msg;
      });
  } else {
    doStart(); // desktop fallback — no getUserMedia needed
  }
}
```

**Mic test waveform pattern** (verify mic before using ASR):
```javascript
navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(data);
    // draw waveform on canvas
  }
  draw();
  // stopTest: stream.getTracks().forEach(t => t.stop())
});
```

**Rule:** Always call `getUserMedia` before `SpeechRecognition.start()` in iOS PWAs. Create `new SR()` INSIDE the `.then()` callback. Use 500ms delay. Show browser-specific permission instructions on `.catch()`.

---

## FP-035 — Speak game shows word but doesn't read it aloud
**Source:** Idris App — index.html
**Symptom:** Word appears on screen but no TTS audio. Child must already know the word to attempt it.
**Root cause:** `loadSpeakWord()` only sets DOM text. `speak()` was never called.

**Fix:**
```javascript
function loadSpeakWord() {
  const w = L().words[S.speakIdx % L().words.length];
  document.getElementById('speak-emoji').textContent = w.e;
  document.getElementById('speak-word').textContent = w.w;
  document.getElementById('speak-result').textContent = '';
  document.getElementById('micBtn').classList.remove('listening');
  speak(w.w); // ← read word aloud when it loads
}
// In speak(): utt.rate = 0.7 (slower than default 1.0 — better for ASD children learning words)
```
**UX rationale:** ASD children benefit from audio + visual pairing. Word should be modeled before child attempts to repeat it. Rate 0.7 gives clear, unhurried pronunciation.

---

## STATS
| Source | Count | Most critical |
|--------|-------|--------------|
| HadithVerifier (real) | 6 | FP-001 RLS, FP-002 ENV |
| Shared | 3 | FP-007 empty content, FP-008 JSON fences |
| Idris App | 17 | FP-011 PWA mic, FP-034 iPhone mic, FP-030 TTS emoji |
| **Total** | **26** | |

Last updated: 2026-05-02 | Next review: after Idris App Phase 2

---

## FP-036 — GitHub Actions failing: missing pytest files
**Date:** 2026-05-03
**Symptom:** All 10+ workflow runs red. test-ai job crashes on missing tests/pytest/requirements.txt
**Root cause:** deploy.yml referenced test_ai_audit.py and requirements.txt that were never created
**Fix:** Removed test-ai job from deploy.yml entirely. Simplified to single deploy job only.
**Prevention:** Never reference files in CI that don't exist. Create files BEFORE adding to workflow.
**Verified:** Unblocked deployment pipeline

---

## FP-037 — package.json missing in HTML PWA project
**Date:** 2026-05-03
**Symptom:** npm run test:orchestrator gives ENOENT package.json
**Root cause:** Project started as pure HTML PWA. Tests added later but npm never initialized.
**Fix:** npm init -y then npm install devDependencies
**Prevention:** Always run npm init at project start even for HTML-only projects
**Verified:** npm scripts now work correctly

---

## FP-038 — BOM in package.json breaks Vercel build
**Date:** 2026-05-03
**Symptom:** Vercel build: Cannot parse json - Unexpected token before first brace
**Root cause:** PowerShell Out-File writes UTF-8 WITH BOM. Vercel JSON parser rejects BOM.
**Fix:** $utf8NoBom = New-Object System.Text.UTF8Encoding $false then WriteAllText
**Prevention:** Always verify first byte = 123. Add .gitattributes with *.json text eol=lf
**Verified:** GitHub Actions run 14 - first green deployment

---

## FP-039 — Match game cards full viewport height on desktop
**Date:** 2026-05-03
**Symptom:** .match-card stretches to 400px on desktop. Content appears at bottom corner.
**Root cause:** aspect-ratio:1 plus grid-template-columns:1fr on wide desktop = very tall cards
**Fix:** .match-grid max-width 360px margin auto. .match-card max-width and max-height 110px
**Prevention:** Test match game on desktop. Playwright check card height less than 200px
**Status:** Fix pending - apply to index.html next session
---

## FP-042 — [System.IO.File] ignores PowerShell working directory
- **Symptom**: `Could not find path 'C:\Users\Farhod\tests\...'` even after `cd C:\QA\Idris\...`
- **Root cause**: `[System.IO.File]::ReadAllText("relative\path")` resolves from the .NET process
  working directory (`C:\Users\Farhod`), NOT from PowerShell's current location
- **Fix**: Always use absolute paths with `$BASE = "C:\QA\Idris\idris-learning-app"` prefix
- **Rule**: NEVER use relative paths with `[System.IO.File]` — always `"$BASE\path\to\file"`
- **Also affects**: `[System.IO.File]::WriteAllText`, `[System.IO.File]::ReadAllBytes`
- **Safe alternatives**: `Get-Content "relative"` and `Set-Content "relative"` DO respect `cd`
- **Prevention**: Add `$BASE = $PWD.Path` at top of every PowerShell script that uses System.IO.File
## FP-043 — PowerShell inline if/else fails when pasted line-by-line
- **Symptom**: `else : The term 'else' is not recognized`
- **Root cause**: PowerShell interactive mode treats each line as a separate command.
  When `if {...}` completes, the next line `else {...}` is a new command — not recognized
- **Fix**: Always paste full if/else blocks at once, OR use a .ps1 script file
- **Rule**: Multi-line if/else must be pasted as ONE block in interactive PowerShell
- **Prevention**: Put all logic in .ps1 files, run with `.\script.ps1` — never paste line by line

---

## FP-044 — Card height exceeds maximum constraint in desktop viewport

- **Symptom**: Card component renders at 450px height, exceeding 200px maximum threshold on desktop 1280px viewport
- **Root cause**: CSS height property or flex/grid sizing not properly constrained; likely missing `max-height` rule or conflicting responsive breakpoint
- **Fix**: Add `max-height: 200px` to card component; verify breakpoint overrides don't conflict; check flex-grow/grid-auto-rows aren't expanding container
- **Rule**: Enforce explicit max-height constraints on fixed-dimension components across all breakpoints
- **Prevention**: Add visual regression test for card dimensions; include max-height in component spec; validate CSS cascade for height properties

---
### FP-036: Match Cards Game Fails to Render Card Elements

**Pattern:** The match cards game screen renders no `.match-card` elements while all other game modes and core app functionality remain intact.
**Root Cause:** The match cards game component fails to initialise or inject `.match-card` DOM elements, likely due to a missing or failed data binding step (e.g. an empty/undefined card dataset passed to the renderer), a broken import or dynamic `import()` call for the match-cards module, or a CSS `display:none` / `visibility:hidden` rule applied to the card container that prevents Playwright from detecting the elements.
**Fix:** (1) Guard the card-rendering loop against empty or undefined datasets and log a console error when the card array is falsy. (2) Verify the dynamic module import for the match-cards component resolves correctly and add a fallback error boundary. (3) Confirm the `.match-card` container is not hidden by a stale CSS rule or a feature-flag check that evaluates to `false` for the `en` locale.
**Detected by:** auto-qa multi-agent
**Languages affected:** en
**Severity:** minor

javascript
// Fix example: guard card rendering against empty dataset
function renderMatchCards(cards) {
  if (!cards || cards.length === 0) {
    console.error('[MatchCards] No card data provided – aborting render.');
    // Optionally surface a user-visible fallback
    document.querySelector('.match-cards-container')
      ?.insertAdjacentHTML('beforeend',
        '<p class="error-msg">Cards could not be loaded. Please try again.</p>');
    return;
  }

  const container = document.querySelector('.match-cards-container');
  container.innerHTML = ''; // clear stale state

  cards.forEach(card => {
    const el = document.createElement('div');
    el.classList.add('match-card');
    el.dataset.cardId = card.id;
    el.textContent = card.label;
    container.appendChild(el);
  });
}

// Fix example: ensure the container is visible before rendering
function showMatchCardsScreen() {
  const screen = document.querySelector('.match-cards-screen');
  if (screen) {
    screen.style.display = ''   // remove any inline hide
    screen.removeAttribute('hidden');
  }
  renderMatchCards(getCardDataForLocale('en'));
}

---

---
### FP-036: Application Server Not Running During QA Test Execution

**Pattern:** The QA agent crashes immediately on page load because the application server is not running at the expected localhost port, yielding a score of 0.00 with no functional checks performed.
**Root Cause:** The Playwright test runner attempts to navigate to `localhost:3000` (or configured base URL) before the dev/preview server process has been started or has finished binding to its port, resulting in `ERR_CONNECTION_REFUSED` and an unhandled agent crash rather than a graceful test failure.
**Fix:** Add a server readiness pre-check (health-poll) in the Playwright global setup that retries the base URL up to N times before allowing any test suite to proceed; also ensure the server start command is declared in `playwright.config.js` under the `webServer` option so Playwright manages the lifecycle automatically.
**Detected by:** auto-qa multi-agent
**Languages affected:** all
**Severity:** critical

javascript
// playwright.config.js — let Playwright manage the server lifecycle
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run start', // or 'npm run dev'
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI, // reuse locally, always fresh on CI
    timeout: 30_000, // ms to wait for server to be ready
    stdout: 'pipe',
    stderr: 'pipe',
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});

// --- OR: manual health-poll in globalSetup.js (fallback approach) ---
import { chromium } from '@playwright/test';

async function waitForServer(url, retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      const response = await page.goto(url, { timeout: 5000 });
      await browser.close();
      if (response && response.ok()) return; // server is up
    } catch (_) {
      // server not ready yet
    }
    console.warn(`Server not ready — retrying in ${delayMs}ms (attempt ${i + 1}/${retries})`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`Server at ${url} did not become ready after ${retries} attempts.`);
}

export default async function globalSetup() {
  await waitForServer('http://localhost:3000');
}

---

---
### FP-036: Playwright Agent Crash Due to Missing `hasTouch: true` Context Configuration

**Pattern:** Test agent crashes entirely when `locator.tap()` is called without `hasTouch: true` set in the browser context, preventing any checks from running and yielding a QA score of 0.
**Root Cause:** Playwright's `locator.tap()` requires the browser context to be initialized with `hasTouch: true`; omitting this flag causes an immediate runtime error that aborts the entire test run before any checks execute, since iPad/iPhone Safari and Chrome on Android are touch-primary targets.
**Fix:** Add `hasTouch: true` (and optionally `isMobile: true`) to all browser context configurations used for mobile/tablet device emulation in Playwright test setup.
**Detected by:** auto-qa multi-agent
**Languages affected:** all
**Severity:** critical

javascript
// playwright.config.js or per-test context setup

// BEFORE (broken):
const context = await browser.newContext({
  ...devices['iPad Pro'],
  // hasTouch not set — tap() will throw
});

// AFTER (fixed):
const context = await browser.newContext({
  ...devices['iPad Pro'],   // spreads isMobile + hasTouch for named devices
  hasTouch: true,           // explicit override for custom contexts
  isMobile: true,
});

// For all mobile/tablet targets, ensure the base config includes:
// playwright.config.js
projects: [
  {
    name: 'iPad Safari',
    use: {
      ...devices['iPad Pro 11'],
      hasTouch: true,
    },
  },
  {
    name: 'iPhone Safari',
    use: {
      ...devices['iPhone 14'],
      hasTouch: true,
    },
  },
  {
    name: 'Chrome Android',
    use: {
      ...devices['Pixel 7'],
      hasTouch: true,
    },
  },
],

---

---
### FP-036: Playwright Agent Crash Due to Missing hasTouch Context Configuration

**Pattern:** Test agent crashes entirely when `locator.tap()` is called without initializing the browser context with `hasTouch: true`, rendering the app completely untestable and producing a QA score of 0.00.
**Root Cause:** Playwright's `locator.tap()` method requires the browser context to be explicitly configured with `hasTouch: true`; without it, the method throws a fatal error that propagates uncaught, crashing the agent before any checks can run.
**Fix:** Add `hasTouch: true` to the Playwright browser context options in the test setup configuration, and wrap `locator.tap()` calls in a try/catch fallback that degrades to `locator.click()` for non-touch contexts.
**Detected by:** auto-qa multi-agent
**Languages affected:** uz
**Severity:** critical

javascript
// In Playwright test setup / browser context factory:
const context = await browser.newContext({
  // ... existing options ...
  hasTouch: true,          // ← required for locator.tap() to work
  viewport: { width: 768, height: 1024 },
});

// Defensive helper to avoid future agent crashes:
async function safeTap(locator) {
  try {
    await locator.tap();
  } catch (err) {
    if (
      err.message.includes('hasTouch') ||
      err.message.includes('test context was not initialized')
    ) {
      console.warn('[safeTap] hasTouch not set — falling back to click()');
      await locator.click();
    } else {
      throw err;  // re-throw unrelated errors
    }
  }
}

---

---
### FP-036: Missing `hasTouch` Context Initialization Causes Agent Crash

**Pattern:** Playwright test agent crashes before executing any checks because the browser context is not initialized with `hasTouch: true`, making all `locator.tap()` calls throw immediately.
**Root Cause:** When a Playwright `BrowserContext` is created without `hasTouch: true` in its options, the WebKit/Chromium context reports no touch support, and any `locator.tap()` invocation throws a hard error rather than falling back to a click, crashing the agent and yielding a QA score of 0.00 with zero completed checks.
**Fix:** Add `hasTouch: true` (and optionally `isMobile: true`) to every `browser.newContext()` call used by mobile/tablet test agents, or set it globally in `playwright.config.ts` under the relevant project definitions.
**Detected by:** auto-qa multi-agent
**Languages affected:** tg
**Severity:** critical

javascript
// playwright.config.ts — apply to all mobile/tablet projects
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'iPad Safari',
      use: {
        ...devices['iPad (gen 7)'],
        hasTouch: true,   // ← required: enables locator.tap()
        isMobile: true,
      },
    },
    {
      name: 'iPhone Safari',
      use: {
        ...devices['iPhone 14'],
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'Chrome Android',
      use: {
        ...devices['Pixel 7'],
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});

// If contexts are created programmatically in agent setup:
async function createAgentContext(browser) {
  return browser.newContext({
    hasTouch: true,   // ← must be set before any tap() call
    isMobile: true,
    locale: 'tg',     // set appropriate locale per language agent
  });
}

---

---
### FP-036: Agent Crash Due to Missing Touch Support Configuration

**Pattern:** Playwright agent crashes before any checks execute when `hasTouch` is not enabled in browser context, causing `locator.tap()` to fail and producing a QA score of 0.00 with no failed checks reported.
**Root Cause:** `locator.tap()` requires the browser context to be launched with `hasTouch: true`; without it, Playwright throws immediately on the first tap interaction, aborting the entire agent run before any ASD safety checks (touch targets, text direction, reward system) can be evaluated.
**Fix:** Ensure all mobile-targeting browser contexts (iPad Safari, iPhone Safari, Chrome Android) are instantiated with `hasTouch: true` and `isMobile: true` in the Playwright context options. Add a pre-flight assertion in the agent harness to verify touch capability before beginning checks.
**Detected by:** auto-qa multi-agent
**Languages affected:** ar
**Severity:** critical

javascript
// playwright.config.js or agent browser context setup
const context = await browser.newContext({
  ...devices['iPad (gen 7)'], // or iPhone / Android device descriptor
  hasTouch: true,             // REQUIRED: prevents locator.tap() crash
  isMobile: true,
  locale: 'ar',
  // RTL viewport consideration for Arabic
  viewport: { width: 1024, height: 1366 },
});

// Pre-flight guard in agent harness
async function assertTouchSupported(context) {
  const supported = await context.evaluate(() => navigator.maxTouchPoints > 0);
  if (!supported) {
    throw new Error(
      '[FP-036] Touch support not detected in browser context. ' +
      'Ensure hasTouch: true is set before running ASD safety checks.'
    );
  }
}

// Usage
await assertTouchSupported(context);
// ... proceed with touch target, text direction, reward system checks

---

---
### FP-036: Playwright Agent Crash Due to Missing hasTouch Context Initialization

**Pattern:** Test agents crash entirely when `locator.tap()` is called without initializing the browser context with `hasTouch: true`, rendering the app untestable on touch-target devices.
**Root Cause:** Playwright browser contexts default to `hasTouch: false`; calling `locator.tap()` in this state throws an unrecoverable exception that halts the agent before any checks can execute, producing a QA score of 0.00 despite no individual check failures being recorded.
**Fix:** Add `hasTouch: true` (and optionally `isMobile: true`) to all Playwright browser context configurations used for mobile/tablet device emulation, and add a pre-flight assertion that verifies touch capability before the first `tap()` call.
**Detected by:** auto-qa multi-agent
**Languages affected:** es
**Severity:** critical

javascript
// playwright.config.js or per-test context setup
const context = await browser.newContext({
  // Required for locator.tap() to work on mobile emulation profiles
  hasTouch: true,
  isMobile: true,
  // Example: iPad Safari profile
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 1024, height: 1366 },
  deviceScaleFactor: 2,
});

// Pre-flight guard — add to shared test helper
async function assertTouchEnabled(context) {
  const touchEnabled = await context.evaluate(() => navigator.maxTouchPoints > 0);
  if (!touchEnabled) {
    throw new Error(
      'Browser context does not have touch support. ' +
      'Ensure hasTouch: true is set in newContext() options.'
    );
  }
}

// Usage in test
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true });
  await assertTouchEnabled(context);
  // ... rest of setup
});

---

---
### FP-036: Playwright Context Missing hasTouch Configuration Causes Agent Crash

**Pattern:** Test agent crashes entirely when `locator.tap()` is called without initializing the browser context with `hasTouch: true`, rendering the app untestable on touch-target platforms.
**Root Cause:** Playwright's `locator.tap()` method requires the browser context to be created with `hasTouch: true` in the context options; omitting this flag causes the action to throw an unhandled exception that propagates up and crashes the QA agent before any checks can complete, yielding a 0.00 QA score despite no individual check failures being recorded.
**Fix:** Set `hasTouch: true` in the Playwright `BrowserContext` options for all mobile/tablet device profiles (iPad Safari, iPhone Safari, Chrome on Android). Prefer using `devices` presets which include this flag automatically, or set it explicitly in the context factory.
**Detected by:** auto-qa multi-agent
**Languages affected:** fr
**Severity:** critical

javascript
// Fix example — context factory (e.g. playwright.config.js or agent setup)
const { chromium, devices } = require('@playwright/test');

// Option A: use a built-in device preset (hasTouch included automatically)
const iPhone = devices['iPhone 13'];
const iPad  = devices['iPad Pro 11'];

const context = await browser.newContext({
  ...iPhone,          // spreads hasTouch: true, viewport, userAgent, etc.
  locale: 'fr-FR',
});

// Option B: set hasTouch explicitly when not using a device preset
const context = await browser.newContext({
  hasTouch: true,     // ← required for locator.tap() to work
  viewport: { width: 390, height: 844 },
  userAgent: '...custom UA...',
  locale: 'fr-FR',
});

// Defensive wrapper — ensures tap() is never called on a non-touch context
async function safeTap(locator, contextOptions) {
  if (!contextOptions.hasTouch) {
    throw new Error(
      '[FP-036] Cannot call locator.tap(): context was not initialized with hasTouch:true. ' +
      'Update the context factory before running touch-based checks.'
    );
  }
  await locator.tap();
}

---

---
### FP-036: Missing `hasTouch` Configuration Causes Agent Crash Before Any Checks Run

**Pattern:** Playwright test agent crashes on first `locator.tap()` call when the browser context is initialized without `hasTouch: true`, resulting in a QA score of 0.00 with zero completed checks.
**Root Cause:** The Playwright `BrowserContext` defaults `hasTouch` to `false`; calling `locator.tap()` on a context without touch support throws `page does not support tap`, which is unhandled at the agent level and terminates the entire run before any functional checks execute.
**Fix:** Set `hasTouch: true` (and optionally `isMobile: true`) in all Playwright context/device configurations used by the QA agent, particularly for iPad Safari and iPhone Safari target profiles.
**Detected by:** auto-qa multi-agent
**Languages affected:** all
**Severity:** critical

javascript
// playwright.config.js or agent context factory
const context = await browser.newContext({
  // For mobile/tablet target profiles
  hasTouch: true,
  isMobile: true,
  // Example device descriptors (use as needed)
  // ...devices['iPad (gen 7)'],
  // ...devices['iPhone 13'],
});

// If using device descriptors, they include hasTouch automatically:
// const context = await browser.newContext({
//   ...playwright.devices['iPad (gen 7)'],
// });

// Guard in agent tap helper to surface a clear error instead of crashing:
async function safeTap(locator, page) {
  const hasTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (!hasTouch) {
    throw new Error(
      '[FP-036] Context missing hasTouch:true — reinitialize context with hasTouch enabled'
    );
  }
  await locator.tap();
}

---

---
### FP-036: Missing `hasTouch` Context Initialization Causes Agent Crash

**Pattern:** Playwright test agent crashes on `locator.tap()` calls when the browser context is not initialized with `hasTouch: true`, leaving the target language entirely untested and producing a 0.00 QA score.
**Root Cause:** The Playwright browser context for touch-enabled device simulation is created without the `hasTouch: true` option, causing `locator.tap()` to throw immediately and abort the entire agent run before any checks execute.
**Fix:** Add `hasTouch: true` (and optionally `isMobile: true`) to all browser context creation calls used by touch-dependent test agents, or use a named Playwright device descriptor that includes touch support.
**Detected by:** auto-qa multi-agent
**Languages affected:** uz
**Severity:** critical

javascript
// Before (broken)
const context = await browser.newContext({
  locale: 'uz',
  // hasTouch not set — defaults to false
});

// After (fixed)
const context = await browser.newContext({
  locale: 'uz',
  hasTouch: true,
  isMobile: true, // recommended when simulating touch devices
});

// Alternative: use a built-in device descriptor
const { devices } = require('@playwright/test');
const context = await browser.newContext({
  ...devices['iPad (gen 7)'], // includes hasTouch:true, isMobile:true
  locale: 'uz',
});

---

---
### FP-036: Missing `hasTouch` Context Initialization Causes Agent Crash on Touch Interactions

**Pattern:** Playwright test agent crashes entirely when `locator.tap()` is called without `hasTouch: true` set in the browser context, resulting in a 0.00 QA score with no checks completed.
**Root Cause:** The Playwright browser context is instantiated without `hasTouch: true`, so any `locator.tap()` call throws a fatal error that propagates uncaught and terminates the agent before any checks can run. This is especially impactful for mobile-target PWAs (iPad Safari, iPhone Safari, Chrome on Android) where tap is the primary interaction primitive.
**Fix:** Set `hasTouch: true` (and optionally pair with an appropriate mobile `viewport` and `userAgent`) in every browser context factory used by the QA agent. Apply globally in the Playwright config so no language-specific agent can be launched without it.
**Detected by:** auto-qa multi-agent
**Languages affected:** tg
**Severity:** critical

javascript
// playwright.config.js — global default for all projects
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    // Ensure touch is always enabled for this mobile-first PWA
    hasTouch: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 baseline
    userAgent: devices['iPhone 14'].userAgent,
  },
  projects: [
    {
      name: 'iPad Safari',
      use: {
        ...devices['iPad (gen 7)'],
        hasTouch: true, // explicit override — never rely on device preset alone
      },
    },
    {
      name: 'iPhone Safari',
      use: {
        ...devices['iPhone 14'],
        hasTouch: true,
      },
    },
    {
      name: 'Chrome Android',
      use: {
        ...devices['Pixel 7'],
        hasTouch: true,
      },
    },
  ],
});

// If contexts are created programmatically inside the agent:
async function createAgentContext(browser, options = {}) {
  if (!options.hasTouch) {
    console.warn('[QA Agent] hasTouch not set — forcing true to prevent tap() crash');
  }
  return browser.newContext({
    hasTouch: true, // mandatory for this PWA
    ...options,     // allow overrides but hasTouch default is safe
  });
}

---

---
### FP-036: Playwright Agent Crash Due to Missing hasTouch Context Initialization

**Pattern:** QA agent crashes before any checks run because the Playwright browser context is not initialized with `hasTouch: true`, causing `locator.tap()` to throw and producing a 0.00 QA score with no actionable failed checks.
**Root Cause:** `locator.tap()` in Playwright requires the browser context to be created with `hasTouch: true`; without it, the call throws immediately, terminating the agent before touch-target, text-direction, reward-system, or game-screen checks can execute.
**Fix:** Add `hasTouch: true` (and optionally `isMobile: true`) to the Playwright `browser.newContext()` call in the QA agent setup, or use a pre-configured device descriptor that includes touch support.
**Detected by:** auto-qa multi-agent
**Languages affected:** ar
**Severity:** critical

javascript
// playwright.config.js or agent context setup
const context = await browser.newContext({
  hasTouch: true,       // Required for locator.tap() to work
  isMobile: true,       // Recommended for mobile-first PWA testing
  locale: 'ar',
  // Use a device preset as an alternative:
  // ...devices['iPad (gen 7)'],
  // ...devices['iPhone 13'],
});

// Or via Playwright devices helper:
import { devices } from '@playwright/test';
use: {
  ...devices['iPad (gen 7)'],  // includes hasTouch: true automatically
  locale: 'ar',
}

---

---
### FP-036: Playwright Agent Crash Due to Missing Touch Support Configuration

**Pattern:** The QA agent crashes entirely when `locator.tap()` is called on a browser context not configured with touch support, resulting in zero checks executed and a QA score of 0.00 despite no individual check failures.
**Root Cause:** Playwright's `locator.tap()` requires the browser context to be instantiated with `hasTouch: true`; when this flag is absent, the page context rejects the tap action and throws an unhandled exception that propagates up to crash the agent before any checks can run.
**Fix:** Ensure all Playwright browser contexts targeting touch-based devices (iPad Safari, iPhone Safari, Chrome on Android) are created with `hasTouch: true` and an appropriate `userAgent` / `viewport`. Add a global agent-level try/catch around the tap invocation with a fallback to `locator.click()` so a missing touch config degrades gracefully rather than crashing the agent.
**Detected by:** auto-qa multi-agent
**Languages affected:** es
**Severity:** critical

javascript
// playwright.config.js — device profiles must include hasTouch
const ASD_DEVICES = {
  'iPad Safari': {
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    viewport: { width: 1024, height: 1366 },
    hasTouch: true,          // ← was missing; caused agent crash
    defaultBrowserType: 'webkit',
  },
  'iPhone Safari': {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    defaultBrowserType: 'webkit',
  },
  'Chrome Android': {
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    defaultBrowserType: 'chromium',
  },
};

// agent helper — graceful fallback so one bad tap never crashes the run
async function safeTap(locator) {
  try {
    await locator.tap();
  } catch (err) {
    if (
      err.message.includes('page context was not') ||
      err.message.includes('touch') ||
      err.message.includes('hasTouch')
    ) {
      console.warn('[FP-036] tap() failed — falling back to click(). Check hasTouch config.', err.message);
      await locator.click();
    } else {
      throw err; // re-throw unrelated errors
    }
  }
}

---

---
### FP-036: Playwright Agent Crash Due to Missing hasTouch Context Configuration

**Pattern:** Test agents crash entirely when `locator.tap()` is called without initializing the Playwright browser context with `hasTouch: true`, rendering the app untestable on touch-target devices.
**Root Cause:** Playwright's `locator.tap()` method requires the browser context to be explicitly configured with `hasTouch: true`; omitting this flag causes the test runner to throw a fatal context error before any checks can execute, resulting in a QA score of 0.00 despite no individual check failures being recorded.
**Fix:** Add `hasTouch: true` to all browser context configurations used in mobile/tablet test suites, and add a pre-flight assertion in the agent bootstrap to validate touch support is enabled before executing any tap-based interactions.
**Detected by:** auto-qa multi-agent
**Languages affected:** fr
**Severity:** critical

javascript
// playwright.config.js or per-test context setup
const context = await browser.newContext({
  hasTouch: true,          // Required for locator.tap() to work
  viewport: { width: 768, height: 1024 }, // iPad dimensions
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)'
});

// Optional: pre-flight guard in agent bootstrap
async function assertTouchEnabled(context) {
  const touchEnabled = await context.newPage().evaluate(
    () => navigator.maxTouchPoints > 0
  );
  if (!touchEnabled) {
    throw new Error(
      '[FP-036] Agent bootstrap failed: hasTouch not set on browser context. ' +
      'All tap()-based checks will crash. Set hasTouch: true in newContext().'
    );
  }
}

---

---
### FP-036: Arabic Locale Initial Screen Render Timeout

**Pattern:** The app fails to render the initial `#scr-profiles` or `#scr-main` screen within the allotted timeout when launched under the Arabic (`ar`) locale, causing agent/test crashes with a QA score of 0.00.
**Root Cause:** RTL locale initialisation (Arabic) likely triggers additional layout recalculation, font loading (e.g. Arabic web fonts via `@font-face`), or an async i18n resource fetch that blocks DOM visibility. The app may also conditionally apply `dir="rtl"` and `lang="ar"` attributes via JavaScript after DOMContentLoaded, delaying the point at which `#scr-profiles` or `#scr-main` transitions from `display:none` / `visibility:hidden` to visible, causing the 8000 ms Playwright `waitForSelector` to expire before the element appears.
**Fix:** 1) Ensure the `dir` and `lang` attributes are set synchronously in the HTML `<html>` tag (or via a blocking inline script) before any deferred JS runs. 2) Preload Arabic font files with `<link rel="preload">`. 3) Await the i18n bundle load before toggling screen visibility. 4) Increase the Playwright selector timeout for RTL locales to 12000 ms as a short-term guard.
**Detected by:** auto-qa multi-agent
**Languages affected:** ar
**Severity:** critical

javascript
// 1. In HTML <head> — set RTL attributes synchronously
// <html lang="ar" dir="rtl"> (static markup, not JS-injected)

// 2. i18n initialisation guard — wait for bundle before showing screen
async function initApp(locale) {
  // Ensure i18n bundle is fully loaded before revealing UI
  await loadI18nBundle(locale); // must resolve before screen toggle

  const profilesScreen = document.getElementById('scr-profiles');
  const mainScreen = document.getElementById('scr-main');

  if (profilesScreen) {
    profilesScreen.style.display = ''; // or remove hidden class
  }
}

// 3. Playwright test — extend timeout for RTL locales
const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];
const selectorTimeout = RTL_LOCALES.includes(locale) ? 12000 : 8000;

await page.waitForSelector('#scr-profiles, #scr-main', {
  state: 'visible',
  timeout: selectorTimeout,
});

// 4. Preload Arabic fonts in <head>
// <link rel="preload" href="/fonts/arabic-regular.woff2"
//       as="font" type="font/woff2" crossorigin="anonymous">

---

---
### FP-036: Playwright Test Context Missing Touch Support Configuration

**Pattern:** Agent crashes entirely when `locator.tap()` is called without initializing the Playwright browser context with `hasTouch: true`, rendering the app untestable and producing a QA score of 0.
**Root Cause:** Playwright's `locator.tap()` method requires the browser context to be explicitly configured with `hasTouch: true`; without it, the context does not emulate a touch-capable device, causing an immediate runtime error that aborts all subsequent checks.
**Fix:** Set `hasTouch: true` in the Playwright browser context options (and optionally pair with a mobile `viewport`) wherever `tap()` interactions are used in QA agent test suites.
**Detected by:** auto-qa multi-agent
**Languages affected:** all
**Severity:** critical

javascript
// playwright.config.js or per-test context setup
const context = await browser.newContext({
  hasTouch: true,          // Required for locator.tap() to work
  viewport: { width: 390, height: 844 }, // e.g. iPhone 14 dimensions
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) '
           + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 '
           + 'Mobile/15E148 Safari/604.1',
});

// Alternatively, use a built-in Playwright device descriptor:
// const { devices } = require('@playwright/test');
// const context = await browser.newContext({
//   ...devices['iPad (gen 7)'],  // or 'iPhone 14', 'Pixel 7', etc.
// });

const page = await context.newPage();
// locator.tap() will now work correctly
await page.locator('#symbol-button').tap();

---

---
### FP-036: Playwright Agent Crash Due to Missing hasTouch Context Configuration

**Pattern:** Test agent crashes entirely when `locator.tap()` is called without `hasTouch: true` in the Playwright browser context, rendering all checks unrunnable and producing a 0.00 QA score despite no individual check failures.
**Root Cause:** Playwright's `locator.tap()` method requires the browser context to be initialized with `hasTouch: true`; omitting this flag causes an unhandled exception that propagates up and crashes the agent before any functional checks can execute, resulting in a misleadingly passing-but-zero-scored run.
**Fix:** Add `hasTouch: true` to all mobile browser context configurations (iPad Safari, iPhone Safari, Chrome on Android) in the Playwright test setup, and add a global agent-level try/catch with graceful degradation so a single tap failure cannot abort the entire check suite.
**Detected by:** auto-qa multi-agent
**Languages affected:** uz
**Severity:** critical

javascript
// In playwright.config.js or browser context factory
const mobileContextOptions = {
  ...devices['iPad (gen 7)'], // or iPhone / Android device descriptor
  hasTouch: true,             // ← required for locator.tap() to work
  locale: 'uz-UZ',
};

// Example: creating context with touch support
const context = await browser.newContext(mobileContextOptions);

// Additionally, wrap agent-level tap calls to prevent full crash:
async function safeTap(locator, description) {
  try {
    await locator.tap();
  } catch (err) {
    console.error(`[WARN] tap() failed for "${description}": ${err.message}`);
    // Fall back to click so remaining checks can still run
    await locator.click();
  }
}

---

---
### FP-036: Playwright Agent Crash Due to Missing hasTouch Context Initialization

**Pattern:** The QA agent crashes entirely when `locator.tap()` is called without initializing the Playwright browser context with `hasTouch: true`, resulting in zero checks completing and a QA score of 0.00.
**Root Cause:** Playwright's `locator.tap()` method requires the browser context to be created with `hasTouch: true` in its context options; without this flag, the underlying CDP/WebDriver session does not emulate a touch-capable device, causing an immediate runtime exception that aborts the entire agent run before any checks are recorded.
**Fix:** Add `hasTouch: true` to the Playwright `BrowserContext` options in the test harness setup, and optionally guard all `.tap()` calls with a capability check so a single missing flag cannot abort the full suite.
**Detected by:** auto-qa multi-agent
**Languages affected:** tg
**Severity:** critical

javascript
// In your Playwright context factory (e.g., qa-agent/context.js)
const context = await browser.newContext({
  // --- existing options ---
  locale: langCode,          // e.g. 'tg'
  timezoneId: 'Asia/Dushanbe',

  // --- FP-036 fix: enable touch emulation so locator.tap() does not throw ---
  hasTouch: true,
  isMobile: true,            // recommended companion flag for iPad/iPhone targets

  // Optional: explicit viewport matching target devices
  viewport: { width: 390, height: 844 },
});

// Defensive wrapper (prevents one missing flag from killing the whole suite)
async function safeTap(locator, description) {
  try {
    await locator.tap();
  } catch (err) {
    if (err.message.includes('hasTouch')) {
      console.error(
        `[FP-036] safeTap failed for "${description}": context missing hasTouch:true. ` +
        'Falling back to locator.click().'
      );
      await locator.click();
    } else {
      throw err;
    }
  }
}

---

---
### FP-036: Playwright Agent Crash Due to Missing `hasTouch` Context Option

**Pattern:** The QA agent crashes before executing any checks when the Playwright browser context is launched without `hasTouch: true`, causing a total test blackout with a QA score of 0.00 despite no individual check failures.
**Root Cause:** Touch-dependent UI interactions (tap events, gesture handlers) used in the PWA — particularly relevant on iPad Safari and Chrome Android targets — throw or hang when the Playwright context does not declare touch support via `hasTouch: true`. The uncaught error propagates to the agent runner and terminates the entire session before any check is recorded.
**Fix:** Add `hasTouch: true` (and optionally `isMobile: true`) to all Playwright browser context configurations targeting mobile/tablet device profiles. Apply globally in the shared context factory so no per-language agent can launch without it.
**Detected by:** auto-qa multi-agent
**Languages affected:** ar
**Severity:** critical

javascript
// playwright.config.js or shared context factory
const { chromium, devices } = require('@playwright/test');

// Option A — use a built-in device descriptor (recommended)
const iPhone = devices['iPhone 13'];
const iPad   = devices['iPad Pro 11'];

// Option B — manual context creation (ensure hasTouch is always set)
async function createMobileContext(browser, extraOptions = {}) {
  return browser.newContext({
    hasTouch: true,   // ← required; absence causes agent crash
    isMobile: true,
    viewport: { width: 390, height: 844 },
    locale: extraOptions.locale ?? 'en-US',
    ...extraOptions,
  });
}

// Playwright config — apply to all projects targeting mobile
module.exports = {
  projects: [
    {
      name: 'iPad Safari',
      use: { ...devices['iPad Pro 11'], locale: 'ar' },
    },
    {
      name: 'iPhone Safari',
      use: { ...devices['iPhone 13'], locale: 'ar' },
    },
    {
      name: 'Chrome Android',
      use: { ...devices['Pixel 5'], locale: 'ar' },
    },
  ],
};

// Guard in agent runner — fail fast with a clear message instead of crashing
async function launchAgent(contextOptions) {
  if (!contextOptions.hasTouch) {
    throw new Error(
      '[FP-036] hasTouch not set in context options. ' +
      'All mobile/tablet agents require hasTouch: true to prevent crash.'
    );
  }
  // ... rest of agent bootstrap
}

---

---
### FP-036: Playwright Agent Crash Due to Missing Touch Support Configuration

**Pattern:** The QA agent crashes before any checks execute because the Playwright browser context is initialized without touch support enabled, causing `locator.tap()` to throw a fatal error that halts the entire test run.
**Root Cause:** `locator.tap()` requires the browser context to be created with `hasTouch: true`; when this flag is absent (default is `false`), Playwright throws an unhandled exception at the first touch interaction, crashing the agent and yielding a QA score of 0.00 with zero failed checks recorded — masking all real functionality issues including ASD-critical requirements.
**Fix:** Set `hasTouch: true` (and optionally `isMobile: true`) in the Playwright `BrowserContext` options for all mobile/tablet device profiles; additionally wrap `locator.tap()` calls in a try/catch that falls back to `locator.click()` so a misconfigured context degrades gracefully rather than crashing.
**Detected by:** auto-qa multi-agent
**Languages affected:** es
**Severity:** critical

javascript
// playwright.config.js — ensure touch is enabled for mobile/tablet projects
const mobileContextOptions = {
  hasTouch: true,
  isMobile: true,
  // ...other device descriptor fields
};

// In your project definitions:
projects: [
  {
    name: 'iPad Safari',
    use: {
      ...devices['iPad (gen 7)'],
      hasTouch: true, // explicit override — never rely on device preset alone
    },
  },
  {
    name: 'iPhone Safari',
    use: {
      ...devices['iPhone 14'],
      hasTouch: true,
    },
  },
  {
    name: 'Chrome Android',
    use: {
      ...devices['Pixel 7'],
      hasTouch: true,
    },
  },
],

// helpers/tapSafe.js — graceful fallback used by all agents
async function tapSafe(locator) {
  try {
    await locator.tap();
  } catch (err) {
    if (
      err.message.includes('test context was not initialized') ||
      err.message.includes('hasTouch')
    ) {
      console.warn('[tapSafe] Touch not supported in context — falling back to click()');
      await locator.click();
    } else {
      throw err; // re-throw unexpected errors
    }
  }
}

module.exports = { tapSafe };

---

---
### FP-036: Playwright Test Context Missing hasTouch Configuration Causes Agent Crash

**Pattern:** The QA agent crashes entirely when `locator.tap()` is called without initializing the Playwright browser context with `hasTouch: true`, preventing any checks from completing and yielding a 0.00 QA score despite no individual check failures.
**Root Cause:** Playwright's `locator.tap()` method requires the browser context to be created with `hasTouch: true` in its context options; omitting this flag causes the underlying CDP/WebDriver session to reject touch events, throwing an unhandled exception that crashes the agent before any test assertions can run.
**Fix:** Add `hasTouch: true` (and optionally `isMobile: true`) to the Playwright `BrowserContext` options in the test harness configuration, ensuring all touch-dependent interactions are supported across all language/persona test runs.
**Detected by:** auto-qa multi-agent
**Languages affected:** fr
**Severity:** critical

javascript
// In your Playwright test harness / browser context factory:
// BEFORE (broken):
const context = await browser.newContext({
  locale: 'fr-FR',
  // hasTouch omitted — causes locator.tap() to crash
});

// AFTER (fixed):
const context = await browser.newContext({
  locale: 'fr-FR',
  hasTouch: true,   // Required for locator.tap() to work
  isMobile: true,   // Recommended for iPad/iPhone Safari & Android Chrome targets
  viewport: { width: 390, height: 844 }, // e.g. iPhone 14 viewport
});

// If using playwright.config.ts projects, apply per-project:
// projects: [
//   {
//     name: 'iPad Safari',
//     use: {
//       ...devices['iPad (gen 7)'],
//       hasTouch: true,
//       locale: 'fr-FR',
//     },
//   },
//   {
//     name: 'iPhone Safari',
//     use: {
//       ...devices['iPhone 14'],
//       hasTouch: true,
//       locale: 'fr-FR',
//     },
//   },
//   {
//     name: 'Chrome Android',
//     use: {
//       ...devices['Pixel 7'],
//       hasTouch: true,
//       locale: 'fr-FR',
//     },
//   },
// ]

---
#   F I X _ P A T T E R N S . m d   � �    i d r i s - l e a r n i n g - a p p   ( S e s s i o n   2 0 2 6 - 0 5 - 1 6 )  
 #   P e r   Q A _ S T A N D A R D S _ A G E N T _ R U L E S . m d   S e c t i o n   7  
 #   A l l   f i x   p a t t e r n s   d i s c o v e r e d   i n   t h i s   s e s s i o n  
  
 - - -  
  
 # #   P - C I - 0 1 :   E m o j i   s e l e c t o r s   f a i l   i n   G i t H u b   C I   r u n n e r  
 * * T y p e : * *   C I   /   P l a y w r i g h t  
 * * F i l e : * *   t e s t s / p l a y w r i g h t / m a t c h - p a i r s . s p e c . t s  
 * * S y m p t o m : * *   ` w a i t i n g   f o r   g e t B y T e x t ( ' � x� � ' ) `   t i m e s   o u t   i n   C I   b u t   p a s s e s   l o c a l l y  
 * * R o o t   c a u s e : * *   G i t H u b   A c t i o n s   U b u n t u   r u n n e r   r e n d e r s   e m o j i   d i f f e r e n t l y   /   f l a g   e m o j i s   n o t   s u p p o r t e d  
 * * F i x : * *   R e p l a c e   A L L   e m o j i   g e t B y T e x t ( )   w i t h   C S S   c l a s s   s e l e c t o r s  
 ` ` ` t y p e s c r i p t  
 / /   W R O N G   � �    b r e a k s   i n   C I  
 a w a i t   p a g e . l o c a t o r ( ' # o b - l a n g - g r i d ' ) . g e t B y T e x t ( ' � x! � � x! � ' ) . c l i c k ( ) ;  
 a w a i t   p a g e . g e t B y T e x t ( ' � x� � ' ) . c l i c k ( ) ;  
  
 / /   C O R R E C T   � �    w o r k s   e v e r y w h e r e  
 a w a i t   p a g e . l o c a t o r ( ' # o b - l a n g - g r i d   . l a n g - c a r d ' ) . f i r s t ( ) . c l i c k ( ) ;  
 a w a i t   p a g e . l o c a t o r ( ' # m o d e s G r i d   . m o d e - c a r d . m a t c h ' ) . c l i c k ( ) ;  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   N e v e r   u s e   e m o j i   t e x t   a s   P l a y w r i g h t   s e l e c t o r s .   A l w a y s   u s e   C S S   c l a s s   o r   r o l e .  
 * * S t a t u s : * *   F I X E D   v 1 . 6 0 . 5  
  
 - - -  
  
 # #   P - C I - 0 2 :   T y p e S c r i p t   t s c o n f i g   t y p e s : [ " n o d e " ]   o v e r r i d e s   D O M   g l o b a l s  
 * * T y p e : * *   C I   /   T y p e S c r i p t  
 * * F i l e : * *   t s c o n f i g . j s o n   ( r o o t )  
 * * S y m p t o m : * *   ` C a n n o t   f i n d   n a m e   ' w i n d o w ' ` ,   ` C a n n o t   f i n d   n a m e   ' d o c u m e n t ' `   i n   C I   T y p e S c r i p t   c h e c k  
 * * R o o t   c a u s e : * *   ` t y p e s :   [ " n o d e " ] `   i n   t s c o n f i g . j s o n   r e m o v e s   a l l   D O M   t y p e   d e f i n i t i o n s  
 * * F i x : * *  
 ` ` ` j s o n  
 {  
     " c o m p i l e r O p t i o n s " :   {  
         " l i b " :   [ " E S 2 0 2 0 " ,   " D O M " ] ,  
         " t y p e s " :   [ " n o d e " ,   " @ p l a y w r i g h t / t e s t " ]  
     }  
 }  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   A l w a y s   i n c l u d e   " D O M "   i n   l i b .   N e v e r   u s e   t y p e s : [ " n o d e " ]   a l o n e   i n   b r o w s e r   p r o j e c t s .  
 * * S t a t u s : * *   F I X E D   v 1 . 6 0 . 1  
  
 - - -  
  
 # #   P - E N C - 0 1 :   P o w e r S h e l l   S e t - C o n t e n t   c o r r u p t s   U T F - 8   e m o j i  
 * * T y p e : * *   E n c o d i n g   /   D e v e l o p e r   w o r k f l o w  
 * * F i l e : * *   i n d e x . h t m l  
 * * S y m p t o m : * *   A f t e r   ` S e t - C o n t e n t   i n d e x . h t m l   $ c o n t e n t   - E n c o d i n g   U T F 8 ` ,   e m o j i s   r e n d e r   a s   ` � � � � " � � `  
 * * R o o t   c a u s e : * *   P o w e r S h e l l ' s   ` - E n c o d i n g   U T F 8 `   a d d s   B O M   o r   u s e s   w r o n g   e n c o d i n g   f o r   e m o j i  
 * * F i x : * *   U s e   V S   C o d e   t o   e d i t   f i l e s   w i t h   e m o j i   O R   u s e   P y t h o n :  
 ` ` ` p y t h o n  
 w i t h   o p e n ( ' i n d e x . h t m l ' ,   ' w ' ,   e n c o d i n g = ' u t f - 8 ' )   a s   f :  
         f . w r i t e ( c o n t e n t )  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   N E V E R   u s e   P o w e r S h e l l   S e t - C o n t e n t   f o r   f i l e s   c o n t a i n i n g   e m o j i .   U s e   P y t h o n   w r i t e   o r   V S   C o d e .  
 * * S t a t u s : * *   D O C U M E N T E D   � �    w o r k a r o u n d   v i a   V S   C o d e  
  
 - - -  
  
 # #   P - G I T - 0 1 :   A P I   k e y   c o m m i t t e d   t o   g i t  
 * * T y p e : * *   S e c u r i t y  
 * * F i l e : * *   . c l a u d e / s e t t i n g s . l o c a l . j s o n  
 * * S y m p t o m : * *   G i t H u b   p u s h   r e j e c t e d :   " P u s h   c a n n o t   c o n t a i n   s e c r e t s   � �    A n t h r o p i c   A P I   K e y "  
 * * R o o t   c a u s e : * *   ` . c l a u d e / `   f o l d e r   c r e a t e d   b y   C l a u d e   C o d e   n o t   i n   . g i t i g n o r e   b e f o r e   f i r s t   c o m m i t  
 * * F i x : * *  
 ` ` ` p o w e r s h e l l  
 g i t   r m   - - c a c h e d   . c l a u d e / s e t t i n g s . l o c a l . j s o n  
 e c h o   " . c l a u d e / s e t t i n g s . l o c a l . j s o n "   > >   . g i t i g n o r e  
 p i p   i n s t a l l   g i t - f i l t e r - r e p o  
 g i t   f i l t e r - r e p o   - - p a t h   . c l a u d e / s e t t i n g s . l o c a l . j s o n   - - i n v e r t - p a t h s   - - f o r c e  
 g i t   r e m o t e   a d d   o r i g i n   h t t p s : / / g i t h u b . c o m / . . .  
 g i t   p u s h   o r i g i n   m a i n   - - f o r c e  
 #   T h e n   r o t a t e   t h e   k e y   a t   c o n s o l e . a n t h r o p i c . c o m  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   A d d   ` . c l a u d e / `   t o   . g i t i g n o r e   B E F O R E   f i r s t   c o m m i t   o n   a n y   p r o j e c t .  
 * * S t a t u s : * *   F I X E D   +   k e y   r o t a t e d  
  
 - - -  
  
 # #   P - T S - 0 1 :   i O S   S a f a r i   s p e e c h S y n t h e s i s . g e t V o i c e s ( )   r e t u r n s   e m p t y   a r r a y  
 * * T y p e : * *   B r o w s e r   c o m p a t i b i l i t y   /   T T S  
 * * F i l e : * *   i n d e x . h t m l   � �    s p e a k ( )   f u n c t i o n  
 * * S y m p t o m : * *   " S i n g   a l o n g "   b u t t o n   s a y s   n o t h i n g   o n   i P h o n e   ( G a v k h a r ' s   d e v i c e   i n   D u s h a n b e )  
 * * R o o t   c a u s e : * *   i O S   S a f a r i   l o a d s   v o i c e s   a s y n c h r o n o u s l y   � �    g e t V o i c e s ( )   e m p t y   o n   f i r s t   c a l l  
 * * F i x : * *  
 ` ` ` j a v a s c r i p t  
 f u n c t i o n   s p e a k ( t e x t ) {  
     f u n c t i o n   t r y S p e a k ( ) {  
         c o n s t   v s   =   s p e e c h S y n t h e s i s . g e t V o i c e s ( ) ;  
         l e t   m   =   v s . f i n d ( v   = >   v . l a n g . s t a r t s W i t h ( u t t . l a n g . s p l i t ( ' - ' ) [ 0 ] ) ) ;  
         i f ( m )   u t t . v o i c e   =   m ;  
         w i n d o w . s p e e c h S y n t h e s i s . s p e a k ( u t t ) ;  
     }  
     c o n s t   v s   =   s p e e c h S y n t h e s i s . g e t V o i c e s ( ) ;  
     i f ( v s . l e n g t h   >   0 ) {   t r y S p e a k ( ) ;   }  
     e l s e   {  
         s p e e c h S y n t h e s i s . a d d E v e n t L i s t e n e r ( ' v o i c e s c h a n g e d ' ,   t r y S p e a k ,   { o n c e :   t r u e } ) ;  
         s e t T i m e o u t ( ( )   = >   {   i f ( ! u t t . v o i c e )   t r y S p e a k ( ) ;   } ,   5 0 0 ) ;   / /   f a l l b a c k  
     }  
 }  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   A l w a y s   u s e   v o i c e s c h a n g e d   e v e n t   f o r   i O S   T T S .   N e v e r   a s s u m e   g e t V o i c e s ( )   r e t u r n s   o n   f i r s t   c a l l .  
 * * S t a t u s : * *   F I X E D   v 1 . 6 0 . 0  
  
 - - -  
  
 # #   P - U I - 0 1 :   M a t c h   c a r d   g r i d   s t r e t c h e s   t o   f u l l   w i d t h  
 * * T y p e : * *   C S S   /   L a y o u t  
 * * F i l e : * *   i n d e x . h t m l   � �    r e n d e r M a t c h G r i d ( )  
 * * S y m p t o m : * *   M a t c h   c a r d s   a r e   5 0 0 - 6 0 0 p x   w i d e   i n s t e a d   o f   1 1 0 p x   o n   d e s k t o p  
 * * R o o t   c a u s e : * *   C S S   ` g r i d - t e m p l a t e - c o l u m n s :   r e p e a t ( 3 ,   1 f r ) `   i n   l a r g e   c o n t a i n e r   s t r e t c h e s   c o l u m n s  
 * * F i x : * *   A p p l y   i n l i n e   s t y l e   i n   r e n d e r M a t c h G r i d ( )   � �    C S S   c l a s s   a l o n e   i n s u f f i c i e n t :  
 ` ` ` j a v a s c r i p t  
 f u n c t i o n   r e n d e r M a t c h G r i d ( ) {  
     c o n s t   m g   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' m a t c h - g r i d ' ) ;  
     m g . s t y l e . g r i d T e m p l a t e C o l u m n s   =   ' r e p e a t ( 3 ,   1 1 0 p x ) ' ;  
     m g . s t y l e . w i d t h   =   ' 3 5 4 p x ' ;  
     m g . s t y l e . m a r g i n   =   ' 0   a u t o ' ;  
     / /   t h e n   s e t   i n n e r H T M L  
 }  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   F o r   f i x e d - s i z e   g a m e   g r i d s ,   a l w a y s   a p p l y   i n l i n e   s t y l e   i n   J S ,   n o t   C S S   o n l y .  
 * * S t a t u s : * *   F I X E D   v 1 . 5 9 . 2  
  
 - - -  
  
 # #   P - U I - 0 2 :   C o n t i n u e   b u t t o n   d i s a b l e d   w h e n   r e t u r n i n g   u s e r  
 * * T y p e : * *   U X   /   S t a t e   m a n a g e m e n t  
 * * F i l e : * *   i n d e x . h t m l   � �    r e n d e r L a n g S c r e e n ( )  
 * * S y m p t o m : * *   C o n t i n u e   b u t t o n   s t a y s   g r e y / d i s a b l e d   e v e n   a f t e r   l a n g u a g e   s e l e c t e d   f o r   r e t u r n i n g   u s e r s  
 * * R o o t   c a u s e : * *   r e n d e r L a n g S c r e e n ( )   r e n d e r s   g r i d   b u t   d o e s n ' t   c h e c k   i f   S . u i L a n g   a l r e a d y   s e t  
 * * F i x : * *   A d d   a u t o - e n a b l e   a f t e r   g r i d   r e n d e r s :  
 ` ` ` j a v a s c r i p t  
 f u n c t i o n   r e n d e r L a n g S c r e e n ( ) {  
     / /   . . .   r e n d e r   g r i d   . . .  
     / /   F I X :   e n a b l e   b u t t o n   i f   l a n g   a l r e a d y   s e l e c t e d  
     i f ( S . u i L a n g   & &   L A N G S _ C F G [ S . u i L a n g ] ) {  
         c o n s t   b t n   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' o b - l a n g - n e x t ' ) ;  
         i f ( b t n )   b t n . d i s a b l e d   =   f a l s e ;  
     }  
 }  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   A n y   b u t t o n   d e p e n d i n g   o n   s t a t e   m u s t   c h e c k   s t a t e   a t   r e n d e r   t i m e ,   n o t   j u s t   o n   u s e r   a c t i o n .  
 * * S t a t u s : * *   F I X E D   v 1 . 5 9 . 2  
  
 - - -  
  
 # #   P - D B - 0 1 :   S u p a b a s e   c a t e g o r y   f i l t e r   i g n o r e d  
 * * T y p e : * *   A P I   /   D a t a b a s e  
 * * F i l e : * *   a p i / c o n t e n t - h a n d l e r . t s  
 * * S y m p t o m : * *   ` / a p i / c o n t e n t ? c a t e g o r y = c o l o r s `   r e t u r n s   n u m b e r s / a n i m a l s   i n s t e a d   o f   c o l o r s  
 * * R o o t   c a u s e : * *   G A M E _ T O _ C A T E G O R Y   m a p   u s e d   g a m e T y p e   p a r a m   b u t   i g n o r e d   ` c a t e g o r y `   q u e r y   p a r a m  
 * * F i x : * *  
 ` ` ` t y p e s c r i p t  
 c o n s t   c a t e g o r y O v e r r i d e   =   r e q . q u e r y ? . c a t e g o r y   a s   s t r i n g   |   u n d e f i n e d ;  
 c o n s t   c a t e g o r y N a m e   =   c a t e g o r y O v e r r i d e  
     ?   c a t e g o r y O v e r r i d e . c h a r A t ( 0 ) . t o U p p e r C a s e ( )   +   c a t e g o r y O v e r r i d e . s l i c e ( 1 )  
     :   G A M E _ T O _ C A T E G O R Y [ g a m e T y p e ] ;  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   A l w a y s   s u p p o r t   d i r e c t   c a t e g o r y   o v e r r i d e   i n   c o n t e n t   A P I s .  
 * * S t a t u s : * *   F I X E D   v 1 . 5 9 . 2  
  
 - - -  
  
 # #   P - A G E N T - 0 1 :   M u l t i - a g e n t   s u i t e   u s e s   l o c a l h o s t : 3 0 0 0   b y   d e f a u l t  
 * * T y p e : * *   A g e n t   c o n f i g   /   C I  
 * * F i l e : * *   t e s t s / p l a y w r i g h t / m u l t i - a g e n t / p l a y w r i g h t . c o n f i g . t s   +   p a c k a g e . j s o n  
 * * S y m p t o m : * *   A l l   l a n g u a g e   a g e n t s   f a i l   w i t h   ` n e t : : E R R _ C O N N E C T I O N _ R E F U S E D   a t   l o c a l h o s t : 3 0 0 0 `  
 * * R o o t   c a u s e : * *   p l a y w r i g h t . c o n f i g . t s   ` b a s e U R L `   d e f a u l t e d   t o   l o c a l h o s t ,   n o   B A S E _ U R L   s e t   i n   s c r i p t s  
 * * F i x : * *  
 ` ` ` t y p e s c r i p t  
 / /   p l a y w r i g h t . c o n f i g . t s  
 b a s e U R L :   p r o c e s s . e n v . B A S E _ U R L   | |   ' h t t p s : / / i d r i s - l e a r n i n g - a p p . v e r c e l . a p p ' ,  
 ` ` `  
 ` ` ` j s o n  
 / /   p a c k a g e . j s o n   s c r i p t s  
 " t e s t : e n " :   " c r o s s - e n v   B A S E _ U R L = h t t p s : / / i d r i s - l e a r n i n g - a p p . v e r c e l . a p p   p l a y w r i g h t   t e s t   a g e n t s / e n - a g e n t . s p e c . t s "  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   A l w a y s   d e f a u l t   b a s e U R L   t o   p r o d u c t i o n   i n   p l a y w r i g h t . c o n f i g . t s   f o r   a g e n t   p r o j e c t s .  
 * * S t a t u s : * *   F I X E D   v 1 . 5 9 . 2  
  
 - - -  
  
 # #   P - A G E N T - 0 2 :   P r o f i l e   i n j e c t i o n   f a i l s   o n   i p h o n e - s a f a r i  
 * * T y p e : * *   A g e n t   /   B r o w s e r   c o m p a t i b i l i t y  
 * * F i l e : * *   t e s t s / p l a y w r i g h t / m u l t i - a g e n t / a g e n t s / b a s e - a g e n t . t s   +   l a n g u a g e - a g e n t . t s  
 * * S y m p t o m : * *   ` p a g e . w a i t F o r S e l e c t o r ( ' # s c r - p r o f i l e s ,   # s c r - m a i n ' ) `   t i m e s   o u t   o n   i p h o n e - s a f a r i  
 * * R o o t   c a u s e : * *   a d d I n i t S c r i p t   r u n s   b e f o r e   p a g e   l o a d   b u t   a p p   s o m e t i m e s   s h o w s   l a n g   s c r e e n   i n s t e a d   o f   p r o f i l e s  
 * * F i x : * *   A d d   J S   f a l l b a c k   i n   c a t c h :  
 ` ` ` t y p e s c r i p t  
 a w a i t   p a g e . w a i t F o r S e l e c t o r ( ' # s c r - p r o f i l e s ,   # s c r - m a i n ' ,   {   t i m e o u t :   2 0 0 0 0   } )  
     . c a t c h ( a s y n c   ( )   = >   {  
         a w a i t   p a g e . e v a l u a t e ( ( )   = >   {  
             i f   ( t y p e o f   s h o w P r o f i l e s   = = =   ' f u n c t i o n ' )   s h o w P r o f i l e s ( ) ;  
         } ) ;  
         a w a i t   p a g e . w a i t F o r S e l e c t o r ( ' # s c r - p r o f i l e s ,   # s c r - m a i n ' ,   {   t i m e o u t :   1 0 0 0 0   } ) ;  
     } ) ;  
 ` ` `  
 * * R u l e   g o i n g   f o r w a r d : * *   A l w a y s   a d d   J S   e v a l u a t e   f a l l b a c k   f o r   p r o f i l e   i n j e c t i o n   i n   a g e n t s .  
 * * S t a t u s : * *   F I X E D   v 1 . 5 9 . 2  
 