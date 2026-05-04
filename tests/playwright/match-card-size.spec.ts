import { test, expect, Page } from "@playwright/test";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
async function openMatchGame(page: Page) {
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.click(".mode-card.match");
  await page.waitForSelector("#matchScreen.active", { timeout: 5000 });
}
test.describe("FP-039 — core", () => {
  test.beforeEach(async ({ page }) => { await openMatchGame(page); });
  test("match-grid max 360px", async ({ page }) => {
    const box = await page.locator("#matchGrid").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(360);
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
