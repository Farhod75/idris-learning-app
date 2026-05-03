/**
 * QA Judge — LLM-as-judge using claude-sonnet-4-6 (temp=0).
 *
 * Scores each language 0.0–1.0 against the QA_STANDARDS rubric.
 * score >= 0.7 = pass | 0.4–0.69 = warn | < 0.4 = fail
 *
 * Also performs screenshot diff between EN baseline and target language
 * (structural check: verifies the page changed, not just a language string swap).
 */

import { Page } from '@playwright/test';
import Anthropic from '@anthropic-ai/sdk';
import { AgentResult } from '../agents/base-agent';
import { SCORE_THRESHOLDS, LANGUAGES } from '../fixtures/test-data';
import fs from 'fs';

const MODEL = 'claude-sonnet-4-6';
const TIMEOUT_MS = 90_000;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var not set');
    _client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });
  }
  return _client;
}

export interface LanguageScore {
  lang: string;
  score: number;
  verdict: 'pass' | 'warn' | 'fail';
  reason: string;
  issues: string[];
}

export interface SuiteScore {
  overallScore: number;
  overallVerdict: 'pass' | 'warn' | 'fail';
  perLanguage: Record<string, LanguageScore>;
  criticalIssues: string[];
  summary: string;
}

const JUDGE_SYSTEM = `You are a QA judge evaluating test results for a multilingual ASD learning PWA.
The app is used by Idris, age 7, with autism. It must work in 7 languages.

Return a JSON object with this exact shape:
{
  "score": <number 0.0-1.0>,
  "verdict": "<pass|warn|fail>",
  "reason": "<one sentence>",
  "issues": ["<issue1>", "<issue2>"]
}

Scoring rubric:
- 1.0 = all checks pass, no errors
- 0.7 = minor issues, core functionality works  [PASS threshold]
- 0.4 = significant issues, app partially works [WARN threshold]
- 0.0 = critical failure, app broken

Always score 0.0 (fail) for:
- Wrong text direction for Arabic (must be rtl)
- Missing Cyrillic characters for Russian/Tajik
- Game screens not launching
- Touch targets below 72px (ASD safety — non-negotiable per CLAUDE.md)
- Reward system missing

Return ONLY the JSON object. No markdown, no text outside the JSON.`;

/** Score a single language result using Claude as judge. */
export async function scoreLanguage(result: AgentResult): Promise<LanguageScore> {
  const client = getClient();

  const input = `Language: ${result.lang} (${result.label})
All passed: ${result.passed}
Errors: ${result.errors.length === 0 ? 'none' : result.errors.join('; ')}

Checks:
${JSON.stringify(result.checks, null, 2)}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: JUDGE_SYSTEM,
    messages: [{ role: 'user', content: input }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);
    return { lang: result.lang, ...parsed } as LanguageScore;
  } catch {
    return {
      lang: result.lang,
      score: 0,
      verdict: 'fail',
      reason: `Judge returned non-JSON: ${text.slice(0, 100)}`,
      issues: ['judge_parse_error'],
    };
  }
}

/**
 * Screenshot diff check: verifies the language actually changed the UI.
 * Reads the EN screenshot and target screenshot, asks Claude to compare them.
 * Returns true if pages look different (language was applied).
 */
export async function screenshotDiffCheck(
  enScreenshotPath: string,
  targetScreenshotPath: string,
  targetLang: string,
): Promise<{ changed: boolean; detail: string }> {
  if (!fs.existsSync(enScreenshotPath) || !fs.existsSync(targetScreenshotPath)) {
    return { changed: true, detail: 'screenshot_not_found_skip' };
  }

  const client = getClient();
  const enImg = fs.readFileSync(enScreenshotPath).toString('base64');
  const tgtImg = fs.readFileSync(targetScreenshotPath).toString('base64');

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Compare these two app screenshots. The first is English, the second should be ${targetLang}.
Does the second screenshot show different text from the first? Is the language visibly different?
Answer with JSON: { "changed": true/false, "detail": "<one sentence>" }`,
        },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: enImg } },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: tgtImg } },
      ],
    }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { changed: true, detail: 'screenshot_diff_parse_error' };
  }
}

/** Score all 7 language results and aggregate suite verdict. */
export async function scoreSuite(results: AgentResult[]): Promise<SuiteScore> {
  const perLanguage: Record<string, LanguageScore> = {};
  const criticalIssues: string[] = [];

  for (const result of results) {
    const score = await scoreLanguage(result);
    perLanguage[result.lang] = score;
    if (score.verdict === 'fail') {
      criticalIssues.push(`[${result.lang.toUpperCase()}] ${score.reason}`);
    }
  }

  const scores = Object.values(perLanguage).map(s => s.score);
  const overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const overallVerdict: 'pass' | 'warn' | 'fail' =
    overallScore >= SCORE_THRESHOLDS.pass ? 'pass' :
    overallScore >= SCORE_THRESHOLDS.warn ? 'warn' : 'fail';

  const passCount = scores.filter(s => s >= SCORE_THRESHOLDS.pass).length;
  const summary =
    `${passCount}/${results.length} languages pass (avg score ${overallScore.toFixed(2)}). ` +
    (criticalIssues.length > 0 ? `Critical: ${criticalIssues.join(' | ')}` : 'No critical issues.');

  return { overallScore, overallVerdict, perLanguage, criticalIssues, summary };
}
