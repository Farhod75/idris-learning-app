/**
 * embed-fix-patterns.ts
 * Reads FIX_PATTERNS.md -> chunks by pattern (FP-XXX) -> embeds with voyage-ai -> stores in Supabase
 * Run once: npx ts-node embed-fix-patterns.ts
 * Re-run anytime FIX_PATTERNS.md is updated
 */
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = process.env.SUPABASE_URL!;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY!;
const VOYAGE_API_KEY   = process.env.VOYAGE_API_KEY!;
const FIX_PATTERNS_PATH = path.resolve(__dirname, "../../../../FIX_PATTERNS.md");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg: string) {
  console.log(`[embed ${new Date().toISOString().substring(11,19)}] ${msg}`);
}

// ── Parse FIX_PATTERNS.md into individual patterns ──────────
interface Pattern {
  pattern_id: string;
  title: string;
  content: string;
  category: string;
  severity: string;
  file_targets: string[];
}

function parseFixPatterns(md: string): Pattern[] {
  const patterns: Pattern[] = [];
  // Split on ## FP-XXX headers
  const sections = md.split(/\n(?=## FP-)/);

  for (const section of sections) {
    const match = section.match(/^## (FP-\d+) — (.+)/);
    if (!match) continue;

    const pattern_id = match[1];
    const title      = match[2].trim();
    const content    = section.trim();

    // Detect category from content
    let category = "general";
    if (/css|max-width|margin|padding|display/i.test(content)) category = "css";
    else if (/powershell|system\.io|out-file|bom/i.test(content)) category = "powershell";
    else if (/playwright|selector|timeout|locator/i.test(content)) category = "playwright";
    else if (/typescript|import|compile|ts-node/i.test(content)) category = "typescript";
    else if (/git|commit|push|github/i.test(content)) category = "git";

    // Detect severity
    let severity = "medium";
    if (/crash|fatal|cannot|failed|broken/i.test(content)) severity = "high";
    else if (/warning|skip|already/i.test(content)) severity = "low";

    // Detect file targets
    const file_targets: string[] = [];
    if (/index\.html/i.test(content)) file_targets.push("index.html");
    if (/\.ts/i.test(content)) file_targets.push("*.ts");
    if (/\.json/i.test(content)) file_targets.push("*.json");
    if (/orchestrator/i.test(content)) file_targets.push("orchestrator-with-fixer.ts");

    patterns.push({ pattern_id, title, content, category, severity, file_targets });
  }

  return patterns;
}

// ── Embed with voyage-ai ─────────────────────────────────────
async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VOYAGE_API_KEY}`
    },
    body: JSON.stringify({
      model: "voyage-3",
      input: texts,
      input_type: "document"
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Voyage AI error ${response.status}: ${err}`);
  }

  const data = await response.json() as any;
  return data.data.map((d: any) => d.embedding);
}

// ── Store in Supabase ────────────────────────────────────────
async function upsertPattern(pattern: Pattern, embedding: number[]): Promise<void> {
  const { error } = await supabase
    .from("fix_patterns_vectors")
    .upsert({
      pattern_id:   pattern.pattern_id,
      title:        pattern.title,
      content:      pattern.content,
      embedding:    `[${embedding.join(",")}]`,
      category:     pattern.category,
      severity:     pattern.severity,
      file_targets: pattern.file_targets,
      updated_at:   new Date().toISOString()
    }, { onConflict: "pattern_id" });

  if (error) throw new Error(`Supabase upsert error: ${error.message}`);
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  log("=== EMBED-FIX-PATTERNS starting ===");

  if (!fs.existsSync(FIX_PATTERNS_PATH)) {
    log(`ERROR: FIX_PATTERNS.md not found at ${FIX_PATTERNS_PATH}`);
    process.exit(1);
  }

  const md       = fs.readFileSync(FIX_PATTERNS_PATH, "utf-8").replace(/^\uFEFF/, "");
  const patterns = parseFixPatterns(md);
  log(`Found ${patterns.length} patterns to embed`);

  // Embed in batches of 8 (voyage-ai rate limit friendly)
  const BATCH = 8;
  let embedded = 0;

  for (let i = 0; i < patterns.length; i += BATCH) {
    const batch    = patterns.slice(i, i + BATCH);
    const texts    = batch.map(p => `${p.title}\n\n${p.content}`);
    const embeddings = await embedTexts(texts);

    for (let j = 0; j < batch.length; j++) {
      await upsertPattern(batch[j], embeddings[j]);
      log(`  ✅ ${batch[j].pattern_id}: ${batch[j].title} [${batch[j].category}]`);
      embedded++;
    }

    // Small delay between batches
    if (i + BATCH < patterns.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  log(`\nDone! Embedded ${embedded}/${patterns.length} patterns into Supabase`);
  log("Table: fix_patterns_vectors");
  log("Run rag-agent.ts to query them");
}

main().catch(err => { console.error("[embed] FATAL:", err); process.exit(1); });