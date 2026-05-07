/**
 * rag-agent.ts
 * Queries Supabase pgvector for similar FIX_PATTERNS before fix-agent runs
 * If similar pattern found -> fix-agent uses it as context -> cheaper + faster + more accurate
 * Author: Farhod Elbekov | idris-learning-app
 */
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL   = process.env.SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY!;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!;
const REPORTS_DIR    = path.resolve(__dirname, "../reports");
const RAG_REPORT     = path.join(REPORTS_DIR, "rag-report.json");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg: string) {
  console.log(`[rag-agent ${new Date().toISOString().substring(11,19)}] ${msg}`);
}

export interface RagResult {
  pattern_id: string;
  title: string;
  content: string;
  category: string;
  similarity: number;
}

export interface RagReport {
  agent: string;
  timestamp: string;
  bug_id: string;
  query: string;
  results_found: number;
  results: RagResult[];
  recommendation: string;
}

// ── Embed query with voyage-ai ───────────────────────────────
async function embedQuery(text: string): Promise<number[]> {
  if (!VOYAGE_API_KEY) {
    log("  ⚠️  No VOYAGE_API_KEY — skipping RAG lookup");
    return [];
  }

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VOYAGE_API_KEY}`
    },
    body: JSON.stringify({
      model: "voyage-3",
      input: [text],
      input_type: "query"
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage AI ${response.status}: ${err}`);
  }

  const data = await response.json() as any;
  return data.data[0].embedding;
}

// ── Search Supabase for similar patterns ────────────────────
async function searchPatterns(
  embedding: number[],
  threshold: number = 0.65,
  count: number = 3
): Promise<RagResult[]> {
  const { data, error } = await supabase.rpc("search_fix_patterns", {
    query_embedding: `[${embedding.join(",")}]`,
    match_threshold: threshold,
    match_count:     count
  });

  if (error) throw new Error(`Supabase search error: ${error.message}`);
  return (data || []) as RagResult[];
}

// ── Build fix context from results ──────────────────────────
function buildRecommendation(results: RagResult[]): string {
  if (results.length === 0) {
    return "No similar patterns found — fix-agent will generate fix from scratch";
  }

  const top = results[0];
  return `Similar pattern found: ${top.pattern_id} (${(top.similarity * 100).toFixed(0)}% match)\n` +
         `Title: ${top.title}\n` +
         `Category: ${top.category}\n` +
         `Apply this pattern as the basis for the fix.`;
}

// ── MAIN ────────────────────────────────────────────────────
export async function runRagAgent(bugId: string, bugDescription: string): Promise<RagReport> {
  log(`=== RAG-AGENT starting for [${bugId}] ===`);

  const report: RagReport = {
    agent: "rag-agent",
    timestamp: new Date().toISOString(),
    bug_id: bugId,
    query: bugDescription,
    results_found: 0,
    results: [],
    recommendation: ""
  };

  try {
    log(`Embedding query: "${bugDescription.substring(0, 60)}..."`);
    const embedding = await embedQuery(bugDescription);

    if (embedding.length === 0) {
      report.recommendation = "RAG skipped — no API key";
      return report;
    }

    log("Searching Supabase pgvector...");
    const results = await searchPatterns(embedding);
    report.results_found = results.length;
    report.results = results;
    report.recommendation = buildRecommendation(results);

    if (results.length > 0) {
      log(`Found ${results.length} similar pattern(s):`);
      results.forEach(r =>
        log(`  ${r.pattern_id} — ${r.title} (${(r.similarity * 100).toFixed(0)}% match)`)
      );
    } else {
      log("No similar patterns found — new bug type");
    }

    log(`Recommendation: ${report.recommendation.split("\n")[0]}`);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`❌ RAG error: ${msg} — proceeding without context`);
    report.recommendation = `RAG error: ${msg}`;
  }

  fs.writeFileSync(RAG_REPORT, JSON.stringify(report, null, 2), "utf-8");
  log(`Report saved -> reports/rag-report.json`);
  return report;
}

if (require.main === module) {
  // Test mode
  const testBug = "match card stretches full viewport on desktop max-width css fix needed";
  runRagAgent("TEST-001", testBug).catch(err => {
    console.error("[rag-agent] FATAL:", err);
    process.exit(1);
  });
}