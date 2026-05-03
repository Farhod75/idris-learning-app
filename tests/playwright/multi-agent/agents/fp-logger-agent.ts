import fs from 'fs';
import path from 'path';
import { judgeWithClaude } from '../utils/claude-client';
import { BugReport } from './bug-report-agent';
import { LanguageAgentResult, CheckResult } from './language-agent';

const FIX_PATTERNS_PATH = path.resolve(__dirname, '../../../../FIX_PATTERNS.md');

const CATEGORIZE_PROMPT = `You analyze test failures in a multilingual ASD learning PWA and categorize them into FIX_PATTERN entries.

Given a bug report, determine:
1. Whether it matches an EXISTING known pattern (e.g., FP-027 through FP-035)
2. Or if it's a NEW pattern not yet documented

Known pattern areas (do NOT re-create these):
- FP-027: video no-repeat rotation
- FP-028: 5-tier video reward duration
- FP-029: back navigation
- FP-030: emoji stripping from TTS
- FP-031: in-app cartoon mode
- FP-032: Arabic/Spanish/French language support
- FP-033: Uzbek TTS fallback to Turkish
- FP-034: iPhone getUserMedia before SpeechRecognition
- FP-035: auto-read word on load + TTS rate 0.7

Respond with JSON:
{
  "isNew": true/false,
  "matchedPattern": "FP-XXX" or null,
  "suggestedId": "FP-XXX" (next sequential ID if isNew),
  "category": "TTS|Navigation|Language|Layout|Accessibility|Audio|Permissions|Performance|Other",
  "title": "<short title>",
  "symptom": "<what the user/tester sees>",
  "rootCause": "<technical explanation>",
  "fix": "<code snippet or description of fix>",
  "files": ["file1.html", "file2.ts"],
  "priority": "P0|P1|P2"
}

Return ONLY JSON. No markdown.`;

export interface FPEntry {
  id: string;
  category: string;
  title: string;
  symptom: string;
  rootCause: string;
  fix: string;
  files: string[];
  priority: string;
  detectedAt: string;
  langContext?: string;
}

export class FPLoggerAgent {
  private nextId: number;

  constructor() {
    this.nextId = this.getNextPatternId();
  }

  private getNextPatternId(): number {
    if (!fs.existsSync(FIX_PATTERNS_PATH)) return 36;
    const content = fs.readFileSync(FIX_PATTERNS_PATH, 'utf8');
    const matches = content.match(/^## FP-(\d+)/gm) || [];
    if (matches.length === 0) return 36;
    const ids = matches.map(m => parseInt(m.replace('## FP-', ''), 10));
    return Math.max(...ids) + 1;
  }

  /**
   * Analyze test failures and log new FIX_PATTERNS entries for novel issues.
   * Returns IDs of any new patterns added.
   */
  async processResults(results: LanguageAgentResult[], bugs: BugReport[]): Promise<string[]> {
    const newPatternIds: string[] = [];

    for (const bug of bugs) {
      // Only process critical/major bugs
      if (bug.severity === 'minor') continue;

      const failedChecks = bug.checks.join('\n');
      const prompt = `Bug ID: ${bug.id}
Language: ${bug.lang}
Severity: ${bug.severity}
Title: ${bug.title}

Failed checks:
${failedChecks}

Description:
${bug.description}`;

      let analysis: any;
      try {
        analysis = await judgeWithClaude(CATEGORIZE_PROMPT, prompt);
      } catch {
        continue;
      }

      if (!analysis || !analysis.isNew) continue;
      if (analysis.matchedPattern) continue; // already documented

      const id = analysis.suggestedId || `FP-${this.nextId}`;
      this.nextId++;

      const entry: FPEntry = {
        id,
        category: analysis.category || 'Other',
        title: analysis.title || bug.title,
        symptom: analysis.symptom || bug.description,
        rootCause: analysis.rootCause || 'Unknown',
        fix: analysis.fix || 'See bug report',
        files: analysis.files || [],
        priority: analysis.priority || 'P1',
        detectedAt: new Date().toISOString(),
        langContext: bug.lang,
      };

      this.appendToFIXPATTERNS(entry);
      newPatternIds.push(id);
    }

    return newPatternIds;
  }

  private appendToFIXPATTERNS(entry: FPEntry): void {
    if (!fs.existsSync(FIX_PATTERNS_PATH)) {
      console.warn(`FIX_PATTERNS.md not found at ${FIX_PATTERNS_PATH}, skipping append`);
      return;
    }

    const section = [
      '',
      `## ${entry.id} — ${entry.title}`,
      `**Category:** ${entry.category}  `,
      `**Priority:** ${entry.priority}  `,
      `**Detected:** ${entry.detectedAt}  `,
      `**Lang context:** ${entry.langContext || 'all'}  `,
      `**Files:** ${entry.files.join(', ') || 'unknown'}  `,
      '',
      '**Symptom:**',
      entry.symptom,
      '',
      '**Root cause:**',
      entry.rootCause,
      '',
      '**Fix:**',
      '```',
      entry.fix,
      '```',
      '',
    ].join('\n');

    fs.appendFileSync(FIX_PATTERNS_PATH, section, 'utf8');
    console.log(`FPLoggerAgent: appended ${entry.id} to FIX_PATTERNS.md`);
  }
}
