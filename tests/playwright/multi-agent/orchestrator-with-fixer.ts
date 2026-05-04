/**
 * orchestrator-with-fixer.ts
 * Reads bug-queue (reports/bug-queue.json), runs Fix Agent â†’ waits 30s â†’ runs Verify Agent.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npx ts-node orchestrator-with-fixer.ts
 */

import * as fs   from 'fs';
import * as path from 'path';
import { runFixAgent }    from './agents/fix-agent';
import { runVerifyAgent } from './agents/verify-agent';
import { runLogAgent }    from "./agents/log-agent";

function safeReadJson(filePath: string): any {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

// verify-agent reads APP_URL; npm scripts may set BASE_URL â€” normalise here
if (process.env.BASE_URL && !process.env.APP_URL) {
  process.env.APP_URL = process.env.BASE_URL;
}

const BUG_QUEUE_PATH  = path.resolve(__dirname, 'reports/bug-queue.json');
const REPORTS_DIR     = path.resolve(__dirname, 'reports');
const VERIFY_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('â•'.repeat(60));
  console.log('  Idris App â€” Fix + Verify Orchestrator');
  console.log(`  APP_URL: ${process.env.APP_URL ?? process.env.BASE_URL ?? 'http://localhost:3000'}`);
  console.log('â•'.repeat(60));

  if (!fs.existsSync(BUG_QUEUE_PATH)) {
    console.error(`âŒ Bug queue not found: ${BUG_QUEUE_PATH}`);
    process.exit(1);
  }

  // Step 1: Apply fixes
  console.log('\nâ”€â”€ Step 1: Fix Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
  const fixResult = await runFixAgent();

  if (!fixResult.success || fixResult.bugsFixed === 0) {
    console.log('\nâš ï¸  No bugs fixed â€” skipping verify.');
    process.exit(0);
  }

  // Step 2: Wait for server to pick up file changes
  console.log(`\nâ”€â”€ Step 2: Waiting ${VERIFY_DELAY_MS / 1000}s for server reload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€`);
  await sleep(VERIFY_DELAY_MS);

  // Step 3: Verify fixes
  console.log('\nâ”€â”€ Step 3: Verify Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
  const verifyReport = await runVerifyAgent();

  // ── Step 4: LOG-AGENT ──────────────────────────────────
  console.log("\n── Step 4: Log Agent ─────────────────────────────────────────────");
  const logResult = await runLogAgent();
  console.log(`   Logged: ${logResult.logged} | Skipped: ${logResult.skipped}`);

  // Step 4: Summary
  console.log('\n' + 'â•'.repeat(60));
  console.log('  SUMMARY');
  console.log('â•'.repeat(60));
  console.log(`  Bugs fixed:    ${fixResult.bugsFixed}`);
  console.log(`  Verified:      ${verifyReport.bugs_verified}`);
  console.log(`  Passed:        ${verifyReport.passed}`);
  console.log(`  Failed:        ${verifyReport.failed}`);

  // Write orchestrator report
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `orchestrator-report-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    fixResult,
    verifyReport,
  }, null, 2));
  console.log(`\nðŸ“„ Report: ${reportPath}`);

  process.exit(verifyReport.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('ðŸš¨ Orchestrator crashed:', err);
  process.exit(1);
});
