/**
 * api/content.ts
 * Claude retrieves age-appropriate content for Idriszhon dynamically
 * Called from index.html game screens
 * Author: Farhod Elbekov | idris-learning-app
 *
 * FIX (2026-05-07):
 *   - gameType "counting" now maps to tag "numbers" (matches seeded data)
 *   - gameType "matching" now maps to category_id join (not tags)
 *   - Added category-based query as primary filter (UUID FK join)
 *   - Tags used as fallback only
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── Confirmed category UUIDs from Supabase ────────────────────
// SELECT id, name FROM content_categories;
const CATEGORY_IDS: Record<string, string> = {
  Numbers: "91cc1b66-38d8-4ad1-9bed-50d936dc34fb",
  Animals: "f4088b10-9a64-4cd0-aec5-2909b8a455c0",
  Colors:  "18a944eb-b101-4a76-87fd-e7f93c81f3e2",
  Family:  "cf1bfe16-0afb-4399-8ea8-cbe518730d65",
  Food:    "d2553184-46c3-4afd-b98e-fc251d9b7989",
};

// ── Map gameType → category name ──────────────────────────────
// FIX: "counting" → "Numbers", "matching" → "Animals"
const GAME_TYPE_TO_CATEGORY: Record<string, string> = {
  counting: "Numbers",   // ← was searching tag "counting", DB has tag "numbers"
  matching: "Animals",   // ← was searching tag "animals", now uses UUID FK
  speaking: "Animals",
  family:   "Family",
  colors:   "Colors",
  food:     "Food",
};

export async function getGameContent(
  gameType: string,
  language: string = "en",
  childAge: number = 7,
  count: number = 6
) {
  // Resolve category UUID from gameType
  const categoryName = GAME_TYPE_TO_CATEGORY[gameType];
  const categoryId   = categoryName ? CATEGORY_IDS[categoryName] : null;

  let query = supabase
    .from("game_content")
    .select("id, word, emoji, difficulty, tags, language")
    .eq("language", language)
    .eq("approved", true)
    .lte("difficulty", Math.ceil(childAge / 2))
    .limit(count);

  if (categoryId) {
    // ✅ PRIMARY: filter by category_id (UUID FK — always correct)
    query = query.eq("category_id", categoryId);
  } else {
    // Fallback: filter by tag if no category mapping found
    console.warn(`[content] No category mapping for gameType="${gameType}" — using tag fallback`);
    query = query.contains("tags", [gameType]);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Content fetch error: ${error.message}`);

  if (!data || data.length === 0) {
    console.warn(
      `[content] 0 items for gameType=${gameType} lang=${language} age=${childAge}`,
      `\n  → category_id=${categoryId}`,
      `\n  → Check: items approved? Language "${language}" seeded?`
    );
  }

  return data || [];
}

export async function getChildProfile(childName: string = "Idriszhon") {
  const { data } = await supabase
    .from("child_profiles")
    .select("*")
    .eq("name", childName)
    .single();
  return data;
}

export async function submitContent(submission: {
  game_type: string;
  language: string;
  word: string;
  emoji: string;
  submitted_by: string;
}) {
  const { error } = await supabase
    .from("content_submissions")
    .insert({ ...submission, status: "pending" });
  if (error) throw new Error(`Submission error: ${error.message}`);
  return { success: true };
}

// ── Vercel Edge Function handler ─────────────────────────────
// Called by index.html via: fetch('/api/content?type=counting&lang=ru')
export default async function handler(req: any, res: any) {
  const gameType = req.query.type || 'counting';
  const language = req.query.lang || 'ru';
  const age      = parseInt(req.query.age || '7');
  const count    = parseInt(req.query.count || '6');

  try {
    const data = await getGameContent(gameType, language, age, count);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ items: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}