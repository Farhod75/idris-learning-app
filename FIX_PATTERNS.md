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