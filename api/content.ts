/**
 * api/content.ts
 * Claude retrieves age-appropriate content for Idriszhon dynamically
 * Called from index.html game screens
 * Author: Farhod Elbekov | idris-learning-app
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function getGameContent(
  gameType: string,
  language: string = "ru",
  childAge: number = 5,
  count: number = 6
) {
  const { data, error } = await supabase
    .from("game_content")
    .select("id, word, emoji, difficulty, tags")
    .eq("language", language)
    .eq("approved", true)
    .lte("difficulty", Math.ceil(childAge / 2))
    .contains("tags", [gameType === "matching" ? "animals" : gameType])
    .limit(count);

  if (error) throw new Error(`Content fetch error: ${error.message}`);
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