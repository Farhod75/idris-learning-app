// api/content-handler.ts
// Separate Vercel handler — avoids export conflicts with content.ts
import { createClient } from "@supabase/supabase-js";

const CATEGORY_IDS: Record<string, string> = {
  Numbers: "91cc1b66-38d8-4ad1-9bed-50d936dc34fb",
  Animals: "f4088b10-9a64-4cd0-aec5-2909b8a455c0",
  Colors:  "18a944eb-b101-4a76-87fd-e7f93c81f3e2",
  Family:  "cf1bfe16-0afb-4399-8ea8-cbe518730d65",
  Food:    "d2553184-46c3-4afd-b98e-fc251d9b7989",
};

const GAME_TO_CATEGORY: Record<string, string> = {
  counting: "Numbers",
  matching: "Animals",
  speaking: "Animals",
  family:   "Family",
  colors:   "Colors",
};

export default async function handler(req: any, res: any) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const gameType = req.query?.type  || "counting";
  const language = req.query?.lang  || "ru";
  const age      = parseInt(req.query?.age   || "7");
  const count    = parseInt(req.query?.count || "6");

  const categoryName = GAME_TO_CATEGORY[gameType];
  const categoryId   = categoryName ? CATEGORY_IDS[categoryName] : null;

  try {
    let query = supabase
      .from("game_content")
      .select("id, word, emoji, difficulty, tags, language")
      .eq("language", language)
      .eq("approved", true)
      .lte("difficulty", Math.ceil(age / 2))
      .limit(count);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ items: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message, items: [] });
  }
}