import { test, expect } from '@playwright/test';
import { LANGUAGES, LangCode, SCORE_THRESHOLDS } from '../fixtures/test-data';
import { LanguageAgent } from '../agents/language-agent';
import { QAJudgeAgent } from '../agents/qa-judge-agent';
import { startTrace, stopTrace, traceLabel } from '../utils/trace-recorder';

/**
 * Language Suite — runs each of the 7 language agents and evaluates results
 * through the QA Judge (LLM-as-judge pattern, QA_STANDARDS.md).
 *
 * Each language test is independent so failures don't block others.
 */

const judge = new QAJudgeAgent();

for (const lang of LANGUAGES) {
  test.describe(`Language Agent: ${lang.code.toUpperCase()} — ${lang.label}`, () => {
    test.setTimeout(90_000); // AI judge calls need extra time (QA_STANDARDS)

    test(`[${lang.code}] onboarding bypass + profile load`, async ({ page, context }) => {
      const traceName = traceLabel(lang.code, 'onboarding');
      await startTrace(context, traceName);

      const agent = new LanguageAgent(lang.code as LangCode);
      await agent.init(page);

      // Profiles screen must be visible (app found localStorage data)
      const profilesScreen = page.locator('#scr-profiles');
      await expect(profilesScreen).toBeVisible({ timeout: 8000 });

      await stopTrace(context, traceName);
    });

    test(`[${lang.code}] main app renders with correct language`, async ({ page, context }) => {
      const traceName = traceLabel(lang.code, 'main_app');
      await startTrace(context, traceName);

      const agent = new LanguageAgent(lang.code as LangCode);
      await agent.init(page);
      await agent.selectProfile(page);

      const mainApp = page.locator('#main-app');
      await expect(mainApp).toBeVisible({ timeout: 8000 });

      // Verify document direction for RTL languages
      if (lang.dir === 'rtl') {
        const dir = await page.evaluate(() => document.documentElement.dir);
        expect(dir).toBe('rtl');
      }

      await stopTrace(context, traceName);
    });

    test(`[${lang.code}] touch targets ≥ 72px`, async ({ page, context }) => {
      const traceName = traceLabel(lang.code, 'touch_targets');
      await startTrace(context, traceName);

      const agent = new LanguageAgent(lang.code as LangCode);
      await agent.init(page);
      await agent.selectProfile(page);

      // Check all interactive elements on the main app screen
      const interactives = page.locator('#main-app button, #main-app .mode-card, #main-app .nav-btn');
      const count = await interactives.count();
      const violations: string[] = [];

      for (let i = 0; i < count; i++) {
        const el = interactives.nth(i);
        if (!await el.isVisible()) continue;
        const box = await el.boundingBox();
        if (!box) continue;
        if (box.width < 72 || box.height < 72) {
          const info = await el.evaluate(e => e.tagName + ' ' + (e as HTMLElement).className?.slice(0, 40));
          violations.push(`${info}: ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
        }
      }

      await stopTrace(context, traceName);

      expect(violations, `Touch target violations in [${lang.code}]: ${violations.join(', ')}`).toHaveLength(0);
    });

    test(`[${lang.code}] count game launches`, async ({ page, context }) => {
      const traceName = traceLabel(lang.code, 'count_game');
      await startTrace(context, traceName);

      const agent = new LanguageAgent(lang.code as LangCode);
      await agent.init(page);
      await agent.selectProfile(page);

      const countCard = page.locator('.mode-card.count');
      await expect(countCard).toBeVisible({ timeout: 5000 });
      await countCard.tap();

      const gameScreen = page.locator('#game-count');
      await expect(gameScreen).toBeVisible({ timeout: 5000 });

      await stopTrace(context, traceName);
    });

    test(`[${lang.code}] QA judge evaluation`, async ({ page }) => {
      test.setTimeout(120_000); // Extra time for full agent run + AI judge

      const agent = new LanguageAgent(lang.code as LangCode);
      const result = await agent.runChecks(page);

      // Run judge
      const judgement = await judge.judgeLanguageResult(result);

      console.log(`[${lang.code}] Judge: score=${judgement.score} verdict=${judgement.verdict} reason=${judgement.reason}`);

      // Annotate test with judge output
      test.info().annotations.push({
        type: 'judge',
        description: JSON.stringify({ score: judgement.score, verdict: judgement.verdict, reason: judgement.reason }),
      });

      expect(
        judgement.score,
        `QA Judge scored [${lang.code}] at ${judgement.score} (${judgement.verdict}): ${judgement.reason}`,
      ).toBeGreaterThanOrEqual(SCORE_THRESHOLDS.warn);
    });
  });
}
