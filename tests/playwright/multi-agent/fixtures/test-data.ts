/**
 * Test fixtures for multi-agent QA suite.
 * localStorage key: 'app-profiles' (confirmed from index.html:1028)
 * Profile shape: {id, name, age, uiLang, homeLangs, interests, family, doctor, avatar, stars, createdAt}
 */

export interface AppProfile {
  id: number;
  name: string;
  age: number;
  uiLang: string;
  homeLangs: string[];
  interests: number[]; // indices into LANGS_CFG[lang].interests[]
  family: number[];    // indices into LANGS_CFG[lang].fam_members[]
  doctor: string;
  avatar: string;
  stars: number;
  createdAt: string;
}

/**
 * Language codes supported by the app (LANG_LIST in index.html:819).
 * Each has a BCP-47 tag used by the TTS engine.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English',    bcp47: 'en-US', dir: 'ltr', flag: '🇬🇧',
    charPattern: /[a-zA-Z]/,
    wordSample: 'apple' },
  { code: 'ru', label: 'Русский',    bcp47: 'ru-RU', dir: 'ltr', flag: '🇷🇺',
    charPattern: /[\u0400-\u04FF]/,
    wordSample: 'яблоко' },
  { code: 'uz', label: "O'zbek",     bcp47: 'uz-UZ', dir: 'ltr', flag: '🇺🇿',
    charPattern: /[a-zA-Z']/,
    wordSample: 'olma' },
  { code: 'tg', label: 'Тоҷикӣ',    bcp47: 'tg-TG', dir: 'ltr', flag: '🇹🇯',
    charPattern: /[\u0400-\u04FF]/,
    wordSample: 'себ' },
  { code: 'ar', label: 'العربية',   bcp47: 'ar-SA', dir: 'rtl', flag: '🇸🇦',
    charPattern: /[\u0600-\u06FF]/,
    wordSample: 'تفاحة' },
  { code: 'es', label: 'Español',    bcp47: 'es-ES', dir: 'ltr', flag: '🇪🇸',
    charPattern: /[a-záéíóúüñ]/i,
    wordSample: 'manzana' },
  { code: 'fr', label: 'Français',   bcp47: 'fr-FR', dir: 'ltr', flag: '🇫🇷',
    charPattern: /[a-zàâçéèêëîïôùûüÿæœ]/i,
    wordSample: 'pomme' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

/** Build a pre-populated test profile that bypasses onboarding. */
export function buildTestProfile(uiLang: LangCode = 'en'): AppProfile {
  return {
    id: 1000000,
    name: 'Idris',
    age: 7,
    uiLang,
    homeLangs: ['en', 'ru', 'uz', 'tg'],
    interests: [1, 10], // dinos (1), trains (10) — Idris's known interests
    family: [0, 1, 2],  // mom (0), dad (1), grandfather (2)
    doctor: 'Dr. Test',
    avatar: '🚂',
    stars: 5,
    createdAt: new Date().toISOString(),
  };
}

/** Serialize profile into the localStorage value the app expects. */
export function profileToLocalStorage(profile: AppProfile): string {
  return JSON.stringify([profile]);
}

/** Minimum touch target size per CLAUDE.md ASD override (72px). */
export const MIN_TOUCH_TARGET_PX = 72;

/** QA Judge scoring thresholds per QA_STANDARDS.md. */
export const SCORE_THRESHOLDS = {
  pass: 0.7,
  warn: 0.4,
} as const;

/** Game types and their expected DOM element IDs. */
export const GAME_SCREENS = {
  count:  { screenId: 'game-count',  trigger: 'count' },
  speak:  { screenId: 'game-speak',  trigger: 'speak' },
  match:  { screenId: 'game-match',  trigger: 'match' },
  family: { screenId: 'game-family', trigger: 'family' },
  aac:    { screenId: 'game-aac',    trigger: 'aac' },
} as const;
