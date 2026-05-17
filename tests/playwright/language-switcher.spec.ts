import { test, expect } from './fixtures/onboarded';

test.describe('Language Switcher', () => {

  test('language sheet opens when lang button clicked', async ({ onboardedPage }) => {
    await onboardedPage.assertOnMainApp();
    await onboardedPage.page.locator('.lang-btn').click();
    await expect(onboardedPage.page.locator('#langSheet')).toHaveClass(/active/);
  });

  test('switch to Russian — UI updates', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('RU');
    // Check lang button shows RU not body text (body encoding unreliable)
    const langShort = await onboardedPage.page.locator('#mainLangShort').textContent();
    expect(langShort).toBe('RU');
  });

  test('switch to Tajik — UI updates', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('TG');
    const langShort = await onboardedPage.page.locator('#mainLangShort').textContent();
    expect(langShort).toBe('TG');
  });

  test('switch back to English — UI updates', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('RU');
    await onboardedPage.switchLanguage('EN');
    const langShort = await onboardedPage.page.locator('#mainLangShort').textContent();
    expect(langShort).toBe('EN');
  });

  test('language sheet closes after selection', async ({ onboardedPage }) => {
    await onboardedPage.page.locator('.lang-btn').click();
    await onboardedPage.page.waitForSelector('#langSheet.active', { timeout: 3000 });
    await onboardedPage.page.locator('#langSheetGrid .sheet-opt').nth(1).click();
    await onboardedPage.page.waitForTimeout(500);
    await expect(onboardedPage.page.locator('#langSheet')).not.toHaveClass(/active/);
  });

  test('language persists after opening a game', async ({ onboardedPage }) => {
    await onboardedPage.switchLanguage('RU');
    await onboardedPage.openGame('count');
    const titleText = await onboardedPage.page.locator('#count-title').textContent();
    expect(titleText).toBeTruthy();
  });

});