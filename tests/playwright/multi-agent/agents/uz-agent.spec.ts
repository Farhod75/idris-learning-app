/**
 * Uzbek (UZ) — full language agent test suite.
 * Run standalone: npx playwright test agents/uz-agent.spec.ts
 */
import { test, expect } from '@playwright/test';
import { BaseAgent } from './base-agent';

const LANG = 'uz' as const;

test.describe('[UZ] Uzbek — full language suite', () => {
  test.setTimeout(120_000);

  test("[UZ] all checks: O'zbek language, cards, AAC, TTS, mic, reward, navigation, match, family", async ({ page }) => {
    const agent = new BaseAgent(LANG);
    const result = await agent.runAll(page);

    for (const c of result.checks) {
      console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    }
    if (result.errors.length) console.error(`  Errors: ${result.errors.join('; ')}`);

    for (const check of result.checks) {
      expect(check.passed, `[UZ] FAIL ${check.name}: ${check.detail ?? ''}`).toBe(true);
    }
    expect(result.errors, `[UZ] agent errors: ${result.errors.join('; ')}`).toHaveLength(0);
  });
});
