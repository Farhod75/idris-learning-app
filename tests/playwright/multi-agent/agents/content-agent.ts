/**
 * content-agent.ts
 * Extracts hardcoded content from index.html
 * Embeds with voyage-ai + stores in Supabase game_content table
 * Author: Farhod Elbekov | idris-learning-app
 */
import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL   = process.env.SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY!;
const VOYAGE_KEY     = process.env.VOYAGE_API_KEY!;
const PROJECT_ROOT   = path.resolve(__dirname, "../../../");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg: string) {
  console.log(`[content-agent ${new Date().toISOString().substring(11,19)}] ${msg}`);
}

// ── Hardcoded content from index.html ────────────────────────
// This is the content we are MOVING from index.html to Supabase
const GAME_CONTENT = [
  // Matching game — animals
  { word: "кошка",   emoji: "🐱", language: "ru", difficulty: 1, tags: ["animals"] },
  { word: "собака",  emoji: "🐶", language: "ru", difficulty: 1, tags: ["animals"] },
  { word: "птица",   emoji: "🐦", language: "ru", difficulty: 1, tags: ["animals"] },
  { word: "рыба",    emoji: "🐟", language: "ru", difficulty: 1, tags: ["animals"] },
  { word: "корова",  emoji: "🐮", language: "ru", difficulty: 2, tags: ["animals"] },
  { word: "лошадь",  emoji: "🐴", language: "ru", difficulty: 2, tags: ["animals"] },
  // Counting game
  { word: "один",    emoji: "1️⃣", language: "ru", difficulty: 1, tags: ["numbers"] },
  { word: "два",     emoji: "2️⃣", language: "ru", difficulty: 1, tags: ["numbers"] },
  { word: "три",     emoji: "3️⃣", language: "ru", difficulty: 1, tags: ["numbers"] },
  { word: "четыре",  emoji: "4️⃣", language: "ru", difficulty: 2, tags: ["numbers"] },
  { word: "пять",    emoji: "5️⃣", language: "ru", difficulty: 2, tags: ["numbers"] },
  // Family game
  { word: "мама",    emoji: "👩", language: "ru", difficulty: 1, tags: ["family"] },
  { word: "папа",    emoji: "👨", language: "ru", difficulty: 1, tags: ["family"] },
  { word: "бабушка", emoji: "👵", language: "ru", difficulty: 2, tags: ["family"] },
  { word: "дедушка", emoji: "👴", language: "ru", difficulty: 2, tags: ["family"] },
  // Uzbek content
  { word: "mushuk",  emoji: "🐱", language: "uz", difficulty: 1, tags: ["animals"] },
  { word: "it",      emoji: "🐶", language: "uz", difficulty: 1, tags: ["animals"] },
  { word: "bir",     emoji: "1️⃣", language: "uz", difficulty: 1, tags: ["numbers"] },
  { word: "ikki",    emoji: "2️⃣", language: "uz", difficulty: 1, tags: ["numbers"] },
  { word: "ona",     emoji: "👩", language: "uz", difficulty: 1, tags: ["family"] },
  { word: "ota",     emoji: "👨", language: "uz", difficulty: 1, tags: ["family"] },
];

// ── Embed with voyage-ai ─────────────────────────────────────
async function embedTexts(texts: string[]): Promise<number[][]> {
  const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${VOYAGE_KEY}`
    },
    body: JSON.stringify({ model: "voyage-3", input: texts, input_type: "document" })
  });
  if (!resp.ok) throw new Error(`Voyage AI ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as any;
  return data.data.map((d: any) => d.embedding);
}

// ── Get category ID ──────────────────────────────────────────
async function getCategoryId(tag: string): Promise<string | null> {
  const gameTypeMap: Record<string, string> = {
    animals: "matching",
    numbers: "counting",
    family:  "family",
    colors:  "reading",
    food:    "matching"
  };
  const gameType = gameTypeMap[tag] || "matching";
  const { data } = await supabase
    .from("content_categories")
    .select("id")
    .eq("game_type", gameType)
    .single();
  return data?.id || null;
}

// ── MAIN ────────────────────────────────────────────────────
async function main() {
  log("=== CONTENT-AGENT starting ===");
  log(`Seeding ${GAME_CONTENT.length} content items into Supabase`);

  const BATCH = 8;
  let seeded = 0;

  for (let i = 0; i < GAME_CONTENT.length; i += BATCH) {
    const batch = GAME_CONTENT.slice(i, i + BATCH);
    const texts = batch.map(c => `${c.word} ${c.emoji} ${c.tags.join(" ")}`);

    log(`Embedding batch ${Math.floor(i/BATCH)+1}...`);
    const embeddings = await embedTexts(texts);

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const categoryId = await getCategoryId(item.tags[0]);

      const { error } = await supabase.from("game_content").upsert({
        category_id:  categoryId,
        language:     item.language,
        word:         item.word,
        emoji:        item.emoji,
        difficulty:   item.difficulty,
        tags:         item.tags,
        embedding:    `[${embeddings[j].join(",")}]`,
        approved:     true,
        submitted_by: "system"
      }, { onConflict: "word,language" });

      if (error) log(`  ❌ ${item.word}: ${error.message}`);
      else { log(`  ✅ ${item.language}: ${item.emoji} ${item.word}`); seeded++; }
    }

    if (i + BATCH < GAME_CONTENT.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  log(`\nDone! Seeded ${seeded}/${GAME_CONTENT.length} items`);
  log("Table: game_content | Supabase dashboard to verify");
}

main().catch(err => { console.error("[content-agent] FATAL:", err); process.exit(1); });