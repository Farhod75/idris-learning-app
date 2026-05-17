/**
 * tests/playwright/touch-targets.spec.ts
 * Touch target compliance + language screen tests
 * Uses POM fixture — no onboarding code in tests
 * 
 * ASD requirement: 72px minimum touch targets (overrides WCAG 44px)
 * Per CLAUDE.md + QA_STANDARDS.md
 */

import { test, expect } from './fixtures/onboarded';

const MIN_TOUCH_PX = 72;

test.describe('Language Screen — Touch Targets', () => {

  test('Continue button enables after selecting a language', async ({ freshPage }) => {
    const btn = freshPage.page.locator('#ob-lang-next');
    await freshPage.page.locator('#ob-lang-grid .lang-card').first().click();
    await expect(btn).toBeEnabled();
  });

  test('all language cards are at least 72px tall', async ({ freshPage }) => {
    await freshPage.assertTouchTarget('#ob-lang-grid .lang-card', MIN_TOUCH_PX);
  });

  test('Continue button navigates to Step 1', async ({ freshPage }) => {
    await freshPage.page.locator('#ob-lang-grid .lang-card').first().click();
    await freshPage.page.locator('#ob-lang-next').click();
    await expect(freshPage.page.locator('#scr-step1')).toBeVisible();
  });

});

test.describe('Main App — Touch Targets', () => {

  test('game mode cards meet 72px minimum', async ({ onboardedPage }) => {
    await onboardedPage.assertOnMainApp();
    await onboardedPage.assertTouchTarget('#modesGrid .mode-card', MIN_TOUCH_PX);
  });

  test('family pills meet 72px minimum', async ({ onboardedPage }) => {
    await onboardedPage.assertOnMainApp();
    await onboardedPage.assertTouchTarget('.fam-pill', MIN_TOUCH_PX);
  });

  test('nav buttons meet 72px minimum', async ({ onboardedPage }) => {
    await onboardedPage.assertOnMainApp();
    await onboardedPage.assertTouchTarget('.nav-btn', MIN_TOUCH_PX);
  });

});
