import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const TIMEOUT_MS = 90_000;

let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    _client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });
  }
  return _client;
}

export interface JudgeResult {
  score: number;           // 0.0 – 1.0
  verdict: 'pass' | 'warn' | 'fail';
  reason: string;
  issues: string[];
}

/**
 * LLM-as-judge pattern (QA_STANDARDS.md).
 * temperature=0 for deterministic scoring.
 */
export async function judgeWithClaude(
  systemPrompt: string,
  userContent: string,
): Promise<JudgeResult> {
  const client = getClaudeClient();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    // Strip any markdown fences the model may add
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean) as JudgeResult;
  } catch {
    return { score: 0, verdict: 'fail', reason: `Judge returned non-JSON: ${text}`, issues: ['parse_error'] };
  }
}

export { CLAUDE_MODEL };
