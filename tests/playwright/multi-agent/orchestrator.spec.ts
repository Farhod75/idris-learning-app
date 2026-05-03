/**
 * Orchestrator — runs all 7 language agents, scores results via Claude judge,
 * generates bug reports, updates FIX_PATTERNS.md for novel patterns.
 *
 * Run: npx playwright test orchestrator.spec.ts
 *
 * Outputs:
 *   reports/bugs/YYYY-MM-DD-BUG-*.md
 *   reports/bugs/YYYY-MM-DD-BUG-*.github.json
 *   reports/bugs/SUMMARY.md
 *   reports/results.json (via playwright reporter)
 */

import { test, expect } from '@playwright/test';
import { BaseAgent } from './agents/base-agent';
import { AgentResult } from './agents/base-agent';
import { scoreSuite, SuiteScore } from './judge/qa-judge';
import { generateReports, writeSummary } from './reporter/bug-reporter';
import { logBugPatterns } from './reporter/fp-logger';
import { LANGUAGES, LangCode, SCORE_THRESHOLDS } from './fixtures/test-data';

// All 7 language codes in execution order (EN baseline first)
const ALL_LANGS: LangCode[] = ['en', 'ru', 'uz', 'tg', 'ar', 'es', 'fr'];

test.describe('Multi-Agent QA Orchestrator — all 7 languages', () => {
  test.setTimeout(600_000); // 10 min ceiling for full suite

  test('Full QA suite: all languages pass, judge scores, reports generated', async ({ page }) => {
    const results: AgentResult[] = [];

    // --- Phase 1: Run all language agents sequentially ---
    for (const lang of ALL_LANGS) {
      const langCfg = LANGUAGES.find(l => l.code === lang)!;
      console.log(`\n[ORCHESTRATOR] Running agent: ${lang.toUpperCase()} (${langCfg.label})`);

      const agent = new BaseAgent(lang);
      const result = await agent.runAll(page);
      results.push(result);

      // Print per-check results immediately
      for (const c of result.checks) {
        console.log(`  ${c.passed ? '✓' : '✗'} [${lang.toUpperCase()}] ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
      }
      if (result.errors.length) {
        console.error(`  [${lang.toUpperCase()}] Errors: ${result.errors.join('; ')}`);
      }
    }

    // --- Phase 2: Score all results with Claude judge ---
    console.log('\n[ORCHESTRATOR] Scoring results with Claude judge...');
    let suite: SuiteScore;
    try {
      suite = await scoreSuite(results);
      console.log(`[ORCHESTRATOR] Suite verdict: ${suite.overallVerdict.toUpperCase()} (score: ${suite.overallScore.toFixed(2)})`);
      console.log(`[ORCHESTRATOR] ${suite.summary}`);
      if (suite.criticalIssues.length > 0) {
        for (const issue of suite.criticalIssues) {
          console.error(`  CRITICAL: ${issue}`);
        }
      }
    } catch (err) {
      // Judge failure is non-blocking — continue to assertions on raw checks
      console.error(`[ORCHESTRATOR] Judge error (non-blocking): ${err}`);
      suite = {
        overallScore: 0,
        overallVerdict: 'fail',
        perLanguage: {},
        criticalIssues: [`Judge unavailable: ${String(err).slice(0, 100)}`],
        summary: 'Judge unavailable — falling back to raw check results',
      };
    }

    // --- Phase 3: Generate bug reports and write SUMMARY.md ---
    console.log('\n[ORCHESTRATOR] Generating bug reports...');
    const bugs = generateReports(results, suite.perLanguage);
    const summaryPath = writeSummary(suite, bugs);
    console.log(`[ORCHESTRATOR] Summary written to: ${summaryPath}`);
    if (bugs.length > 0) {
      console.log(`[ORCHESTRATOR] ${bugs.length} bug report(s) generated:`);
      for (const b of bugs) {
        console.log(`  [${b.severity.toUpperCase()}] ${b.id}`);
      }
    }

    // --- Phase 4: FP logger — classify novel patterns ---
    if (bugs.length > 0 && process.env.ANTHROPIC_API_KEY) {
      console.log('\n[ORCHESTRATOR] Classifying novel bug patterns (FP logger)...');
      try {
        const fpResults = await logBugPatterns(bugs);
        for (const fp of fpResults) {
          if (fp.isNovel && fp.newFPNumber) {
            console.log(`  NEW PATTERN: FP-${String(fp.newFPNumber).padStart(3, '0')} logged for ${fp.bug}`);
          } else if (fp.matchedPattern) {
            console.log(`  Matched known pattern: ${fp.matchedPattern} for ${fp.bug}`);
          }
        }
      } catch (err) {
        console.warn(`[ORCHESTRATOR] FP logger error (non-blocking): ${err}`);
      }
    }

    // --- Phase 5: Assertions ---

    // 5a. Every individual check must pass across all languages
    for (const result of results) {
      for (const check of result.checks) {
        expect(
          check.passed,
          `[${result.lang.toUpperCase()}] FAIL ${check.name}: ${check.detail ?? ''}`,
        ).toBe(true);
      }
      expect(
        result.errors,
        `[${result.lang.toUpperCase()}] agent errors: ${result.errors.join('; ')}`,
      ).toHaveLength(0);
    }

    // 5b. Judge: overall verdict must not be 'fail'
    expect(
      suite.overallVerdict,
      `Suite verdict is FAIL. Score: ${suite.overallScore.toFixed(2)}. Critical: ${suite.criticalIssues.join(' | ')}`,
    ).not.toBe('fail');

    // 5c. Judge: no individual language may score below warn threshold
    for (const [lang, score] of Object.entries(suite.perLanguage)) {
      expect(
        score.score,
        `[${lang.toUpperCase()}] score ${score.score.toFixed(2)} below warn threshold. Reason: ${score.reason}`,
      ).toBeGreaterThanOrEqual(SCORE_THRESHOLDS.warn);
    }
  });
});

// --- Individual language pass/fail snapshots (non-blocking info tests) ---
// These run independently so CI can show per-language status in the test matrix.

for (const lang of ALL_LANGS) {
  test.describe(`[${lang.toUpperCase()}] Agent snapshot`, () => {
    test.setTimeout(120_000);

    test(`[${lang.toUpperCase()}] all checks pass`, async ({ page }) => {
      const agent = new BaseAgent(lang);
      const result = await agent.runAll(page);

      for (const c of result.checks) {
        console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
      }

      for (const check of result.checks) {
        expect(
          check.passed,
          `[${lang.toUpperCase()}] FAIL ${check.name}: ${check.detail ?? ''}`,
        ).toBe(true);
      }
      expect(result.errors, `[${lang.toUpperCase()}] errors: ${result.errors.join('; ')}`).toHaveLength(0);
    });
  });
}
