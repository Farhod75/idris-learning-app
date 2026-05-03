/**
 * FP Logger — auto-updates FIX_PATTERNS.md with novel bug patterns.
 *
 * Uses Claude to:
 *  1. Classify each bug against known FP-027…FP-035 patterns
 *  2. Generate a new FP entry if the bug is novel
 *  3. Append the entry to FIX_PATTERNS.md
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { BugReport } from './bug-reporter';

const MODEL = 'claude-sonnet-4-6';
const FIX_PATTERNS_PATH = path.resolve(__dirname, '../../../../FIX_PATTERNS.md');
const TIMEOUT_MS = 60_000;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY env var not set');
    _client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });
  }
  return _client;
}

interface FPClassification {
  isNovel: boolean;
  matchedPattern?: string; // e.g. "FP-034"
  reason: string;
  suggestedEntry?: string; // full Markdown block for a new FP
}

const CLASSIFY_SYSTEM = `You are a QA engineer classifying bugs against known fix patterns for a multilingual ASD learning PWA.

Known patterns already documented: FP-001 through FP-035.
The app targets: iPad Safari, iPhone Safari, Chrome on Android.
Tech stack: Vanilla JS, Web Speech API, Web Audio API, Playwright tests.

You will receive a bug report and must determine:
1. Is this a NOVEL bug (not matching any known FP)?
2. If novel, generate a new FP entry in the exact format below.

FP entry format (Markdown):
---
### FP-XXX: <short title>

**Pattern:** <one sentence describing the recurring bug class>
**Root Cause:** <technical root cause>
**Fix:** <code fix or config change>
**Detected by:** auto-qa multi-agent
**Languages affected:** <comma-separated lang codes or "all">
**Severity:** <critical|major|minor>

\`\`\`javascript
// Fix example
\`\`\`
---

Return JSON only:
{
  "isNovel": true/false,
  "matchedPattern": "<FP-XXX or null>",
  "reason": "<one sentence>",
  "suggestedEntry": "<full markdown string or null>"
}`;

/** Classify a single bug report against known FP patterns. */
async function classifyBug(bug: BugReport): Promise<FPClassification> {
  const client = getClient();

  const input = `Bug Report:
Title: ${bug.title}
Language: ${bug.lang}
Severity: ${bug.severity}
Failed Checks: ${bug.failedChecks.join('; ') || 'none'}
Body excerpt: ${bug.body.slice(0, 500)}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: 'user', content: input }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean) as FPClassification;
  } catch {
    return {
      isNovel: false,
      reason: `classify_parse_error: ${text.slice(0, 100)}`,
    };
  }
}

/** Read current FIX_PATTERNS.md and find the highest FP number. */
function getNextFPNumber(): number {
  if (!fs.existsSync(FIX_PATTERNS_PATH)) return 36;
  const content = fs.readFileSync(FIX_PATTERNS_PATH, 'utf8');
  const matches = [...content.matchAll(/FP-(\d+)/g)];
  if (matches.length === 0) return 36;
  const nums = matches.map(m => parseInt(m[1], 10));
  return Math.max(...nums) + 1;
}

/** Append a new FP entry to FIX_PATTERNS.md. */
function appendFPEntry(entry: string, fpNumber: number): void {
  if (!fs.existsSync(FIX_PATTERNS_PATH)) {
    console.warn('[fp-logger] FIX_PATTERNS.md not found — skipping append');
    return;
  }
  const placeholder = /FP-XXX/g;
  const numbered = entry.replace(placeholder, `FP-${String(fpNumber).padStart(3, '0')}`);
  const current = fs.readFileSync(FIX_PATTERNS_PATH, 'utf8');
  const updated = current.trimEnd() + '\n\n' + numbered.trim() + '\n';
  fs.writeFileSync(FIX_PATTERNS_PATH, updated, 'utf8');
  console.log(`[fp-logger] Appended FP-${String(fpNumber).padStart(3, '0')} to FIX_PATTERNS.md`);
}

export interface FPLogResult {
  bug: string; // bug id
  isNovel: boolean;
  matchedPattern?: string;
  newFPNumber?: number;
  reason: string;
}

/**
 * Process a list of bug reports — classify each and log novel patterns.
 * Returns a summary of what was logged.
 */
export async function logBugPatterns(bugs: BugReport[]): Promise<FPLogResult[]> {
  const results: FPLogResult[] = [];
  let nextFP = getNextFPNumber();

  for (const bug of bugs) {
    try {
      const classification = await classifyBug(bug);

      const result: FPLogResult = {
        bug: bug.id,
        isNovel: classification.isNovel,
        matchedPattern: classification.matchedPattern ?? undefined,
        reason: classification.reason,
      };

      if (classification.isNovel && classification.suggestedEntry) {
        appendFPEntry(classification.suggestedEntry, nextFP);
        result.newFPNumber = nextFP;
        nextFP++;
      }

      results.push(result);
    } catch (err) {
      results.push({
        bug: bug.id,
        isNovel: false,
        reason: `fp-logger error: ${String(err).slice(0, 100)}`,
      });
    }
  }

  return results;
}
