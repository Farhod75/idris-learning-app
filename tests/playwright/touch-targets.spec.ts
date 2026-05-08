import { test, expect } from '@playwright/test';

const MIN_TOUCH_PX = 72;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Clear storage and force language screen
  await page.evaluate(() => {
    localStorage.clear();
    // @ts-ignore
    window.goStep(0);
  });
  await page.waitForSelector('#ob-lang-grid .lang-card', { timeout: 10000 });
});

test('Continue button enables after selecting a language', async ({ page }) => {
  const btn = page.locator('#ob-lang-next');
  // Button is pre-enabled because EN is default language (fix v1.59.2)
  await page.locator('#ob-lang-grid .lang-card').first().click();
  await expect(btn).toBeEnabled();
});

test('all language cards are at least 72px tall', async ({ page }) => {
  const cards = page.locator('#ob-lang-grid .lang-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    expect(box!.width).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  }
});

test('Continue button navigates to Step 1', async ({ page }) => {
  await page.locator('#ob-lang-grid .lang-card').first().click();
  await page.locator('#ob-lang-next').click();
  await expect(page.locator('#scr-step1')).toBeVisible();
});