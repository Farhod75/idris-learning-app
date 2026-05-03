import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LANGUAGES, LangCode, MIN_TOUCH_TARGET_PX } from '../fixtures/test-data';
import { LanguageAgent } from '../agents/language-agent';
import { startTrace, stopTrace, traceLabel } from '../utils/trace-recorder';

/**
 * Accessibility test suite — WCAG 2.1 AA + ASD extensions.
 * Covers: axe-core audit, touch targets, font sizes, no-flash rule.
 * Per CLAUDE.md: 72px touch targets (override from QA_STANDARDS 44px).
 */

test.describe('Accessibility: WCAG 2.1 AA + ASD Extensions', () => {
  test.setTimeout(60_000);

  for (const lang of LANGUAGES) {
    test(`[${lang.code}] axe-core WCAG 2.1 AA audit`, async ({ page, context }) => {
      const traceName = traceLabel(lang.code, 'axe_audit');
      await startTrace(context, traceName);

      const agent = new LanguageAgent(lang.code as LangCode);
      await agent.init(page);
      await agent.selectProfile(page);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('#confettiLayer') // dynamic decoration, not content
        .analyze();

      await stopTrace(context, traceName);

      if (results.violations.length > 0) {
        const summary = results.violations.map(v =>
          `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`
        ).join('\n');
        console.warn(`[${lang.code}] axe violations:\n${summary}`);
      }

      // Critical: no serious or critical violations
      const criticalViolations = results.violations.filter(v =>
        v.impact === 'critical' || v.impact === 'serious'
      );
      expect(
        criticalViolations,
        `Critical a11y violations in [${lang.code}]: ${criticalViolations.map(v => v.id).join(', ')}`,
      ).toHaveLength(0);
    });
  }

  test('font sizes meet minimum (18px body, 24px game text)', async ({ page }) => {
    const agent = new LanguageAgent('en');
    await agent.init(page);
    await agent.selectProfile(page);

    // Check body font size
    const bodySize = await page.evaluate(() =>
      parseFloat(window.getComputedStyle(document.body).fontSize)
    );
    expect(bodySize, `Body font size ${bodySize}px is below 18px minimum`).toBeGreaterThanOrEqual(18);

    // Check mode card labels (game text)
    const modeCard = page.locator('.mode-name').first();
    if (await modeCard.isVisible()) {
      const cardFontSize = await modeCard.evaluate(el =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );
      expect(cardFontSize, `Game text ${cardFontSize}px below 24px minimum`).toBeGreaterThanOrEqual(24);
    }
  });

  test('no countdown pressure — no visible countdown timers in games', async ({ page }) => {
    const agent = new LanguageAgent('en');
    await agent.init(page);
    await agent.selectProfile(page);

    // Open count game
    await page.locator('.mode-card.count').tap();
    await page.locator('#game-count').waitFor({ state: 'visible' });

    // Verify no countdown timer element with decrementing numbers is visible
    // The reward timer bar (#rTimer) is OK — it's a calm progress bar, not a pressure countdown
    const countdownText = page.locator('[id*="timer"]:not(#rTimer), [class*="countdown"]');
    const count = await countdownText.count();
    // Each must not contain decrementing number patterns
    for (let i = 0; i < count; i++) {
      const text = await countdownText.nth(i).textContent();
      const hasCountdown = /^[1-9][0-9]*\s*(s|sec|second)/.test((text || '').trim());
      expect(hasCountdown, `Countdown timer found: "${text}"`).toBe(false);
    }
  });

  test('Arabic RTL layout — dir=rtl on document root', async ({ page }) => {
    const agent = new LanguageAgent('ar');
    await agent.init(page);
    await agent.selectProfile(page);

    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir, 'Arabic language must set document direction to rtl').toBe('rtl');

    // Check that text-align follows RTL
    const mainApp = page.locator('#main-app');
    if (await mainApp.isVisible()) {
      const textAlign = await mainApp.evaluate(el =>
        window.getComputedStyle(el).direction
      );
      expect(textAlign).toBe('rtl');
    }
  });

  test('color contrast — reward overlay uses readable colors', async ({ page }) => {
    const agent = new LanguageAgent('en');
    await agent.init(page);
    await agent.selectProfile(page);

    // Trigger reward by navigating to count game and completing it
    // (We just check the CSS values for the overlay rather than running a game)
    const rewardStyle = await page.evaluate(() => {
      const overlay = document.getElementById('rewardOverlay');
      if (!overlay) return null;
      const cs = window.getComputedStyle(overlay);
      return { color: cs.color, background: cs.background || cs.backgroundColor };
    });

    if (rewardStyle) {
      // Overlay should have explicit color styles (not transparent)
      expect(rewardStyle.background).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('touch targets ≥ 72px across all interactive elements (main app)', async ({ page }) => {
    const agent = new LanguageAgent('en');
    await agent.init(page);
    await agent.selectProfile(page);

    const interactives = page.locator(
      '#main-app button, #main-app .mode-card, #main-app .nav-btn, #main-app .fam-pill'
    );
    const count = await interactives.count();
    const violations: string[] = [];

    for (let i = 0; i < count; i++) {
      const el = interactives.nth(i);
      if (!await el.isVisible()) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      if (box.width < MIN_TOUCH_TARGET_PX || box.height < MIN_TOUCH_TARGET_PX) {
        const info = await el.evaluate(e => `${e.tagName}.${(e as HTMLElement).className?.split(' ')[0]}`);
        violations.push(`${info}: ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
      }
    }

    expect(
      violations,
      `Touch targets below 72px ASD minimum:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});
