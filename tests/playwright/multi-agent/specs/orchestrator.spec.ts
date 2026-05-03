import { test, expect } from '@playwright/test';
import { LANGUAGES, LangCode, SCORE_THRESHOLDS } from '../fixtures/test-data';
import { LanguageAgent, LanguageAgentResult } from '../agents/language-agent';
import { QAJudgeAgent } from '../agents/qa-judge-agent';
import { BugReportAgent } from '../agents/bug-report-agent';
import { FPLoggerAgent } from '../agents/fp-logger-agent';
import { startTrace, stopTrace } from '../utils/trace-recorder';
import path from 'path';
import fs from 'fs';

/**
 * Orchestrator — master test that:
 * 1. Runs all 7 language agents sequentially
 * 2. Feeds results to QA Judge for per-language + suite scoring
 * 3. Generates bug reports for failures
 * 4. Auto-logs new FIX_PATTERNS entries for novel issues
 * 5. Fails the suite if overall verdict is 'fail'
 *
 * Run with: npx playwright test specs/orchestrator.spec.ts
 */

test.describe('Multi-Agent QA Orchestrator', () => {
  test.setTimeout(600_000); // 10 min for full 7-language run + AI calls

  test('full multilingual suite — all agents + judge + reporter + FP-logger', async ({ browser }) => {
    const results: LanguageAgentResult[] = [];
    const judge = new QAJudgeAgent();
    const reporter = new BugReportAgent();
    const fpLogger = new FPLoggerAgent();

    // ─── Phase 1: Run all 7 language agents ─────────────────────────────────
    console.log('\n=== Phase 1: Running language agents ===');

    for (const lang of LANGUAGES) {
      console.log(`  → Agent: ${lang.code.toUpperCase()} (${lang.label})`);
      const context = await browser.newContext({
        viewport: { width: 1024, height: 1366 },
        hasTouch: true,
        isMobile: true,
        locale: lang.bcp47,
      });
      const page = await context.newPage();

      await startTrace(context, `orchestrator_${lang.code}`);

      try {
        const agent = new LanguageAgent(lang.code as LangCode);
        const result = await agent.runChecks(page);
        results.push(result);

        const checkSummary = result.checks.map(c => `${c.passed ? '✓' : '✗'} ${c.name}`).join(' | ');
        console.log(`    ${result.passed ? 'PASS' : 'FAIL'} — ${checkSummary}`);
        if (result.errors.length > 0) console.log(`    Errors: ${result.errors.join('; ')}`);
      } catch (err: any) {
        console.error(`    CRASH in agent [${lang.code}]: ${err?.message}`);
        results.push({
          lang: lang.code as LangCode,
          label: lang.label,
          passed: false,
          checks: [],
          errors: [`Agent crash: ${err?.message}`],
        });
      } finally {
        await stopTrace(context, `orchestrator_${lang.code}`).catch(() => {});
        await context.close();
      }
    }

    // ─── Phase 2: QA Judge evaluation ────────────────────────────────────────
    console.log('\n=== Phase 2: QA Judge evaluation ===');
    const suiteJudgement = await judge.judgeSuite(results);
    console.log(`  Overall: score=${suiteJudgement.overallScore.toFixed(2)} verdict=${suiteJudgement.overallVerdict}`);
    console.log(`  Summary: ${suiteJudgement.summary}`);

    // ─── Phase 3: Bug reports ─────────────────────────────────────────────────
    console.log('\n=== Phase 3: Generating bug reports ===');
    const bugs = reporter.generateReports(results, suiteJudgement.perLanguage);
    const summaryPath = reporter.writeSummary(suiteJudgement, bugs);
    console.log(`  Generated ${bugs.length} bug report(s)`);
    console.log(`  Summary: ${summaryPath}`);

    // ─── Phase 4: FP-logger ───────────────────────────────────────────────────
    if (bugs.length > 0) {
      console.log('\n=== Phase 4: FP-logger — checking for new patterns ===');
      const newPatterns = await fpLogger.processResults(results, bugs);
      if (newPatterns.length > 0) {
        console.log(`  New FIX_PATTERNS appended: ${newPatterns.join(', ')}`);
      } else {
        console.log('  No new patterns detected (all issues match known patterns)');
      }
    }

    // ─── Attach summary to test report ───────────────────────────────────────
    test.info().annotations.push({
      type: 'suite_result',
      description: suiteJudgement.summary,
    });
    test.info().annotations.push({
      type: 'overall_score',
      description: suiteJudgement.overallScore.toFixed(2),
    });

    // ─── Phase 5: Assert ─────────────────────────────────────────────────────
    // Print per-language scores before asserting
    for (const [lang, j] of Object.entries(suiteJudgement.perLanguage)) {
      console.log(`  [${lang.toUpperCase()}] ${j.verdict} (${j.score.toFixed(2)}): ${j.reason}`);
    }

    if (suiteJudgement.criticalIssues.length > 0) {
      console.error('\n  CRITICAL ISSUES:');
      suiteJudgement.criticalIssues.forEach(i => console.error(`    ${i}`));
    }

    expect(
      suiteJudgement.overallVerdict,
      `Suite verdict is ${suiteJudgement.overallVerdict}. Score: ${suiteJudgement.overallScore.toFixed(2)}. ${suiteJudgement.summary}`,
    ).not.toBe('fail');

    // Each language must at least warn (score >= 0.4)
    for (const [lang, j] of Object.entries(suiteJudgement.perLanguage)) {
      expect(
        j.score,
        `[${lang}] QA score ${j.score.toFixed(2)} is below minimum threshold. ${j.reason}`,
      ).toBeGreaterThanOrEqual(SCORE_THRESHOLDS.warn);
    }
  });
});

// ─── Smoke test — runs without AI calls (fast CI gate) ──────────────────────
test.describe('Smoke: app loads in all 7 languages', () => {
  test.setTimeout(30_000);

  for (const lang of LANGUAGES) {
    test(`[${lang.code}] app loads and shows profile screen`, async ({ page }) => {
      const agent = new LanguageAgent(lang.code as LangCode);
      await agent.init(page);

      const profilesScreen = page.locator('#scr-profiles, #scr-lang');
      await expect(profilesScreen.first()).toBeVisible({ timeout: 8000 });
    });
  }
});
