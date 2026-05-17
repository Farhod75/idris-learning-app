// api/videos.ts — Reward videos endpoint
// GET /api/videos?task=counting&lang=en&age=5
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  const task = req.query?.task || 'any';
  const lang = req.query?.lang || 'en';
  const age  = parseInt(req.query?.age || '5');

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { data, error } = await supabase
    .from('reward_videos')
    .select('id, title, youtube_id, thumbnail_url, duration_seconds, task_type')
    .eq('approved', true)
    .lte('age_min', age)
    .gte('age_max', age)
    .or(`task_type.eq.${task},task_type.eq.any`)
    .in('language', [lang, 'en'])
    .limit(6);

  if (error) return res.status(500).json({ videos: [], error: error.message });
  res.status(200).json({ videos: data || [] });
}