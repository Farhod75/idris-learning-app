import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    localStorage.clear();
    // @ts-ignore
    window.goStep(0);
    // @ts-ignore
    window.pickUILang('en');
  });
  await page.waitForSelector('#ob-lang-grid', { timeout: 5000 });
  await page.locator('#ob-lang-grid .lang-card').first().click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('👩', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile 🎉' }).click();
  await page.waitForSelector('#modesGrid', { timeout: 10000 });
});

test('language sheet opens when lang button clicked', async ({ page }) => {
  await page.locator('.lang-btn').click();
  await expect(page.locator('#langSheet')).toHaveClass(/active/);
});

test('switch to Russian - UI updates to RU', async ({ page }) => {
  await page.locator('.lang-btn').click();
  await page.waitForSelector('#langSheet.active', { timeout: 3000 });
  await page.locator('#langSheetGrid .sheet-opt').filter({ hasText: 'Русский' }).click();
  await page.waitForTimeout(500);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toContain('Русский');
});

test('switch to Tajik - UI updates to TG', async ({ page }) => {
  await page.locator('.lang-btn').click();
  await page.waitForSelector('#langSheet.active', { timeout: 3000 });
  await page.locator('#langSheetGrid .sheet-opt').filter({ hasText: 'Тоҷикӣ' }).click();
  await page.waitForTimeout(500);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toContain('Тоҷикӣ');
});

test('switch back to English - UI updates to EN', async ({ page }) => {
  await page.locator('.lang-btn').click();
  await page.waitForSelector('#langSheet.active', { timeout: 3000 });
  await page.locator('#langSheetGrid .sheet-opt').filter({ hasText: 'Русский' }).click();
  await page.waitForTimeout(300);
  await page.locator('.lang-btn').click();
  await page.waitForSelector('#langSheet.active', { timeout: 3000 });
  await page.locator('#langSheetGrid .sheet-opt').filter({ hasText: 'English' }).click();
  await page.waitForTimeout(500);
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toContain('English');
});

test('language sheet closes after selection', async ({ page }) => {
  await page.locator('.lang-btn').click();
  await page.waitForSelector('#langSheet.active', { timeout: 3000 });
  await page.locator('#langSheetGrid .sheet-opt').filter({ hasText: 'Русский' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('#langSheet')).not.toHaveClass(/active/);
});