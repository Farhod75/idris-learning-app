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
  await page.locator('#modesGrid .mode-card.match').click();
  await expect(page.locator('#match-grid, .match-grid')).toBeVisible({ timeout: 5000 });

  // Match 3 pairs
  await page.locator('.match-card').nth(0).click();
  await page.waitForTimeout(300);
  await page.locator('.match-card').nth(3).click();
  await page.waitForTimeout(800);
  await page.locator('.match-card').nth(1).click();
  await page.waitForTimeout(300);
  await page.locator('.match-card').nth(4).click();
  await page.waitForTimeout(800);
  await page.locator('.match-card').nth(2).click();
  await page.waitForTimeout(300);
  await page.locator('.match-card').nth(5).click();
  await page.waitForTimeout(800);

  // Reward screen should appear
  await expect(page.locator('#rContinueBtn')).toBeVisible({ timeout: 5000 });
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
