# 👦 Idris Profile — App Personalization File
# Version: 2.0 | Last updated: 2026-05-01
# Source: Questionnaire filled by Gavkhar (Idris's mom)
# Purpose: AI personalization data for Idriszhon's learning app

---

## 🧒 Basic Info

```yaml
name: "Idriszhon"
nickname: "Idris"
age: 7
avatar_emoji: "🦁"
primary_language: "en"        # English — confirmed by mom
home_languages:
  - "en"   # English — dominant, used with mama and papa
  - "tg"   # Tajik — used with grandparents
  - "uz"   # Uzbek — used with grandparents
diagnosis: "ASD"
app_ui_language: "en"
main_goal: "understanding"    # Mom's primary wish: понимание
```

---

## 🎨 Colors

```yaml
favorite_colors:
  - "yellow"    # 1st favorite — use for rewards and highlights
  - "red"       # 2nd favorite
  - "blue"      # 3rd favorite
  - "green"     # 4th favorite

favorite_toy_colors: ["yellow", "red", "blue"]
disliked_colors: []           # Mom said: all colors are fine

ui_strategy:
  - Use yellow for star rewards and celebrations
  - Use blue for counting games
  - Use red for correct answer highlights
  - Bright colors only — he prefers vivid tones
```

---

## 📺 YouTube Cartoons

```yaml
watches_daily:
  - name: "Super Simple Songs"
    language: "en"
    youtube: true
    use_for: ["songs", "rewards", "sing-along games"]

  - name: "Lucas and Friends"
    language: "en"
    youtube: true
    use_for: ["rewards", "family challenges"]

  - name: "Ms. Rachel"
    language: "en"
    youtube: true
    use_for: ["speech development", "rewards", "speaking games"]
    note: "Clinically excellent for ASD speech — prioritize this"

watches_sometimes:
  - name: "Tom and Jerry"
    language: "en"
    youtube: true
    use_for: ["physical reward animations"]

NEVER_show:
  - name: "Cocomelon"
    reason: "Mom explicitly said NO"
    action: "Block completely — never show in rewards or content"

content_preference:
  - "Must have numbers, alphabet, or shapes"
  - "Refuses cartoons without educational content"
  - "Strong preference for structured learning content"
```

---

## 🎵 Music & Songs

```yaml
favorite_songs:
  - "The Wheels on the Bus"
  - "One Little Finger"
  - "If You're Happy and You Know It"

sings_himself: true
likes_being_sung_to: true

dislikes_music:
  - "Unfamiliar songs"
  - "Loud or fast music"

music_strategy:
  - Always use known songs first
  - "If You're Happy" → perfect for physical activity rewards (clapping!)
  - "One Little Finger" → perfect for body parts learning
  - Introduce new songs slowly, paired with familiar ones
```

---

## 🐾 Animals

```yaml
favorite_animals:
  - name: "fish"    emoji: "🐟"
  - name: "cat"     emoji: "🐱"

fears: []           # Mom unsure — monitor during sessions
has_pet: false
```

---

## 🍎 Food

```yaml
favorite_foods:
  - name: "blueberry"   emoji: "🫐"
  - name: "apple"       emoji: "🍎"
  - name: "mandarin"    emoji: "🍊"
  - name: "grapes"      emoji: "🍇"

happy_trigger: "something sweet"

does_not_eat:
  - "tomato"    emoji: "🍅"
  - "cucumber"  emoji: "🥒"
  - "vegetables"

food_strategy:
  - Use fruits in counting games — he recognizes and likes them
  - Never show tomato or cucumber as reward images
  - Sweet/fruit theme for celebration screens
```

---

## 🚗 Transport & Toys

```yaml
favorite_transport:
  - "cars"    emoji: "🚗"    # CONFIRMED — not trains (earlier assumption was wrong)

favorite_toys:
  - "number toys"
  - "alphabet toys"
  - "puzzles"

favorite_games:
  - "colorful toy games"
  - "pop-it"       # sensory toy
  - "donuts"       # shape stacking toy

toy_strategy:
  - Use car emojis for counting games (not trains)
  - Numbers and alphabet are his comfort zone — start here
  - Puzzle format works well for matching games
  - Pop-it inspires tap/press physical activities
```

---

## 🌍 Languages

```yaml
language_map:
  mama:      "en"    # English — PRIMARY confirmed
  papa:      "en"    # English
  babushka:  "tg"    # Tajik + Uzbek
  deda:      "tg"    # Tajik + Uzbek
  siblings:  null    # Does not speak with siblings yet

dominant_language: "en"
speech_status: "developing"

words_he_says:
  - category: "numbers"    examples: ["one", "two", "three"]
  - category: "alphabet"   examples: ["A", "B", "C"]
  - category: "shapes"     examples: ["circle", "square"]

speech_strategy:
  - English first in ALL games
  - Tajik/Uzbek only when grandparents are selected
  - Celebrate ANY word spoken — even single letters
  - Numbers, alphabet, shapes are his comfort zone — start here
  - Expand vocabulary gradually from known words
```

---

## 🧠 Behavior & Sensory Profile

```yaml
session_length_minutes: 10     # Max 10-15 min confirmed
best_time_of_day: "morning"    # Confirmed by mom

sound_sensitivity:
  loud_sudden_sounds: "dislikes"
  music_background: "low"
  reward_sounds: "gentle"
  known_songs_only: true        # CRITICAL — only familiar music

visual_sensitivity:
  bright_flashing: "likes"      # Confirmed: нравится!
  lots_of_pictures: true        # Mom said: много картинок
  lots_of_sounds: true          # Mom said: и звуков

learning_style:
  visual: true                  # confirmed
  auditory: true                # confirmed
  tactile: true                 # confirmed
  verbal: true                  # confirmed
  note: "ALL four styles confirmed — use multi-modal approach always"

calming_strategy: "hugging"     # use hug emoji in calm-down screen
happiness_trigger: "sweet food" # use fruit/sweet reward themes
praise_response: "loves it"     # always praise every attempt
```

---

## 👨‍👩‍👧‍👦 Family

```yaml
family:
  - id: "mama"
    name: "Мама (Gavkhar)"
    emoji: "👩"
    language: "en"
    role: "primary_caregiver"
    plays_most: true
    favorite_for_idris: true
    ritual: "hugs before sleep"

  - id: "papa"
    name: "Папа"
    emoji: "👨"
    language: "en"

  - id: "deda"
    name: "Дедушка (Farhod)"
    emoji: "👴"
    language: "tg"

  - id: "babushka"
    name: "Бабушка"
    emoji: "👵"
    language: "tg"

  - id: "siblings"
    name: "Сестра/Брат"
    emoji: "👧"
    language: "en"
    note: "No verbal communication yet — use gesture and picture games only"
```

---

## 🎯 Learning Goals

```yaml
primary_goal: "understanding"       # понимание — mom's #1 priority
secondary_goals:
  - "speaking words"
  - "counting to 10"
  - "reading letters"
  - "naming colors"
  - "communicating with family"

learning_priority_order:
  1: "understanding context"
  2: "speaking words (numbers, alphabet, shapes first)"
  3: "counting 1-10"
  4: "alphabet recognition"
  5: "shapes"
  6: "colors"
  7: "family communication"
```

---

## 🎁 Reward System

```yaml
reward_types:
  video:
    - "Super Simple Songs clip"
    - "Ms. Rachel clip"           # best for speech development
    - "Lucas and Friends clip"
    - "Tom and Jerry clip"

  songs:
    - "The Wheels on the Bus"
    - "One Little Finger"
    - "If You're Happy and You Know It"

  animations:
    - "yellow stars explosion"
    - "cars racing"
    - "fruit basket (blueberries, apples, grapes)"

  physical:
    - "Clap 3 times! 👏"          # ties to If You're Happy song
    - "Jump up! ⬆️"
    - "Touch your nose! 👃"        # ties to One Little Finger
    - "Touch your toes! 🦶"
    - "Give mama a hug! 🤗"        # his calming trigger
    - "Sit up straight! 🧘"

NEVER_use_as_reward:
  - "Cocomelon"                    # explicitly banned by mom
  - "unfamiliar songs"
  - "loud sudden sounds"
  - "tomato or cucumber images"
```

---

## 📊 Progress Tracking

```yaml
skill_scores:
  counting:         0    # baseline
  vocabulary_en:    0    # baseline
  alphabet:         0    # baseline — knows some already
  shapes:           0    # baseline — knows some already
  color_naming:     0    # baseline
  family_interact:  0    # baseline
  speech_clarity:   0    # baseline
  last_updated: "2026-05-01"

active_tasks: []           # filled after doctor approval
doctor_instructions: []    # filled after first consultation
doctor_name: ""

milestones:
  - date: "2026-05-01"
    milestone: "Profile created from Gavkhar's questionnaire"
    notes: "Baseline established. Goals: understanding, speaking, numbers."
```
