# TTS Edge Function — Mama's Voice Setup Guide

This function proxies ElevenLabs TTS using a cloned voice of Idris's mama (Gavkhar).
The API key never touches the browser — it lives only in Supabase secrets.

---

## Step 1 — Record Mama's Voice (60 seconds)

### Equipment
- Any smartphone (voice memo app is fine)
- Quiet room — no TV, no traffic noise, no echo
- Hold the phone 20–30 cm from mouth

### What to say (read this script aloud, naturally)

> "Hello Idris! Let's count together. One, two, three, four, five.
> Can you say one? One. Very good! Now say two. Two. Wonderful!
> Look at the car! It is a red car. Red car. Can you say car?
> Let's count the fish. One fish, two fish, three fish.
> You are doing so well today. I am so proud of you.
> Now let's learn some colors. Blue, yellow, red, green.
> Blue sky. Yellow star. Red apple. Green leaf.
> Say apple! Apple. Say star! Star.
> One more time — one, two, three, four, five, six, seven, eight, nine, ten.
> Great job! You earned a star today. Mama loves you so much."

### Tips
- Speak at normal, calm pace — the same voice you use with Idris
- Do not whisper, do not shout
- If you make a mistake, pause 2 seconds and continue — the extra audio is fine
- Record in WAV or MP3 format if possible; WebM/M4A also work
- Aim for 60–90 seconds total

---

## Step 2 — Upload to ElevenLabs and Clone the Voice

### 2a. Create an ElevenLabs account
1. Go to elevenlabs.io and sign up (free tier works for testing)
2. For production, use the **Starter** plan or above (required for voice cloning)

### 2b. Clone the voice
1. In the ElevenLabs dashboard, click **Voices** in the left sidebar
2. Click **Add a new voice**
3. Select **Instant Voice Cloning**
4. Fill in:
   - **Name:** `Mama - Gavkhar`
   - **Description:** `Mama's voice for Idris learning app`
5. Click **Upload audio files** and select your recording
6. Tick the consent checkbox confirming you have rights to this voice
7. Click **Add Voice**

ElevenLabs will process the sample in a few seconds.

---

## Step 3 — Get the VOICE_ID

After cloning:

1. Go to **Voices** → find **Mama - Gavkhar** in the list
2. Click the voice to open it
3. Copy the **Voice ID** shown below the voice name
   - It looks like: `21m00Tcm4TlvDq8ikWAM`
4. Keep this ID — you will need it in Step 4

Alternatively, retrieve it via API:

```bash
curl https://api.elevenlabs.io/v1/voices \
  -H "xi-api-key: YOUR_API_KEY" \
  | jq '.voices[] | select(.name == "Mama - Gavkhar") | .voice_id'
```

---

## Step 4 — Deploy to Supabase

### 4a. Prerequisites

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Log in
supabase login

# Link to your project (find project ref in Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF
```

### 4b. Set secrets

```bash
supabase secrets set ELEVENLABS_API_KEY=sk-your-key-here
supabase secrets set ELEVENLABS_VOICE_ID=your-voice-id-here
```

Verify they are set:

```bash
supabase secrets list
```

### 4c. Deploy the function

From the project root:

```bash
supabase functions deploy tts --no-verify-jwt
```

`--no-verify-jwt` allows the iPad app to call the function without a Supabase auth token.
This is safe because the function itself holds no user data — it only proxies audio.

### 4d. Get your function URL

```bash
supabase functions list
```

The URL will be:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/tts
```

### 4e. Update index.html

In `index.html`, find the `TTS_URL` constant and set it:

```javascript
const TTS_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/tts";
```

---

## Step 5 — Test it

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Great job Idris!", "lang": "en"}' \
  --output test-audio.mp3

# Play the file to hear mama's voice
open test-audio.mp3   # macOS
start test-audio.mp3  # Windows
```

Expected: you hear the text spoken in mama's cloned voice.

---

## API Reference

**Endpoint:** `POST /functions/v1/tts`

| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| text  | string | yes      | Text to speak (max ~500 chars recommended) |
| lang  | string | no       | Language hint: `en`, `ru`, `uz`, `tg` (default: `en`) |

**Response:** `audio/mpeg` stream on success, JSON error on failure.

**Error responses:**

| Status | Meaning |
|--------|---------|
| 400    | `text` field missing or empty |
| 405    | Non-POST request |
| 502    | ElevenLabs upstream error (check secrets) |

---

## Troubleshooting

**"502 TTS upstream failed"**
→ Check that `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set correctly:
```bash
supabase secrets list
```

**No audio on iPad Safari**
→ AudioContext requires a user gesture on iOS. Make sure `TTS.speak()` is called
inside a button tap handler, not on page load.

**Voice sounds robotic or wrong**
→ Re-record in a quieter room. 60–90 seconds of clean audio improves quality significantly.
Avoid recordings with background music or TV.

**Quota exceeded**
→ ElevenLabs free tier has ~10,000 characters/month. Starter plan gives 30,000.
Monitor usage at elevenlabs.io/subscription.
