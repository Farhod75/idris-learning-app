import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const MAMA_VOICE_ID      = Deno.env.get("ELEVENLABS_VOICE_ID")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405 });

  const { text, lang = "en" } = await req.json();

  if (!text || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: "text required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${MAMA_VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key":   ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",   // supports EN, RU, UZ, TG
        voice_settings: {
          stability:         0.75,  // consistent delivery for a child listener
          similarity_boost:  0.85,  // stays close to mama's real voice
          style:             0.0,   // neutral tone, no added emotion
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("ElevenLabs error:", err);
    return new Response(JSON.stringify({ error: "TTS upstream failed", detail: err }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(res.body, {
    headers: { ...CORS, "Content-Type": "audio/mpeg" },
  });
});
