/**
 * English (EN) — full language agent test suite.
 * Run standalone: npx playwright test agents/en-agent.spec.ts
 */
import { test, expect } from '@playwright/test';
import { BaseAgent } from './base-agent';

const LANG = 'en' as const;

test.describe('[EN] English — full language suite', () => {
  test.setTimeout(120_000);

  test('[EN] all checks: language, cards, AAC, TTS, mic, reward, navigation, match, family', async ({ page }) => {
    const agent = new BaseAgent(LANG);
    const result = await agent.runAll(page);

    for (const c of result.checks) {
      console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    if (result.errors.length) console.error(`  Errors: ${result.errors.join('; ')}`);

    for (const check of result.checks) {
      expect(check.passed, `[EN] FAIL ${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result.errors, `[EN] agent errors: ${result.errors.join('; ')}`).toHaveLength(0);
  });
});
