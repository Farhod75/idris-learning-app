/**
 * log-agent.ts
 * Reads verify-report.json → appends VERIFIED bugs to FIX_PATTERNS.md
 * Runs after verify-agent in the orchestrator pipeline.
 * Author: Farhod Elbekov | idris-learning-app
 */
import * as fs   from "fs";
import * as path from "path";

const REPORTS_DIR    = path.resolve(__dirname, "../reports");
const BUG_QUEUE      = path.join(REPORTS_DIR, "bug-queue.json");
const VERIFY_REPORT  = path.join(REPORTS_DIR, "verify-report.json");
const FIX_PATTERNS   = path.resolve(__dirname, "../../../../FIX_PATTERNS.md");

function log(msg: string) {
  console.log(`[log-agent ${new Date().toISOString().substring(11,19)}] ${msg}`);
}

function safeReadJson(filePath: string): any {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function alreadyLogged(bugId: string): boolean {
  if (!fs.existsSync(FIX_PATTERNS)) return false;
  const content = fs.readFileSync(FIX_PATTERNS, "utf-8");
  return content.includes(`## ${bugId}`);
}

function buildEntry(bug: any, verifyResult: any): string {
  const viewportSummary = verifyResult.viewport_results
    .map((v: any) => `${v.viewport} ${v.width}x${v.height}: ${v.passed ? "PASS" : "FAIL"} (${v.cards_checked} cards)`)
    .join("\n  - ");

  return [
    ``,
    `## ${bug.id} — ${bug.title}`,
    `- **File**: \`${bug.file}\``,
    `- **Severity**: ${bug.severity || "medium"}`,
    `- **Root cause**: ${bug.description || "See fix details below"}`,
    `- **Fix applied**:`,
    `  \`\`\``,
    `  FIND:    ${bug.fix?.find || "see bug-queue.json"}`,
    `  REPLACE: ${bug.fix?.replace || "see bug-queue.json"}`,
    `  \`\`\``,
    `- **Test**: \`${bug.test_file}\``,
    `- **Verified**: ${verifyResult.timestamp}`,
    `- **Viewports**:`,
    `  - ${viewportSummary}`,
    `- **Prevention**: Add to CI viewport matrix. Always test at 1280px before deploy.`,
    `- **Attempts**: ${bug.attempts}`,
    ``,
  ].join("\n");
}

export async function runLogAgent(): Promise<{ logged: number; skipped: number }> {
  log("════ LOG-AGENT starting ════");

  if (!fs.existsSync(VERIFY_REPORT)) {
    log("No verify-report.json found — nothing to log");
    return { logged: 0, skipped: 0 };
  }
  if (!fs.existsSync(FIX_PATTERNS)) {
    log(`FIX_PATTERNS.md not found at: ${FIX_PATTERNS}`);
    log("Creating it...");
    fs.writeFileSync(FIX_PATTERNS, "# FIX_PATTERNS.md\n# Auto-updated by log-agent\n", "utf-8");
  }

  const queue        = safeReadJson(BUG_QUEUE);
  const verifyReport = safeReadJson(VERIFY_REPORT);

  let logged  = 0;
  let skipped = 0;

  for (const result of verifyReport.results) {
    if (result.overall !== "PASS") {
      log(`  ⏭  [${result.id}] skipping — not verified (${result.overall})`);
      skipped++;
      continue;
    }
    if (alreadyLogged(result.id)) {
      log(`  ⏭  [${result.id}] already in FIX_PATTERNS.md — skipping`);
      skipped++;
      continue;
    }

    // Find full bug details from queue
    const bug = queue.bugs.find((b: any) => b.id === result.id);
    if (!bug) {
      log(`  ⚠️  [${result.id}] not found in bug-queue — skipping`);
      skipped++;
      continue;
    }

    const entry = buildEntry(bug, result);
    fs.appendFileSync(FIX_PATTERNS, entry, "utf-8");
    log(`  ✅ [${result.id}] logged to FIX_PATTERNS.md`);
    logged++;
  }

  // Update bug-queue logged_to_fix_patterns flag
  for (const bug of queue.bugs) {
    if (bug.status === "verified" && !bug.logged_to_fix_patterns) {
      const wasLogged = verifyReport.results.find((r: any) => r.id === bug.id && r.overall === "PASS");
      if (wasLogged) {
        bug.logged_to_fix_patterns = true;
      }
    }
  }
  fs.writeFileSync(BUG_QUEUE, JSON.stringify(queue, null, 2), "utf-8");

  log(`\nLOG-AGENT done. Logged: ${logged} | Skipped: ${skipped}`);
  log(`FIX_PATTERNS.md → ${FIX_PATTERNS}`);
  return { logged, skipped };
}

if (require.main === module) {
  runLogAgent().catch(err => { console.error("[log-agent] FATAL:", err); process.exit(1); });
}