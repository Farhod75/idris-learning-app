# 👦 Idris Profile — App Personalization File
# Version: 1.0 | Last updated: 2026-05-01
# Purpose: AI personalization data for Idriszhon's learning app
# HOW TO USE: Update this file as Idris grows and changes.
#             The app reads this file to customize all content.

---

## 🧒 Basic Info

```yaml
name: "Idriszhon"
nickname: "Idris"
age: 7
avatar_emoji: "🦁"         # His chosen animal icon
primary_language: "en"     # English — dominant input from cartoons
home_languages:
  - "ru"  # Russian
  - "uz"  # Uzbek
  - "tg"  # Tajik
  - "en"  # English
diagnosis: "ASD"
app_ui_language: "en"      # App interface should be in English
```

---

## ❤️ Things Idris LOVES (use these for rewards & game content)

### 🚂 Trains (TOP INTEREST — use for counting, matching, rewards)
- Steam trains
- Electric trains
- Thomas the Tank Engine characters
- Railway stations, tracks, tunnels
- Sound of train whistle
- **Use**: Count train cars, match train types, reward = train animation

### 🦕 Dinosaurs (2nd TOP INTEREST)
- T-Rex, Brachiosaurus, Triceratops, Velociraptor
- Fossil digging theme
- Dinosaur roar sounds
- **Use**: Match dinosaur names in 5 languages, "what dinosaur am I?" game

### 🎨 Drawing & Colors
- Loves to draw
- Favorite colors: [ ] — *fill in when you find out*
- **Use**: Coloring mini-games, "what color is this?" in all languages

### 🎵 Music
- Enjoys listening to music
- Favorite songs: [ ] — *fill in*
- **Use**: Rhythm games, sing-along challenges with family

### 🌿 Nature & Animals (add specifics below)
- Favorite animals: [ ] — *fill in*
- **Use**: Animal sound matching game, "what sound does this animal make?"

---

## 🎬 YouTube Cartoons He Watches

### ✅ Watches & Enjoys
| Cartoon | Language | Channel | Notes |
|---------|----------|---------|-------|
| Digimon (Цифрятня) | English | YouTube | Very engaged |
| Маша и Медведь | Russian | YouTube | Familiar comfort show |
| Синий Трактор | Russian | YouTube | Likes vehicles |
| [ add more ] | | | |

### ❌ Does NOT watch / Doesn't like
| Cartoon | Reason |
|---------|--------|
| [ fill in ] | [ fill in ] |

### 🎯 App Strategy with cartoons:
- Use Digimon characters as reward animations (English)
- Use Маша и Медведь scenarios for Russian language games
- Синий Трактор → vehicle counting games

---

## 🎨 Color Preferences

```yaml
# Fill in as you observe
favorite_colors: []        # e.g. ["blue", "green", "red"]
disliked_colors: []        # e.g. ["bright yellow", "flashing red"]
ui_color_theme: "warm"    # warm / cool / neutral — observe reaction
avoid_flashing: true       # WCAG 2.1 — no strobing effects
```

---

## 🔊 Sensory Profile (Critical for autism app design)

```yaml
sound_sensitivity:
  loud_sudden_sounds: "avoid"     # No surprise loud sounds
  music_background: "low"         # Keep background music soft
  reward_sounds: "gentle"         # Soft chime, not fanfare
  
visual_sensitivity:
  bright_flashing: "avoid"        # Never flash animations
  high_contrast: "okay"           # He can handle contrast
  moving_backgrounds: "minimal"   # Keep backgrounds calm

touch_sensitivity:
  haptic_feedback: "gentle"       # Soft vibration only
  large_touch_targets: true       # Minimum 72px buttons
  
preferred_pace: "self-directed"  # He sets the speed, no timers
```

---

## 👨‍👩‍👧‍👦 Family Members

```yaml
family:
  - id: "mama"
    name: "Мама"
    emoji: "👩"
    language: "uz"           # Primary language with Idris
    
  - id: "papa"
    name: "Папа"
    emoji: "👨"
    language: "uz"
    
  - id: "deda"
    name: "Дедушка"
    emoji: "👴"
    language: "tg"           # Update with actual language
    
  - id: "babushka"
    name: "Бабушка"
    emoji: "👵"
    language: "ru"
    
  - id: "sestra"
    name: "Сестра"
    emoji: "👧"
    language: "ru"
    
  - id: "brat"
    name: "Брат"
    emoji: "👦"
    language: "en"           # Update with actual language
```

---

## 🎮 Game Preferences (observe and fill in)

```yaml
enjoys:
  - matching_games: true
  - counting: true
  - music_games: []         # fill in
  - coloring: true
  
needs_more_practice:
  - speaking: []            # fill in
  - writing: []             # fill in
  
session_length_minutes: 10  # Start short, increase if engaged
best_time_of_day: ""        # e.g. "morning" "after lunch"
needs_break_every_minutes: 5
```

---

## 📈 Progress Tracking

```yaml
stars_earned: 12
games_completed: 5
days_streak: 3
milestones:
  - date: "2026-05-01"
    achievement: "First app session"
    notes: "Played counting and matching"
```

---

## 📝 Notes for Family & Therapist

```
DATE | OBSERVATION | BY WHOM
-----|-------------|--------
2026-05-01 | First session with app | Grandfather
[ add observations here ]
```

---

## 🔄 How to Update This File

**Add a cartoon**: Add a row to the YouTube table above
**Add a favorite**: Add to the relevant ❤️ section
**Update colors**: Fill in `favorite_colors` array
**Log a session**: Add a row to Progress Tracking
**Note a reaction**: Add to Notes table at bottom
