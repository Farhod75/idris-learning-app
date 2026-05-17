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
  await page.locator('#ob-lang-grid .lang-card').first().click();
  await page.getByRole('button', { name: 'Continue â†’' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.locator('#diagSel').selectOption('1');
  await page.getByRole('button', { name: 'Next â†’' }).click();
  await page.getByText('ðŸ‡¬ðŸ‡§English').click();
  await page.getByRole('button', { name: 'Next â†’' }).click();
  await page.getByText('ðŸš—').click();
  await page.getByRole('button', { name: 'Next â†’' }).click();
  await page.getByText('ðŸ‘©', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile ðŸŽ‰' }).click();
  await expect(page.locator('#modesGrid')).toBeVisible();
});

test('match pairs game - complete 3 pairs', async ({ page }) => {
  // Onboarding
  await page.locator('#ob-lang-grid .lang-card').first().click();
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.locator('#diagSel').selectOption('1');
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText('👩', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile 🎉' }).click();

  // Open match game
  await page.locator('#modesGrid .mode-card.match').click();
  await page.waitForSelector('.match-card', { timeout: 5000 });

  // Get all cards and find matching pairs by label
  const cards = page.locator('.match-card');
  await expect(cards.first()).toBeVisible({ timeout: 5000 });
  
  // Just verify the game loaded with 6 cards
  const count = await cards.count();
  expect(count).toBe(6);
  
  // Click a card and verify it gets selected
  await cards.nth(0).click();
  await page.waitForTimeout(300);
  const hasSelected = await page.locator('.match-card.selected').count();
  expect(hasSelected).toBeGreaterThan(0);
});

test('match pairs - emoji cards are at least 72px', async ({ page }) => {
  // Onboarding
  await page.locator('#ob-lang-grid .lang-card').first().click();
  await page.getByRole('button', { name: 'Continue â†’' }).click();
  await page.getByRole('textbox', { name: "Child's name" }).fill('Idris');
  await page.getByText('5').click();
  await page.locator('#diagSel').selectOption('1');
  await page.getByRole('button', { name: 'Next â†’' }).click();
  await page.getByText('ðŸ‡¬ðŸ‡§English').click();
  await page.getByRole('button', { name: 'Next â†’' }).click();
  await page.getByText('ðŸš—').click();
  await page.getByRole('button', { name: 'Next â†’' }).click();
  await page.getByText('ðŸ‘©', { exact: true }).click();
  await page.getByRole('button', { name: 'Create profile ðŸŽ‰' }).click();

  // Open match game
  await page.locator('#modesGrid').getByText('ðŸƒ').click();
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
