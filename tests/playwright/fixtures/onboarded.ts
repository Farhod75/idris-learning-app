/**
 * tests/playwright/fixtures/onboarded.ts
 * 
 * Page Object Model fixture for idris-learning-app.
 * Provides onboardedPage — already past onboarding, on main app screen.
 * 
 * Usage:
 *   import { test, expect } from '../fixtures/onboarded';
 *   test('my test', async ({ onboardedPage }) => {
 *     // already on main app — no onboarding code needed
 *     await onboardedPage.openGame('count');
 *   });
 * 
 * Per QA_STANDARDS.md:
 * - Touch targets: 72px minimum (ASD override)
 * - No countdown timers
 * - All selectors: CSS class, not emoji text
 * 
 * Author: Farhod Elbekov | ISTQB CT-AI #26-CT-AI-00063-USA
 */

import { test as base, expect, Page } from '@playwright/test';

// ── Profile injected into localStorage ────────────────────────────────────
const TEST_PROFILE = {
  id: Date.now(),
  name: 'Idris',
  age: 5,
  uiLang: 'en',
  lang: 'en',
  homeLangs: ['en', 'ru', 'tg'],
  interests: [0, 1, 10], // cars, dinos, trains
  family: [0, 1, 2],     // mama, papa, grandpa
  doctor: 'Ms. Brower Kaitlin',
  avatar: '🦕',
  stars: 0,
  createdAt: new Date().toISOString(),
};

// ── Page Object Model ──────────────────────────────────────────────────────
export class IdrisAppPage {
  constructor(public readonly page: Page) {}

  // ── Navigation ──────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async resetToOnboarding() {
    await this.page.evaluate(() => localStorage.clear());
    await this.page.evaluate(() => {
      // @ts-ignore
      if (typeof window.goStep === 'function') window.goStep(0);
    });
    await this.page.waitForSelector('#ob-lang-grid .lang-card', { timeout: 10000 });
  }

  async injectProfileAndLoad() {
    await this.page.addInitScript((profile: typeof TEST_PROFILE) => {
      localStorage.setItem('app-profiles', JSON.stringify([profile]));
    }, TEST_PROFILE);
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');

    // Handle profile select screen or main app
    const onMain = await this.page.locator('#scr-main').isVisible().catch(() => false);
    if (!onMain) {
      // Click the profile card
      const profileItem = this.page.locator('.profile-item').first();
      const hasProfile = await profileItem.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasProfile) {
        await profileItem.click();
        await this.page.waitForSelector('#scr-main', { timeout: 8000 });
      } else {
        // Fallback: force load via JS
        await this.page.evaluate((p) => {
          // @ts-ignore
          if (typeof loadProfile === 'function') loadProfile(p);
        }, TEST_PROFILE);
        await this.page.waitForSelector('#modesGrid', { timeout: 8000 });
      }
    }
  }

  async completeOnboarding(lang: 'en' | 'ru' | 'tg' | 'uz' = 'en') {
    await this.page.waitForSelector('#ob-lang-grid .lang-card', { timeout: 10000 });
    // Select language
    if (lang === 'en') {
      await this.page.locator('#ob-lang-grid .lang-card').first().click();
    } else {
      await this.page.locator(`#ob-lang-grid .lang-card:has-text("${lang.toUpperCase()}")`).click();
    }
    await this.page.getByRole('button', { name: /Continue/i }).click();
    // Step 1: name + age
    await this.page.getByRole('textbox', { name: /name/i }).fill('Idris');
    await this.page.locator('.age-btn').filter({ hasText: '5' }).click();
    await this.page.getByRole('button', { name: /Next/i }).click();
    // Step 2: languages — just next
    await this.page.getByRole('button', { name: /Next/i }).click();
    // Step 3: interests — just next
    await this.page.getByRole('button', { name: /Next/i }).click();
    // Step 4: family — select mama, create
    await this.page.locator('.fam-card').first().click();
    await this.page.getByRole('button', { name: /Create profile/i }).click();
    await this.page.waitForSelector('#modesGrid', { timeout: 10000 });
  }

  // ── Main app ────────────────────────────────────────────────────────────

  async openGame(type: 'count' | 'speak' | 'match' | 'family' | 'aac') {
    const selector = `#modesGrid .mode-card.${type}`;
    await this.page.locator(selector).click();
    // Wait for game screen
    const gameId = `#game-${type}`;
    await this.page.waitForSelector(`${gameId}.active`, { timeout: 5000 });
  }

  async closeGame(type: 'count' | 'speak' | 'match' | 'family' | 'aac') {
    await this.page.locator(`#game-${type} .gbk-btn`).click();
  }

  async getStarCount(): Promise<number> {
    const text = await this.page.locator('#starsCount').textContent();
    return parseInt(text || '0');
  }

  async selectFamilyMember(index: number = 0) {
    await this.page.locator('.fam-pill').nth(index).click();
  }

  // ── Language ────────────────────────────────────────────────────────────

  async switchLanguage(lang: 'EN' | 'RU' | 'TG' | 'UZ' | 'AR' | 'ES' | 'FR') {
    await this.page.locator('.lang-btn').click();
    await this.page.waitForSelector('#langSheet.active', { timeout: 3000 });
    await this.page.locator('#langSheetGrid .sheet-opt').filter({ hasText: lang }).click();
    await this.page.waitForTimeout(300);
  }

  // ── Counting game ───────────────────────────────────────────────────────

  async answerCountQuestion(correct: boolean = true) {
    if (correct) {
      // Find the correct answer by checking how many emojis are shown
      const objsText = await this.page.locator('#count-objs').textContent() || '';
      // For emoji arrays, count spaces+1; for "emoji x N" format, parse N
      let answer: number;
      const xMatch = objsText.match(/x\s*(\d+)/);
      if (xMatch) {
        answer = parseInt(xMatch[1]);
      } else {
        answer = objsText.trim().split(' ').filter(Boolean).length;
      }
      await this.page.locator('.count-opt').filter({ hasText: String(answer) }).click();
    } else {
      // Click first wrong option
      const opts = this.page.locator('.count-opt');
      await opts.first().click();
    }
  }

  async completeCountGame() {
    for (let i = 0; i < 5; i++) {
      await this.answerCountQuestion(true);
      await this.page.waitForTimeout(1200);
      const done = await this.page.locator('#rewardOverlay.active').isVisible().catch(() => false);
      if (done) break;
    }
  }

  // ── Match game ──────────────────────────────────────────────────────────

  async waitForMatchCards() {
    await this.page.waitForSelector('.match-card', { timeout: 8000 });
  }

  async clickMatchCard(index: number) {
    await this.page.locator('.match-card').nth(index).click();
    await this.page.waitForTimeout(200);
  }

  async getMatchCardCount(): Promise<number> {
    return await this.page.locator('.match-card').count();
  }

  async getMatchedCount(): Promise<number> {
    return await this.page.locator('.match-card.matched').count();
  }

  // ── Reward overlay ──────────────────────────────────────────────────────

  async waitForReward() {
    await this.page.waitForSelector('#rewardOverlay.active', { timeout: 8000 });
  }

  async closeReward() {
    await this.page.locator('#rContinueBtn').click();
    await this.page.waitForSelector('#rewardOverlay:not(.active)', { timeout: 3000 });
  }

  async tapActivityDot(index: number = 0) {
    await this.page.locator('.act-dot').nth(index).click();
  }

  async openVideoPopup() {
    // Click Watch reward button
    await this.page.locator('button:has-text("Watch reward")').click();
    await this.page.waitForTimeout(300);
  }

  async closeVideoPopup() {
    const closeBtn = this.page.locator('#vidPopup button').filter({ hasText: '✕' });
    await closeBtn.click();
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  async assertOnMainApp() {
    await expect(this.page.locator('#scr-main')).toBeVisible({ timeout: 5000 });
    await expect(this.page.locator('#modesGrid')).toBeVisible();
  }

  async assertTouchTarget(locator: string, minPx: number = 72) {
    const elements = this.page.locator(locator);
    const count = await elements.count();
    for (let i = 0; i < count; i++) {
      const box = await elements.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height, `${locator}[${i}] height ${box.height}px < ${minPx}px`).toBeGreaterThanOrEqual(minPx);
      expect(box.width, `${locator}[${i}] width ${box.width}px < ${minPx}px`).toBeGreaterThanOrEqual(minPx);
    }
  }
}

// ── Custom fixture ─────────────────────────────────────────────────────────
type IdrisFixtures = {
  onboardedPage: IdrisAppPage;
  freshPage: IdrisAppPage;
};

export const test = base.extend<IdrisFixtures>({
  // onboardedPage: already past onboarding via localStorage injection (fast)
  onboardedPage: async ({ page }, use) => {
    const app = new IdrisAppPage(page);
    await app.injectProfileAndLoad();
    await use(app);
  },

  // freshPage: starts from language screen (for onboarding tests)
  freshPage: async ({ page }, use) => {
    const app = new IdrisAppPage(page);
    await app.goto();
    await app.resetToOnboarding();
    await use(app);
  },
});

export { expect };
