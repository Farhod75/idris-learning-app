/**
 * Arabic (AR) — full language agent test suite.
 * RTL layout is a hard requirement — direction=rtl must be set on <html>.
 * Run standalone: npx playwright test agents/ar-agent.spec.ts
 */
import { test, expect } from '@playwright/test';
import { BaseAgent } from './base-agent';

const LANG = 'ar' as const;

test.describe('[AR] Arabic — full language suite + RTL', () => {
  test.setTimeout(120_000);

  test('[AR] all checks: Arabic script, RTL direction, cards, AAC, TTS, mic, reward, navigation, match, family', async ({ page }) => {
    const agent = new BaseAgent(LANG);
    const result = await agent.runAll(page);

    for (const c of result.checks) {
      console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    if (result.errors.length) console.error(`  Errors: ${result.errors.join('; ')}`);

    for (const check of result.checks) {
      expect(check.passed, `[AR] FAIL ${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result.errors, `[AR] agent errors: ${result.errors.join('; ')}`).toHaveLength(0);
  });

  // Hard RTL assertion — Arabic MUST set dir=rtl, no exceptions (CLAUDE.md)
  test('[AR] document direction MUST be rtl', async ({ page }) => {
    const agent = new BaseAgent(LANG);
    await agent.init(page);
    await agent.selectProfile(page);

    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir, 'Arabic requires dir="rtl" on <html> — layout and text alignment depend on it').toBe('rtl');

    const mainAppDir = await page.locator('#main-app').evaluate(
      el => window.getComputedStyle(el).direction,
    );
    expect(mainAppDir, '#main-app computed direction must be rtl for Arabic').toBe('rtl');
  });

  // Arabic script must appear in visible text
  test('[AR] Arabic script visible in UI', async ({ page }) => {
    const agent = new BaseAgent(LANG);
    await agent.init(page);
    await agent.selectProfile(page);

    const text = (await page.locator('#main-app').textContent()) ?? '';
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    expect(hasArabic, `Expected Arabic characters (U+0600-U+06FF) in #main-app text. Got: "${text.slice(0, 80)}"`).toBe(true);
  });
});
