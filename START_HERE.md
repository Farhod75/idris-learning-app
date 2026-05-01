# 🚀 START HERE — Idris App: Step-by-Step Build Guide
# Author: Farhod Elbekov
# Project: Multilingual AI Learning App for Idriszhon (ASD, age 7)
# Updated: 2026-05-01

---

## PHASE 0 — Before you write a single line of code (Do this first!)

### Step 0.1 — Give mom the questionnaire
```
File: idris-mom-questionnaire-RU.md
Action: Print or share via WhatsApp/Telegram
Wait for: Completed answers from mom
Time: 1–3 days
```

### Step 0.2 — Set up your Claude Project
```
1. Go to claude.ai → Projects → New Project
2. Name it: "Idris Learning App"
3. Upload these files to Project Knowledge:
   ✅ CLAUDE.md             (developer instructions)
   ✅ idris-profile.md      (child personalization — update after mom fills questionnaire)
   ✅ QA_STANDARDS.md       (from your engineering-standards repo)
   ✅ FIX_PATTERNS.md       (this repo — prevents repeating bugs)
4. Every new conversation in this Project auto-loads all 4 files
```

### Step 0.3 — Create GitHub repo
```bash
gh repo create idris-learning-app --public
cd idris-learning-app
git init
# Copy all files from Claude outputs into this folder
git add .
git commit -m "feat: initial project scaffold"
git push origin main
```

### Step 0.4 — Update idris-profile.md with mom's answers
```
Open idris-profile.md
Fill in ALL blank sections from mom's questionnaire:
  - favorite_colors
  - cartoons (exact YouTube channels)
  - animals
  - songs
  - session timing
  - sensory notes
Re-upload to Claude Project (replace old version)
```

---

## PHASE 1 — Core App (Week 1)

### Step 1.1 — Folder structure
```
idris-learning-app/
├── index.html          ← main PWA file (already built)
├── manifest.json       ← create this (Step 1.2)
├── sw.js               ← create this (Step 1.3)
├── idris-profile.md    ← personalization data
├── CLAUDE.md           ← Claude Project instructions
├── FIX_PATTERNS.md     ← bug prevention
├── QA_STANDARDS.md     ← your engineering standards
└── tests/
    └── playwright/
        └── test_touch_targets.spec.ts
```

### Step 1.2 — Create manifest.json (PWA install on iPad)
```json
{
  "name": "Idris Учится",
  "short_name": "Idris",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF8F0",
  "theme_color": "#FF6B35",
  "orientation": "portrait",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Step 1.3 — Create sw.js (offline support)
```javascript
const CACHE = 'idris-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);
self.addEventListener('fetch', e =>
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
);
```

### Step 1.4 — Register Service Worker in index.html
```html
<!-- Add before </body> in index.html -->
<link rel="manifest" href="/manifest.json">
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

### Step 1.5 — Test on actual iPad
```
1. Host locally:  npx serve . -l 3000
2. Find your IP:  ipconfig (Windows) or ifconfig (Mac)
3. On iPad Safari: go to http://YOUR_IP:3000
4. Share → Add to Home Screen
5. Test all touch targets with finger (not mouse!)
```

---

## PHASE 2 — Voice Module (Week 2)

### Step 2.1 — Get Picovoice API key (FREE tier available)
```
1. Go to: console.picovoice.ai
2. Sign up (free)
3. Copy your AccessKey
4. Add to .env:  PICOVOICE_KEY=your_key_here
5. NEVER commit .env to git — add to .gitignore
```

### Step 2.2 — Install Eagle SDK
```bash
npm install @picovoice/eagle-web
# OR via CDN in index.html:
# <script src="https://unpkg.com/@picovoice/eagle-web/dist/eagle.js"></script>
```

### Step 2.3 — Replace simulated speaker ID with real Eagle SDK
```javascript
// In idris-voice-module.html, replace simulateSpeakerDetection() with:
import { Eagle, EagleProfiler } from '@picovoice/eagle-web';

const eagle = await Eagle.create(PICOVOICE_KEY, enrolledProfiles);

async function realSpeakerDetection(audioFrame) {
  const scores = await eagle.process(audioFrame);
  const maxScore = Math.max(...scores);
  if (maxScore < 0.5) return null;  // unknown speaker
  return FAMILY[scores.indexOf(maxScore)];
}
```

### Step 2.4 — Test voice enrollment
```
Checklist:
□ Idris enrolled (3 phrases in English)
□ Mama enrolled (3 phrases in Uzbek)
□ Papa enrolled (3 phrases in Uzbek)
□ Babushka enrolled (3 phrases in Russian)
□ Deda enrolled (3 phrases in Tajik)
□ Speaker correctly identified in 3 back-to-back tests
□ Unknown speaker returns null (no crash)
```

### Step 2.5 — Connect to Claude API
```
1. Get API key: console.anthropic.com
2. Add to .env: ANTHROPIC_KEY=your_key
3. For client-side (iPad PWA): use a thin proxy server
   OR use Claude API directly (acceptable for family-only app)
```

---

## PHASE 3 — Personalization from Profile (Week 3)

### Step 3.1 — Load idris-profile.md into Claude system prompt
```javascript
// Fetch profile at app start
const profile = await fetch('/idris-profile.md').then(r => r.text());

// Inject into every Claude API call
const systemPrompt = `
You are Idris's learning assistant.
CHILD PROFILE:
${profile}
...
`;
```

### Step 3.2 — Add profile-driven game content
```javascript
// Instead of hardcoded emojis, generate from profile
// Example: counting game uses Idris's favorite things
const countingEmojis = {
  trains:     ['🚂','🚃','🚄','🚅','🚆'],  // from profile: likes trains
  dinosaurs:  ['🦕','🦖','🐊'],             // from profile: likes dinosaurs
  animals:    [],                             // fill from mom's questionnaire
};
```

### Step 3.3 — Add family language routing
```javascript
// From profile: each family member has a language
const familyLangs = {
  idris:    'en-US',   // dominant: English (cartoons)
  mama:     'uz-UZ',
  papa:     'uz-UZ',
  deda:     'tg-TG',
  babushka: 'ru-RU',
  sestra:   'ru-RU',
  brat:     'ru-RU',
};
```

---

## PHASE 4 — Testing (Week 4)

### Step 4.1 — Run Playwright accessibility tests
```typescript
// tests/playwright/test_touch_targets.spec.ts
import { test, expect } from '@playwright/test';

test('all buttons have min 72px touch targets', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const buttons = page.locator('button, [role="button"]');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const box = await buttons.nth(i).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(72);
    expect(box?.width).toBeGreaterThanOrEqual(72);
  }
});

test('no flashing animations (WCAG 2.3.1)', async ({ page }) => {
  // Check CSS animations don't flash > 3 times/second
  // Use axe-playwright for full WCAG check
  await page.goto('http://localhost:3000');
  const { checkA11y } = await import('axe-playwright');
  await checkA11y(page, null, { runOnly: ['wcag2a', 'wcag2aa'] });
});
```

### Step 4.2 — iPad simulation in Playwright
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'iPad',
      use: { ...devices['iPad (gen 7)'], hasTouch: true },
    },
  ],
});
```

### Step 4.3 — AI content eval tests
```python
# tests/pytest/test_ai_content.py
import pytest

def test_claude_response_mentions_idris():
    """Claude should always address Idris, not just the family member"""
    response = call_claude_api("Mama said: 'Bu nima?'", speaker="mama")
    assert "Idris" in response or "идрис" in response.lower()

def test_response_under_2_sentences():
    """Per CLAUDE.md: max 2 sentences"""
    response = call_claude_api("Idris said: 'train'", speaker="idris")
    sentences = response.split('.')
    assert len([s for s in sentences if s.strip()]) <= 2

def test_no_pressure_language():
    """No timers or pressure words"""
    response = call_claude_api("Idris said: 'I don't know'", speaker="idris")
    forbidden = ['hurry', 'quick', 'faster', 'timer', 'seconds left']
    assert not any(w in response.lower() for w in forbidden)
```

---

## PHASE 5 — Deploy (Week 5)

### Step 5.1 — GitHub Pages (free, instant)
```bash
# In repo Settings → Pages → Source: main branch / root
# Your app is live at: https://farhod75.github.io/idris-learning-app

# Or use GitHub Actions:
# .github/workflows/deploy.yml
name: Deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/deploy-pages@v4
```

### Step 5.2 — Install on family iPads
```
For each family member's iPad:
1. Open Safari → go to your GitHub Pages URL
2. Tap Share → Add to Home Screen
3. Name it "Idрис" (or family's language)
4. Done — icon appears on home screen
```

### Step 5.3 — Enroll all voices on Idris's iPad
```
Open app → Enroll tab → enroll each person in 5 min
```

---

## QUICK REFERENCE — What to ask Claude in this Project

| Goal | Ask Claude |
|------|-----------|
| New game | "Add [animal sounds] game using idris-profile.md. Follow FIX_PATTERNS.md." |
| More challenges | "Generate 10 family challenges in Uzbek for Papa. JSON format." |
| Fix a bug | "Bug: [describe]. Check FIX_PATTERNS.md first." |
| Add a language | "Add Kazakh (kk-KZ) following existing language pattern in index.html." |
| Update after mom's answers | "Update idris-profile.md: favorite colors are [X], cartoons are [Y]." |

---

## TOTAL TIME ESTIMATE

| Phase | Time | Blocker |
|-------|------|---------|
| 0 - Setup | 2–3 days | Waiting for mom's questionnaire |
| 1 - Core app | 3–4 days | None — already prototyped |
| 2 - Voice | 4–5 days | Picovoice key + enrollment session |
| 3 - Profile | 2–3 days | Needs completed idris-profile.md |
| 4 - Tests | 3–4 days | None |
| 5 - Deploy | 1 day | None |
| **TOTAL** | **~3 weeks** | Mom's answers are the critical path |
