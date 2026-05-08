import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    localStorage.clear();
    // @ts-ignore
    window.goStep(0);
  });
  await page.waitForSelector('#ob-lang-grid .lang-card', { timeout: 10000 });
});

test('complete onboarding and reach main app', async ({ page }) => {
  await page.locator('#ob-lang-grid').getByText('🇬🇧').click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.locator('#diagSel').selectOption('1');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('🇬🇧English').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('🚗').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('👩', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile 🎉' }).click();
  await expect(page.locator('#modesGrid')).toBeVisible();
});

test('match pairs game - complete 3 pairs', async ({ page }) => {
  // Onboarding
  await page.locator('#ob-lang-grid').getByText('🇬🇧').click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.locator('#diagSel').selectOption('1');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('🇬🇧English').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('🚗').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('👩', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile 🎉' }).click();

  // Open match game
  await page.locator('#modesGrid').getByText('🃏').click();
  await expect(page.locator('#match-grid, .match-grid')).toBeVisible({ timeout: 5000 });

  // Match 3 pairs
  await page.getByText('🐶').click();
  await page.getByText('dog').click();
  await page.getByText('🐱').click();
  await page.getByText('cat', { exact: true }).click();
  await page.getByText('🐟').click();
  await page.getByText('fish').click();

  // Reward screen should appear
  await expect(page.getByRole('button', { name: 'Keep going! 🚀' })).toBeVisible({ timeout: 5000 });
});

test('match pairs - emoji cards are at least 72px', async ({ page }) => {
  // Onboarding
  await page.locator('#ob-lang-grid').getByText('🇬🇧').click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.locator('#diagSel').selectOption('1');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('🇬🇧English').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('🚗').click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('👩', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile 🎉' }).click();

  // Open match game
  await page.locator('#modesGrid').getByText('🃏').click();
  await page.waitForSelector('.match-card', { timeout: 5000 });

  // Check touch target size
  const cards = page.locator('.match-card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(72);
    expect(box!.width).toBeGreaterThanOrEqual(72);
  }
});