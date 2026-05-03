/**
 * Russian (RU) — full language agent test suite.
 * Run standalone: npx playwright test agents/ru-agent.spec.ts
 */
import { test, expect } from '@playwright/test';
import { BaseAgent } from './base-agent';

const LANG = 'ru' as const;

test.describe('[RU] Russian — full language suite', () => {
  test.setTimeout(120_000);

  test('[RU] all checks: Cyrillic script, language, cards, AAC, TTS, mic, reward, navigation, match, family', async ({ page }) => {
    const agent = new BaseAgent(LANG);
    const result = await agent.runAll(page);

    for (const c of result.checks) {
      console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    if (result.errors.length) console.error(`  Errors: ${result.errors.join('; ')}`);

    for (const check of result.checks) {
      expect(check.passed, `[RU] FAIL ${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result.errors, `[RU] agent errors: ${result.errors.join('; ')}`).toHaveLength(0);
  });
});
