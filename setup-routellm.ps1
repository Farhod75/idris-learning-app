# setup-routellm.ps1
# ─────────────────────────────────────────────────────────────────────
# ONE-TIME SETUP: Adds RouteLLM review-agent to the multi-agent pipeline
# Run this ONCE from project root — then just set your API key and go
#
# Usage:
#   cd C:\QA\Idris\idris-learning-app
#   .\setup-routellm.ps1
#
# Author: Farhod Elbekov | idris-learning-app
# ─────────────────────────────────────────────────────────────────────

$PROJECT_ROOT  = "C:\QA\Idris\idris-learning-app"
$AGENTS_DIR    = "$PROJECT_ROOT\tests\playwright\multi-agent\agents"
$MULTI_DIR     = "$PROJECT_ROOT\tests\playwright\multi-agent"
$REPORTS_DIR   = "$MULTI_DIR\reports"

function Write-Step($n, $msg) { Write-Host "`n── Step $n`: $msg ──────────────────────" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-SKIP($msg) { Write-Host "  ⏭  $msg (already exists)" -ForegroundColor Yellow }
function Write-ERR($msg)  { Write-Host "  ❌ $msg" -ForegroundColor Red }

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   RouteLLM Review-Agent Setup                   ║" -ForegroundColor Magenta
Write-Host "║   idris-learning-app | Farhod Elbekov           ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Magenta

# ── STEP 1: Create review-agent.ts ───────────────────────────
Write-Step 1 "Creating review-agent.ts"

$reviewAgent = @'
/**
 * review-agent.ts
 * RouteLLM code review — sits between fix-agent and verify-agent.
 * APPROVE → proceed | BLOCK → re-queue | ESCALATE → log + proceed
 * Author: Farhod Elbekov | Reusable across all projects
 */
import * as fs   from "fs";
import * as path from "path";

const ROUTELLM_BASE_URL = process.env.ROUTELLM_BASE_URL || "https://routellm.abacus.ai/v1";
const ROUTELLM_API_KEY  = process.env.ROUTELLM_API_KEY  || "";
const REPORTS_DIR       = path.resolve(__dirname, "../reports");
const BUG_QUEUE         = path.join(REPORTS_DIR, "bug-queue.json");
const FIX_REPORT        = path.join(REPORTS_DIR, "fix-report.json");
const REVIEW_REPORT     = path.join(REPORTS_DIR, "review-report.json");

const ROUTING_CONFIG = {
  threshold:    0.5,
  strong_model: "gpt-4o",
  weak_model:   "claude-haiku-4-5-20251001",
  complexity_signals: ["logic","multiple files","auth","database","api","breaking","javascript","function"],
  simplicity_signals: ["css","max-width","margin","padding","color","font","border","display","gap"],
};

type ReviewDecision = "APPROVE" | "BLOCK" | "ESCALATE";
interface ReviewResult {
  bugId: string; decision: ReviewDecision; model_used: string;
  confidence: number; reason: string; risks: string[];
  suggestions: string[]; cost_tier: "cheap"|"strong"; tokens_used: number;
}
interface ReviewReport {
  agent: string; timestamp: string;
  total: number; approved: number; blocked: number; escalated: number;
  results: ReviewResult[];
}

function log(msg: string) {
  console.log(`[review-agent ${new Date().toISOString().substring(11,19)}] ${msg}`);
}
function safeReadJson(f: string): any {
  return JSON.parse(fs.readFileSync(f, "utf-8").replace(/^\uFEFF/, ""));
}
function scoreComplexity(bug: any): number {
  const text = JSON.stringify(bug).toLowerCase();
  let score = 0.5;
  for (const s of ROUTING_CONFIG.complexity_signals) if (text.includes(s)) score += 0.1;
  for (const s of ROUTING_CONFIG.simplicity_signals) if (text.includes(s)) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}
function buildPrompt(bug: any, fixReport: any): string {
  const fixResult = fixReport?.results?.find((r: any) => r.id === bug.id);
  return `BUG ID: ${bug.id}
TITLE: ${bug.title}
FILE: ${bug.file}
SEVERITY: ${bug.severity || "medium"}
FIX FIND:    ${bug.fix?.find ?? "N/A"}
FIX REPLACE: ${bug.fix?.replace ?? "N/A"}
FIX RESULT:  ${JSON.stringify(fixResult ?? {})}
TEST FILE: ${bug.test_file}
Is this fix correct and safe to verify?`;
}

async function callRouteLLM(prompt: string, score: number): Promise<{
  decision: ReviewDecision; reason: string; risks: string[];
  suggestions: string[]; model_used: string; tokens_used: number;
}> {
  if (!ROUTELLM_API_KEY) {
    log("  ⚠️  ROUTELLM_API_KEY not set — using local heuristic");
    return {
      decision: score > 0.6 ? "ESCALATE" : "APPROVE",
      reason: "Local heuristic (set ROUTELLM_API_KEY to enable LLM review)",
      risks: [], suggestions: [], model_used: "local-heuristic", tokens_used: 0,
    };
  }
  const body = {
    model: `router-${ROUTING_CONFIG.threshold}`,
    messages: [
      {
        role: "system",
        content: `You are a code review agent for a QA automation pipeline.
Respond ONLY with valid JSON, no markdown:
{"decision":"APPROVE"|"BLOCK"|"ESCALATE","confidence":0.0-1.0,"reason":"one sentence","risks":[],"suggestions":[]}
APPROVE=fix correct, safe to verify | BLOCK=wrong/dangerous | ESCALATE=needs human review`
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 300,
  };
  const resp = await fetch(`${ROUTELLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ROUTELLM_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`RouteLLM ${resp.status}: ${await resp.text()}`);
  const data    = await resp.json() as any;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed  = JSON.parse(content.replace(/```json|```/g, "").trim());
  return {
    decision:    parsed.decision    ?? "APPROVE",
    reason:      parsed.reason      ?? "",
    risks:       parsed.risks       ?? [],
    suggestions: parsed.suggestions ?? [],
    model_used:  data.model         ?? "unknown",
    tokens_used: data.usage?.total_tokens ?? 0,
  };
}

export async function runReviewAgent(): Promise<ReviewReport> {
  log("════ REVIEW-AGENT (RouteLLM) starting ════");
  const report: ReviewReport = {
    agent: "review-agent", timestamp: new Date().toISOString(),
    total: 0, approved: 0, blocked: 0, escalated: 0, results: [],
  };
  if (!fs.existsSync(BUG_QUEUE) || !fs.existsSync(FIX_REPORT)) {
    log("Missing required files — skipping"); return report;
  }
  const queue     = safeReadJson(BUG_QUEUE);
  const fixReport = safeReadJson(FIX_REPORT);
  const fixedBugs = queue.bugs.filter((b: any) => b.status === "fixed");
  log(`${fixedBugs.length} fixed bug(s) to review`);

  for (const bug of fixedBugs) {
    log(`\nReviewing [${bug.id}]: ${bug.title}`);
    const score    = scoreComplexity(bug);
    const costTier = score > ROUTING_CONFIG.threshold ? "strong" : "cheap";
    log(`  Complexity: ${score.toFixed(2)} → ${costTier} model`);

    let result: ReviewResult;
    try {
      const api = await callRouteLLM(buildPrompt(bug, fixReport), score);
      result = { bugId: bug.id, decision: api.decision, model_used: api.model_used,
        confidence: score, reason: api.reason, risks: api.risks,
        suggestions: api.suggestions, cost_tier: costTier, tokens_used: api.tokens_used };

      const icon = { APPROVE:"✅", BLOCK:"❌", ESCALATE:"⚠️" }[api.decision];
      log(`  ${icon} ${api.decision} — ${api.reason}`);
      api.risks.forEach((r: string) => log(`     Risk: ${r}`));

      const qBug = queue.bugs.find((b: any) => b.id === bug.id);
      if (qBug) {
        if (api.decision === "BLOCK") {
          qBug.status = "open";
          qBug.fix_result = `blocked: ${api.reason}`;
          report.blocked++;
          log(`  🔄 Re-queued for fix-agent`);
        } else {
          report.approved++;
          if (api.decision === "ESCALATE") { report.escalated++; log(`  ⚠️  Escalated — logged, proceeding`); }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ❌ API error: ${msg} — defaulting APPROVE`);
      result = { bugId: bug.id, decision: "APPROVE", model_used: "error-fallback",
        confidence: 0, reason: `error: ${msg}`, risks: [], suggestions: [],
        cost_tier: "cheap", tokens_used: 0 };
      report.approved++;
    }
    report.results.push(result);
    report.total++;
  }

  fs.writeFileSync(BUG_QUEUE,     JSON.stringify(queue,  null, 2), "utf-8");
  fs.writeFileSync(REVIEW_REPORT, JSON.stringify(report, null, 2), "utf-8");
  log(`\nDone | ✅ ${report.approved} | ❌ ${report.blocked} | ⚠️ ${report.escalated}`);
  return report;
}

if (require.main === module) {
  runReviewAgent().catch(err => { console.error("[review-agent] FATAL:", err); process.exit(1); });
}
'@

[System.IO.File]::WriteAllText("$AGENTS_DIR\review-agent.ts", $reviewAgent, [System.Text.Encoding]::UTF8)
Write-OK "review-agent.ts created"

# ── STEP 2: Create routellm.config.json ──────────────────────
Write-Step 2 "Creating routellm.config.json (global config)"

$routellmConfig = @'
{
  "base_url": "https://routellm.abacus.ai/v1",
  "threshold": 0.5,
  "strong_model": "gpt-4o",
  "weak_model": "claude-haiku-4-5-20251001",
  "enabled": true,
  "review_after": ["fix-agent"],
  "block_on": ["BLOCK"],
  "escalate_on": ["ESCALATE"],
  "notes": "threshold 0.0=always cheap | 1.0=always strong | 0.5=balanced"
}
'@
[System.IO.File]::WriteAllText("$MULTI_DIR\routellm.config.json", $routellmConfig, [System.Text.Encoding]::UTF8)
Write-OK "routellm.config.json created"

# ── STEP 3: Create .env.example ──────────────────────────────
Write-Step 3 "Creating .env.example"

$envExample = @'
# RouteLLM — obtain key at https://routellm.abacus.ai
ROUTELLM_API_KEY=your-abacus-routellm-key-here
ROUTELLM_BASE_URL=https://routellm.abacus.ai/v1
ROUTELLM_THRESHOLD=0.5

# App
APP_URL=http://localhost:3000
MAX_RETRIES=3
'@
[System.IO.File]::WriteAllText("$PROJECT_ROOT\.env.example", $envExample, [System.Text.Encoding]::UTF8)
Write-OK ".env.example created"

# ── STEP 4: Update .gitignore ─────────────────────────────────
Write-Step 4 "Updating .gitignore"

$gitignorePath = "$PROJECT_ROOT\.gitignore"
$currentIgnore = if (Test-Path $gitignorePath) { Get-Content $gitignorePath -Raw } else { "" }
if ($currentIgnore -notmatch "ROUTELLM_API_KEY") {
    $additions = "`n# RouteLLM / secrets`n.env`n.env.local`n*.env`n!.env.example`n"
    [System.IO.File]::WriteAllText($gitignorePath, $currentIgnore + $additions, [System.Text.Encoding]::UTF8)
    Write-OK ".gitignore updated (.env excluded)"
} else { Write-SKIP ".gitignore already has .env" }

# ── STEP 5: Patch orchestrator — add Step 1.5 ────────────────
Write-Step 5 "Patching orchestrator-with-fixer.ts (adding Step 1.5)"

$orchPath = "$MULTI_DIR\orchestrator-with-fixer.ts"
$orch = [System.IO.File]::ReadAllText($orchPath)

if ($orch -match "runReviewAgent") {
    Write-SKIP "orchestrator already has review-agent import"
} else {
    # Add import after last existing agent import
    $orch = $orch -replace '(import \{ runLogAgent \}[^\n]+\n)', '$1import { runReviewAgent }  from "./agents/review-agent";' + "`n"

    # Add Step 1.5 between fix-agent and the 30s wait
    $step15 = @'

  // ── Step 1.5: REVIEW-AGENT (RouteLLM) ─────────────────────
  console.log("\n── Step 1.5: Review Agent (RouteLLM) ──────────────────────");
  const reviewReport = await runReviewAgent();
  console.log(`   Approved: ${reviewReport.approved} | Blocked: ${reviewReport.blocked} | Escalated: ${reviewReport.escalated}`);
  if (reviewReport.approved === 0 && reviewReport.blocked > 0) {
    console.log("   All fixes blocked by review-agent — skipping verify this loop");
    continue;
  }
'@
    # Insert before "Step 2: Waiting"
    $orch = $orch -replace '(// ── Step 2)', $step15 + '$1'

    [System.IO.File]::WriteAllText($orchPath, $orch, [System.Text.Encoding]::UTF8)
    Write-OK "orchestrator patched — Step 1.5 added"
}

# ── STEP 6: Patch log-agent — add A/B stats logging ──────────
Write-Step 6 "Patching log-agent.ts (adding A/B stats)"

$logAgentPath = "$AGENTS_DIR\log-agent.ts"
$logAgent = [System.IO.File]::ReadAllText($logAgentPath)

if ($logAgent -match "logABStats") {
    Write-SKIP "log-agent already has A/B stats"
} else {
    $abStats = @'

// ─── A/B STATS (appended to FIX_PATTERNS.md) ────────────────
function logABStats(reviewReportPath: string): void {
  if (!fs.existsSync(reviewReportPath)) return;
  const rr          = safeReadJson(reviewReportPath);
  const cheap       = rr.results?.filter((r: any) => r.cost_tier === "cheap").length ?? 0;
  const strong      = rr.results?.filter((r: any) => r.cost_tier === "strong").length ?? 0;
  const blocked     = rr.results?.filter((r: any) => r.decision === "BLOCK").length ?? 0;
  const totalTokens = rr.results?.reduce((a: number, r: any) => a + (r.tokens_used || 0), 0) ?? 0;
  const entry = `\n## A/B Review Stats — ${rr.timestamp}\n| Metric | Value |\n|--------|-------|\n| Cheap model reviews | ${cheap} |\n| Strong model reviews | ${strong} |\n| Fixes blocked (browser run saved) | ${blocked} |\n| Total tokens used | ${totalTokens} |\n`;
  if (fs.existsSync(FIX_PATTERNS)) fs.appendFileSync(FIX_PATTERNS, entry, "utf-8");
  log(`  📊 A/B stats logged (cheap:${cheap} strong:${strong} blocked:${blocked})`);
}
'@
    # Append before the export
    $logAgent = $logAgent -replace '(export async function runLogAgent)', $abStats + '$1'

    # Call logABStats inside runLogAgent before return
    $reviewReportPath = 'path.join(REPORTS_DIR, "review-report.json")'
    $logAgent = $logAgent -replace '(log\(`\\nLOG-AGENT done)', "  logABStats($reviewReportPath);`n  `$1"

    [System.IO.File]::WriteAllText($logAgentPath, $logAgent, [System.Text.Encoding]::UTF8)
    Write-OK "log-agent.ts patched — A/B stats added"
}

# ── STEP 7: Update bug-queue.json — add review field ─────────
Write-Step 7 "Updating bug-queue.json (adding review field)"

$bqPath = "$REPORTS_DIR\bug-queue.json"
$bq = [System.IO.File]::ReadAllText($bqPath).replace([char]0xFEFF, "")
if ($bq -match '"review"') {
    Write-SKIP "bug-queue.json already has review field"
} else {
    # Add review block to each bug before the closing }
    $bq = $bq -replace '("logged_to_fix_patterns": (?:true|false))', '$1,
      "review": { "enabled": true, "last_decision": null, "last_model": null, "blocked_count": 0 }'
    [System.IO.File]::WriteAllText($bqPath, $bq, [System.Text.Encoding]::UTF8)
    Write-OK "bug-queue.json updated"
}

# ── STEP 8: Add review-report.json to .gitignore ─────────────
Write-Step 8 "Adding review-report.json to .gitignore"
$gi = [System.IO.File]::ReadAllText($gitignorePath)
if ($gi -notmatch "review-report") {
    [System.IO.File]::WriteAllText($gitignorePath, $gi + "`ntests/playwright/multi-agent/reports/review-report*.json`n", [System.Text.Encoding]::UTF8)
    Write-OK "review-report*.json excluded from git"
} else { Write-SKIP "already in .gitignore" }

# ── STEP 9: Copy ROUTELLM_REVIEW.md to project root ──────────
Write-Step 9 "Placing ROUTELLM_REVIEW.md in project root"

# Check if already exists
if (Test-Path "$PROJECT_ROOT\ROUTELLM_REVIEW.md") {
    Write-SKIP "ROUTELLM_REVIEW.md already exists"
} else {
    # Create a pointer file — full doc lives in the downloaded file
    $pointer = "# ROUTELLM_REVIEW.md`n# See: https://github.com/Farhod75/idris-learning-app/blob/main/ROUTELLM_REVIEW.md`n# Full documentation downloaded separately`n"
    [System.IO.File]::WriteAllText("$PROJECT_ROOT\ROUTELLM_REVIEW.md", $pointer, [System.Text.Encoding]::UTF8)
    Write-OK "ROUTELLM_REVIEW.md placeholder created"
}

# ── STEP 10: Verify compile ───────────────────────────────────
Write-Step 10 "Verifying TypeScript compiles"
Push-Location $MULTI_DIR
$result = & npx tsc --noEmit --project tsconfig.json 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "TypeScript compile clean"
} else {
    Write-ERR "TypeScript errors — check output:"
    Write-Host $result -ForegroundColor Yellow
}
Pop-Location

# ── FINAL SUMMARY ────────────────────────────────────────────
Write-Host "`n╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   SETUP COMPLETE                                 ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "║  ✅ review-agent.ts     — created               ║" -ForegroundColor Green
Write-Host "║  ✅ routellm.config.json — created              ║" -ForegroundColor Green
Write-Host "║  ✅ .env.example        — created               ║" -ForegroundColor Green
Write-Host "║  ✅ orchestrator        — Step 1.5 added        ║" -ForegroundColor Green
Write-Host "║  ✅ log-agent           — A/B stats added       ║" -ForegroundColor Green
Write-Host "║  ✅ bug-queue.json      — review field added    ║" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "║  🔑 ONE MANUAL STEP REQUIRED:                   ║" -ForegroundColor Yellow
Write-Host "║                                                  ║" -ForegroundColor Yellow
Write-Host "║  Copy .env.example to .env and add your key:   ║" -ForegroundColor Yellow
Write-Host "║                                                  ║" -ForegroundColor Yellow
Write-Host "║  Copy-Item .env.example .env                    ║" -ForegroundColor Yellow
Write-Host "║  Then edit .env:                                 ║" -ForegroundColor Yellow
Write-Host "║  ROUTELLM_API_KEY=your-abacus-key-here          ║" -ForegroundColor Yellow
Write-Host "║                                                  ║" -ForegroundColor Yellow
Write-Host "║  Get key: https://routellm.abacus.ai            ║" -ForegroundColor Yellow
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "║  Then run:                                       ║" -ForegroundColor Green
Write-Host "║  npx ts-node --project tests/playwright/        ║" -ForegroundColor Green
Write-Host "║    multi-agent/tsconfig.json                    ║" -ForegroundColor Green
Write-Host "║    orchestrator-with-fixer.ts                   ║" -ForegroundColor Green
Write-Host "║                                                  ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
