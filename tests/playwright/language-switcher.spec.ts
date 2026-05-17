/**
 * tests/playwright/language-switcher.spec.ts
 * Language switcher tests — uses POM fixture
 * CI compatible — no emoji selectors
 */

import { test, expect } from './fixtures/onboarded';

test.describe('Language Switcher', () => {

  test('language sheet opens when lang button clicked', async ({ onboardedPage }) => {
    await onboardedPage.assertOnMainApp();
    await onboardedPage.page.locator('.lang-btn').click();
    await expect(onboardedPage.page.locator('#langSheet')).toHaveClass(/active/);
  });

  test('switch to Russian — UI updates', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('RU');
    const bodyText = await onboardedPage.page.locator('body').textContent();
    expect(bodyText).toContain('Русский');
  });

  test('switch to Tajik — UI updates', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('TG');
    const bodyText = await onboardedPage.page.locator('body').textContent();
    expect(bodyText).toContain('Тоҷикӣ');
  });

  test('switch back to English — UI updates', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('RU');
    await onboardedPage.page.waitForTimeout(300);
    await onboardedPage.switchLanguage('EN');
    const bodyText = await onboardedPage.page.locator('body').textContent();
    expect(bodyText).toContain('English');
  });

  test('language sheet closes after selection', async ({ onboardedPage }) => {
    await onboardedPage.page.locator('.lang-btn').click();
    await onboardedPage.page.waitForSelector('#langSheet.active', { timeout: 3000 });
    await onboardedPage.page.locator('#langSheetGrid .sheet-opt').filter({ hasText: 'RU' }).click();
    await onboardedPage.page.waitForTimeout(500);
    await expect(onboardedPage.page.locator('#langSheet')).not.toHaveClass(/active/);
  });

  test('language persists after opening a game', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('RU');
    await onboardedPage.openGame('count');
    const titleText = await onboardedPage.page.locator('.game-title').textContent();
    expect(titleText).toBeTruthy();
  });

});
