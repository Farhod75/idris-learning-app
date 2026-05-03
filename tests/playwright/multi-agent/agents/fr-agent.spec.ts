/**
 * French (FR) — full language agent test suite.
 * Run standalone: npx playwright test agents/fr-agent.spec.ts
 */
import { test, expect } from '@playwright/test';
import { BaseAgent } from './base-agent';

const LANG = 'fr' as const;

test.describe('[FR] French — full language suite', () => {
  test.setTimeout(120_000);

  test('[FR] all checks: French language, cards, AAC, TTS, mic, reward, navigation, match, family', async ({ page }) => {
    const agent = new BaseAgent(LANG);
    const result = await agent.runAll(page);

    for (const c of result.checks) {
      console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    if (result.errors.length) console.error(`  Errors: ${result.errors.join('; ')}`);

    for (const check of result.checks) {
      expect(check.passed, `[FR] FAIL ${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result.errors, `[FR] agent errors: ${result.errors.join('; ')}`).toHaveLength(0);
  });
});
