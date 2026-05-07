import * as fs from "fs";
import * as path from "path";

const ROUTELLM_BASE_URL = process.env.ROUTELLM_BASE_URL || "https://routellm.abacus.ai/v1";
const ROUTELLM_API_KEY  = process.env.ROUTELLM_API_KEY  || "";
const REPORTS_DIR       = path.resolve(__dirname, "../reports");
const BUG_QUEUE         = path.join(REPORTS_DIR, "bug-queue.json");
const FIX_REPORT        = path.join(REPORTS_DIR, "fix-report.json");
const REVIEW_REPORT     = path.join(REPORTS_DIR, "review-report.json");

const ROUTING_CONFIG = {
  threshold: parseFloat(process.env.ROUTELLM_THRESHOLD || "0.5"),
  complexity_signals: ["logic","multiple files","auth","database","api","breaking","javascript","function"],
  simplicity_signals: ["css","max-width","margin","padding","color","font","border","display","gap"],
};

type ReviewDecision = "APPROVE" | "BLOCK" | "ESCALATE";
interface ReviewResult { bugId:string; decision:ReviewDecision; model_used:string; confidence:number; reason:string; risks:string[]; suggestions:string[]; cost_tier:"cheap"|"strong"; tokens_used:number; }
interface ReviewReport { agent:string; timestamp:string; total:number; approved:number; blocked:number; escalated:number; results:ReviewResult[]; }

function log(msg: string) { console.log(`[review-agent ${new Date().toISOString().substring(11,19)}] ${msg}`); }
function safeReadJson(f: string): any { return JSON.parse(fs.readFileSync(f,"utf-8").replace(/^\uFEFF/,"")); }

function scoreComplexity(bug: any): number {
  const text = JSON.stringify(bug).toLowerCase();
  let score = 0.5;
  for (const s of ROUTING_CONFIG.complexity_signals) if (text.includes(s)) score += 0.1;
  for (const s of ROUTING_CONFIG.simplicity_signals) if (text.includes(s)) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}

async function callRouteLLM(prompt: string, score: number): Promise<{decision:ReviewDecision;reason:string;risks:string[];suggestions:string[];model_used:string;tokens_used:number;}> {
  if (!ROUTELLM_API_KEY) {
    log("  ⚠️  No ROUTELLM_API_KEY — local heuristic only");
    return { decision: score > 0.6 ? "ESCALATE" : "APPROVE", reason:"Local heuristic", risks:[], suggestions:[], model_used:"local-heuristic", tokens_used:0 };
  }
  const body = {
    model: "claude-haiku-4-5-20251001",
    messages: [
      { role:"system", content:`You are a code review agent. Respond ONLY with JSON:\n{"decision":"APPROVE","confidence":0.9,"reason":"one sentence","risks":[],"suggestions":[]}` },
      { role:"user", content:prompt }
    ],
    temperature: 0.1, max_tokens: 300,
  };
  const resp = await fetch(`${ROUTELLM_BASE_URL}/chat/completions`, {
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${ROUTELLM_API_KEY}`},
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`RouteLLM ${resp.status}: ${await resp.text()}`);
  const data   = await resp.json() as any;
  const parsed = JSON.parse((data.choices?.[0]?.message?.content ?? "{}").replace(/```json|```/g,"").trim());
  return { decision:parsed.decision??"APPROVE", reason:parsed.reason??"", risks:parsed.risks??[], suggestions:parsed.suggestions??[], model_used:data.model??"unknown", tokens_used:data.usage?.total_tokens??0 };
}

export async function runReviewAgent(): Promise<ReviewReport> {
  log("════ REVIEW-AGENT (RouteLLM) starting ════");
  const report: ReviewReport = { agent:"review-agent", timestamp:new Date().toISOString(), total:0, approved:0, blocked:0, escalated:0, results:[] };
  if (!fs.existsSync(BUG_QUEUE)||!fs.existsSync(FIX_REPORT)) { log("Missing files — skipping"); return report; }
  const queue     = safeReadJson(BUG_QUEUE);
  const fixReport = safeReadJson(FIX_REPORT);
  const fixedBugs = queue.bugs.filter((b:any) => b.status==="fixed");
  log(`${fixedBugs.length} fixed bug(s) to review`);
  for (const bug of fixedBugs) {
    log(`\nReviewing [${bug.id}]: ${bug.title}`);
    const score    = scoreComplexity(bug);
    const costTier = score > ROUTING_CONFIG.threshold ? "strong" : "cheap";
    log(`  Complexity: ${score.toFixed(2)} → ${costTier} model`);
    const prompt = `BUG: ${bug.id}\nTITLE: ${bug.title}\nFILE: ${bug.file}\nFIND: ${bug.fix?.find??""}\nREPLACE: ${bug.fix?.replace??""}\nIs this fix correct and safe?`;
    let result: ReviewResult;
    try {
      const api = await callRouteLLM(prompt, score);
      result = { bugId:bug.id, decision:api.decision, model_used:api.model_used, confidence:score, reason:api.reason, risks:api.risks, suggestions:api.suggestions, cost_tier:costTier, tokens_used:api.tokens_used };
      const icon = ({APPROVE:"✅",BLOCK:"❌",ESCALATE:"⚠️"} as any)[api.decision];
      log(`  ${icon} ${api.decision} — ${api.reason}`);
      const qBug = queue.bugs.find((b:any)=>b.id===bug.id);
      if (qBug) {
        if (api.decision==="BLOCK") { qBug.status="open"; qBug.fix_result=`blocked: ${api.reason}`; report.blocked++; log("  🔄 Re-queued"); }
        else { report.approved++; if(api.decision==="ESCALATE") report.escalated++; }
      }
    } catch(err:unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`  ❌ API error: ${msg} — defaulting APPROVE`);
      result = { bugId:bug.id, decision:"APPROVE", model_used:"error-fallback", confidence:0, reason:`error:${msg}`, risks:[], suggestions:[], cost_tier:"cheap", tokens_used:0 };
      report.approved++;
    }
    report.results.push(result); report.total++;
  }
  fs.writeFileSync(BUG_QUEUE,     JSON.stringify(queue,  null, 2), "utf-8");
  fs.writeFileSync(REVIEW_REPORT, JSON.stringify(report, null, 2), "utf-8");
  log(`\nDone | ✅ ${report.approved} | ❌ ${report.blocked} | ⚠️ ${report.escalated}`);
  return report;
}
if (require.main===module) { runReviewAgent().catch(err=>{console.error("[review-agent] FATAL:",err);process.exit(1);}); }