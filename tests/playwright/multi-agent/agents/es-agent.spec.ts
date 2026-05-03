/**
 * Spanish (ES) — full language agent test suite.
 * Run standalone: npx playwright test agents/es-agent.spec.ts
 */
import { test, expect } from '@playwright/test';
import { BaseAgent } from './base-agent';

const LANG = 'es' as const;

test.describe('[ES] Spanish — full language suite', () => {
  test.setTimeout(120_000);

  test('[ES] all checks: Spanish language, cards, AAC, TTS, mic, reward, navigation, match, family', async ({ page }) => {
    const agent = new BaseAgent(LANG);
    const result = await agent.runAll(page);

    for (const c of result.checks) {
      console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    if (result.errors.length) console.error(`  Errors: ${result.errors.join('; ')}`);

    for (const check of result.checks) {
      expect(check.passed, `[ES] FAIL ${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result.errors, `[ES] agent errors: ${result.errors.join('; ')}`).toHaveLength(0);
  });
});
