import { test, expect, Page } from '@playwright/test';
const APP_URL = 'https://idris-learning-app.vercel.app';
async function openMatchGame(page: Page) {
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  // Handle onboarding if shown
  await page.evaluate(() => {
    localStorage.clear();
    // @ts-ignore
    window.goStep(0);
  });
  await page.waitForSelector('#ob-lang-grid .lang-card', { timeout: 10000 });
  await page.locator('#ob-lang-grid').getByText('🇬🇧').click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('👩', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile 🎉' }).click();
  await page.waitForSelector('#modesGrid', { timeout: 10000 });
  await page.locator('#modesGrid').getByText('🃏').click();
  await page.waitForSelector('.match-card', { timeout: 10000 });
}
test.describe("FP-039 — core", () => {
  test.beforeEach(async ({ page }) => { await openMatchGame(page); });
  test("match-grid max 360px", async ({ page }) => {
    const box = await page.locator("#match-grid, .match-grid, #matchScreen").boundingBox();
    expect(Math.round(box!.width)).toBeLessThanOrEqual(360);
  });
  test("each card < 200px height", async ({ page }) => {
    const cards = page.locator(".match-card");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height).toBeLessThan(200);
      expect(box!.width).toBeLessThan(200);
    }
  });
  test("each card >= 72px touch target", async ({ page }) => {
    const cards = page.locator(".match-card");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(72);
    }
  });
});

test.describe("FP-039 — desktop (1280x720)", () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test("cards within bounds on desktop", async ({ page }) => {
    await openMatchGame(page);
    const cards = page.locator(".match-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, `card ${i} height`).toBeLessThan(200);
      expect(box!.height, `card ${i} touch`).toBeGreaterThanOrEqual(72);
    }
  });
});

test.describe("FP-039 — ipad (768x1024)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });
  test("cards within bounds on ipad", async ({ page }) => {
    await openMatchGame(page);
    const cards = page.locator(".match-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, `card ${i} height`).toBeLessThan(200);
      expect(box!.height, `card ${i} touch`).toBeGreaterThanOrEqual(72);
    }
  });
});

test.describe("FP-039 — mobile (390x844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("cards within bounds on mobile", async ({ page }) => {
    await openMatchGame(page);
    const cards = page.locator(".match-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, `card ${i} height`).toBeLessThan(200);
      expect(box!.height, `card ${i} touch`).toBeGreaterThanOrEqual(72);
    }
  });
});
