/**
 * docs-agent.ts
 * Step 5 in the pipeline — runs after log-agent
 * 
 * WHAT IT DOES:
 *   1. Reads orchestrator-report.json for errors/new patterns
 *   2. Reads verify-report.json + review-report.json for failures
 *   3. Calls Claude API to generate FP pattern entries
 *   4. Appends new patterns to FIX_PATTERNS.md
 *   5. Updates CLAUDE.md + ABOUT.md
 *   6. Syncs to engineering-standards repo
 *   7. Commits + pushes both repos
 *
 * Author: Farhod Elbekov | idris-learning-app
 * Pattern: FP-053+
 */
import * as fs   from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ─── CONFIG ──────────────────────────────────────────────────
const PROJECT_ROOT   = path.resolve(__dirname, "../../../../");
const REPORTS_DIR    = path.resolve(__dirname, "../reports");
const ES_REPO        = "C:\\QA\\engineering-standards";
const FIX_PATTERNS   = path.join(PROJECT_ROOT, "FIX_PATTERNS.md");
const CLAUDE_MD      = path.join(PROJECT_ROOT, "CLAUDE.md");
const ABOUT_MD       = path.join(PROJECT_ROOT, "ABOUT.md");
const DOCS_LOG       = path.join(REPORTS_DIR, "docs-agent-log.json");
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY || "";

function log(msg: string) {
  console.log(`[docs-agent ${new Date().toISOString().substring(11,19)}] ${msg}`);
}
function safeReadJson(f: string): any {
  try { return JSON.parse(fs.readFileSync(f, "utf-8").replace(/^\uFEFF/, "")); }
  catch { return null; }
}
function getNextFpNumber(): string {
  const content = fs.readFileSync(FIX_PATTERNS, "utf-8");
  const matches = content.match(/## FP-(\d+)/g) || [];
  if (matches.length === 0) return "FP-001";
  const numbers = matches.map(m => parseInt(m.replace("## FP-", "")));
  const next = Math.max(...numbers) + 1;
  return `FP-${String(next).padStart(3, "0")}`;
}

// ─── COLLECT ERRORS FROM REPORTS ─────────────────────────────
interface ErrorEvent {
  source: string;
  bugId: string;
  error: string;
  context: string;
}

function collectErrors(): ErrorEvent[] {
  const errors: ErrorEvent[] = [];

  // From orchestrator report
  const orchFiles = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith("orchestrator-report"))
    .sort().reverse();

  if (orchFiles.length > 0) {
    const orch = safeReadJson(path.join(REPORTS_DIR, orchFiles[0]));
    if (orch?.verifyReport?.results) {
      for (const r of orch.verifyReport.results) {
        if (r.overall === "FAIL") {
          for (const vp of r.viewport_results || []) {
            for (const failure of vp.failures || []) {
              errors.push({
                source: "verify-agent",
                bugId: r.id,
                error: failure,
                context: `viewport: ${vp.viewport} ${vp.width}x${vp.height}`
              });
            }
          }
        }
      }
    }
  }

  // From review report
  const reviewReport = safeReadJson(path.join(REPORTS_DIR, "review-report.json"));
  if (reviewReport?.results) {
    for (const r of reviewReport.results) {
      if (r.decision === "BLOCK") {
        errors.push({
          source: "review-agent",
          bugId: r.bugId,
          error: r.reason,
          context: `model: ${r.model_used}, cost_tier: ${r.cost_tier}`
        });
      }
      if (r.model_used === "error-fallback") {
        errors.push({
          source: "review-agent-api",
          bugId: r.bugId,
          error: r.reason,
          context: "RouteLLM API error — defaulted to APPROVE"
        });
      }
    }
  }

  // From RAG report
  const ragReport = safeReadJson(path.join(REPORTS_DIR, "rag-report.json"));
  if (ragReport?.recommendation?.includes("error")) {
    errors.push({
      source: "rag-agent",
      bugId: ragReport.bug_id || "unknown",
      error: ragReport.recommendation,
      context: `query: ${ragReport.query?.substring(0, 60)}`
    });
  }

  return errors;
}

// ─── CALL CLAUDE API TO GENERATE FP ENTRY ───────────────────
async function generateFpEntry(
  fpNumber: string,
  errors: ErrorEvent[],
  sessionContext: string
): Promise<string | null> {
  if (!ANTHROPIC_KEY) {
    log("  ⚠️  No ANTHROPIC_API_KEY — generating template FP entry");
    return generateTemplateFpEntry(fpNumber, errors);
  }

  const prompt = `You are a QA engineer maintaining a FIX_PATTERNS.md file.
Based on the errors and context below, generate a new fix pattern entry.

SESSION CONTEXT:
${sessionContext}

ERRORS DETECTED:
${errors.map(e => `- [${e.source}] ${e.error} (${e.context})`).join("\n")}

Generate a fix pattern entry in EXACTLY this format:
## ${fpNumber} — [short title describing root cause]
- **Symptom**: [what the developer sees]
- **Root cause**: [why it happens]
- **Fix**: [exact steps to fix]
- **Rule**: [one-line rule to remember]
- **Prevention**: [how to prevent in future]

Be concise. Technical. Actionable. Max 8 lines total.
Return ONLY the pattern entry — no preamble, no markdown fences.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      log(`  ❌ Claude API error: ${err}`);
      return generateTemplateFpEntry(fpNumber, errors);
    }

    const data = await response.json() as any;
    return "\n\n---\n\n" + (data.content[0]?.text || "");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`  ❌ API error: ${msg}`);
    return generateTemplateFpEntry(fpNumber, errors);
  }
}

function generateTemplateFpEntry(fpNumber: string, errors: ErrorEvent[]): string {
  const firstError = errors[0];
  return `\n\n---\n\n## ${fpNumber} — ${firstError?.source || "pipeline"} error detected\n` +
    `- **Symptom**: ${firstError?.error || "See docs-agent-log.json"}\n` +
    `- **Root cause**: Auto-detected by docs-agent\n` +
    `- **Fix**: Review ${firstError?.source || "pipeline"} output and fix manually\n` +
    `- **Rule**: Check docs-agent-log.json after every pipeline run\n` +
    `- **Prevention**: Ensure all API keys are set in .env\n`;
}

// ─── UPDATE CLAUDE.md ────────────────────────────────────────
function updateClaudeMd(fpNumber: string, summary: string): void {
  const content = fs.readFileSync(CLAUDE_MD, "utf-8");
  const update  = `\n## Auto-logged ${fpNumber} (${new Date().toISOString().substring(0,10)})\n${summary}\n`;
  if (!content.includes(fpNumber)) {
    fs.appendFileSync(CLAUDE_MD, update, "utf-8");
    log(`  ✅ CLAUDE.md updated with ${fpNumber}`);
  }
}

// ─── UPDATE ABOUT.md ─────────────────────────────────────────
function updateAboutMd(fpNumber: string): void {
  const content = fs.readFileSync(ABOUT_MD, "utf-8");
  // Update the FP count line
  const updated = content.replace(
    /FP-\d+ to FP-\d+ fix patterns logged/,
    `FP-001 to ${fpNumber} fix patterns logged`
  );
  if (updated !== content) {
    fs.writeFileSync(ABOUT_MD, updated, "utf-8");
    log(`  ✅ ABOUT.md FP count updated to ${fpNumber}`);
  }
}

// ─── SYNC TO ENGINEERING-STANDARDS ──────────────────────────
function syncToEngineeringStandards(): void {
  if (!fs.existsSync(ES_REPO)) {
    log(`  ⚠️  engineering-standards not found at ${ES_REPO} — skipping sync`);
    return;
  }
  try {
    const files = ["FIX_PATTERNS.md", "CLAUDE.md", "ABOUT.md"];
    for (const f of files) {
      const src = path.join(PROJECT_ROOT, f);
      const dst = path.join(ES_REPO, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        log(`  📋 Synced ${f} to engineering-standards`);
      }
    }
    execSync(`git add -A && git diff --cached --quiet || git commit -m "sync: docs-agent ${new Date().toISOString().substring(0,10)}" && git push origin main`, { cwd: ES_REPO, stdio: "pipe" });
    log("  ✅ engineering-standards pushed");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("nothing to commit")) log("  ⏭  engineering-standards nothing to commit");
    else log(`  ⚠️  Sync warning: ${msg.substring(0, 100)}`);
  }
}

// ─── GIT COMMIT + PUSH ───────────────────────────────────────
function gitCommitPush(fpNumber: string): void {
  try {
    execSync(
      `git add FIX_PATTERNS.md CLAUDE.md ABOUT.md && ` +
      `git commit -m "docs: auto-log ${fpNumber} via docs-agent" && ` +
      `git push origin main`,
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    log(`  ✅ Committed and pushed ${fpNumber} to GitHub`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("nothing to commit")) log("  ⏭  Nothing new to commit");
    else log(`  ⚠️  Git warning: ${msg.substring(0, 100)}`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────
export async function runDocsAgent(): Promise<{ logged: number; fp_number: string }> {
  log("════ DOCS-AGENT starting ════");

  const errors = collectErrors();
  log(`Collected ${errors.length} error event(s) from pipeline reports`);

  const result = { logged: 0, fp_number: "" };

  if (errors.length === 0) {
    log("No new errors detected — pipeline ran cleanly");
    log("Syncing docs to engineering-standards anyway...");
    syncToEngineeringStandards();
    return result;
  }

  // Generate FP entry
  const fpNumber = getNextFpNumber();
  const sessionContext = `Pipeline run: ${new Date().toISOString()}\n` +
    `Errors from: ${[...new Set(errors.map(e => e.source))].join(", ")}`;

  log(`Generating ${fpNumber} entry via Claude API...`);
  const fpEntry = await generateFpEntry(fpNumber, errors, sessionContext);

  if (fpEntry) {
    // Append to FIX_PATTERNS.md
    fs.appendFileSync(FIX_PATTERNS, fpEntry, "utf-8");
    log(`✅ ${fpNumber} appended to FIX_PATTERNS.md`);

    // Update other docs
    updateClaudeMd(fpNumber, errors[0]?.error || "");
    updateAboutMd(fpNumber);

    result.logged = 1;
    result.fp_number = fpNumber;
  }

  // Save log
  fs.writeFileSync(DOCS_LOG, JSON.stringify({
    timestamp: new Date().toISOString(),
    errors_detected: errors.length,
    fp_generated: fpNumber,
    errors
  }, null, 2), "utf-8");

  // Commit + sync
  gitCommitPush(fpNumber);
  syncToEngineeringStandards();

  log(`\nDOCS-AGENT done | logged: ${result.logged} | fp: ${result.fp_number}`);
  return result;
}

if (require.main === module) {
  runDocsAgent().catch(err => {
    console.error("[docs-agent] FATAL:", err);
    process.exit(1);
  });
}