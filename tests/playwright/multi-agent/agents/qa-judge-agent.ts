import { judgeWithClaude, JudgeResult, CLAUDE_MODEL } from '../utils/claude-client';
import { LanguageAgentResult } from './language-agent';
import { SCORE_THRESHOLDS } from '../fixtures/test-data';

const JUDGE_SYSTEM_PROMPT = `You are a QA judge evaluating test results for an ASD learning PWA.
The app is used by Idris, age 7, with autism. It supports 7 languages.

Evaluate the provided test results and return a JSON object with this exact shape:
{
  "score": <number 0.0-1.0>,
  "verdict": "<pass|warn|fail>",
  "reason": "<one sentence summary>",
  "issues": ["<issue1>", "<issue2>"]
}

Scoring rubric:
- 1.0 = all checks pass, no errors
- 0.7 = minor issues, core functionality works (threshold for PASS)
- 0.4 = significant issues but app partially functional (threshold for WARN)
- 0.0 = critical failure, app broken for this language

Critical failures (always score 0.0):
- Wrong text direction for Arabic (must be RTL)
- Non-Latin characters missing for Russian/Tajik
- Game screens not launching
- Touch targets below 72px (ASD safety requirement — not negotiable)

Return ONLY the JSON object. No markdown, no explanation outside the JSON.`;

export interface SuiteJudgement {
  overallScore: number;
  overallVerdict: 'pass' | 'warn' | 'fail';
  perLanguage: Record<string, JudgeResult>;
  criticalIssues: string[];
  summary: string;
}

export class QAJudgeAgent {
  /**
   * Judge a single language agent result.
   */
  async judgeLanguageResult(result: LanguageAgentResult): Promise<JudgeResult> {
    const checksJson = JSON.stringify(result.checks, null, 2);
    const prompt = `Language: ${result.lang} (${result.label})
All checks passed: ${result.passed}
Errors: ${result.errors.length === 0 ? 'none' : result.errors.join('; ')}

Checks:
${checksJson}`;

    return judgeWithClaude(JUDGE_SYSTEM_PROMPT, prompt);
  }

  /**
   * Judge an entire multi-language suite run.
   * Returns aggregated verdict across all languages.
   */
  async judgeSuite(results: LanguageAgentResult[]): Promise<SuiteJudgement> {
    const perLanguage: Record<string, JudgeResult> = {};
    const criticalIssues: string[] = [];

    for (const result of results) {
      const judgement = await this.judgeLanguageResult(result);
      perLanguage[result.lang] = judgement;
      if (judgement.verdict === 'fail') {
        criticalIssues.push(`[${result.lang.toUpperCase()}] ${judgement.reason}`);
      }
    }

    const scores = Object.values(perLanguage).map(j => j.score);
    const overallScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const overallVerdict: 'pass' | 'warn' | 'fail' =
      overallScore >= SCORE_THRESHOLDS.pass ? 'pass' :
      overallScore >= SCORE_THRESHOLDS.warn ? 'warn' : 'fail';

    const passCount = scores.filter(s => s >= SCORE_THRESHOLDS.pass).length;
    const summary = `${passCount}/${results.length} languages pass. Score: ${overallScore.toFixed(2)}. ` +
      (criticalIssues.length > 0 ? `Critical: ${criticalIssues.join(' | ')}` : 'No critical issues.');

    return { overallScore, overallVerdict, perLanguage, criticalIssues, summary };
  }
}
