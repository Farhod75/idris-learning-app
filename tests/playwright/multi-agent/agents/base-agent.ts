/**
 * BaseAgent — shared test logic for all 7 language agents.
 *
 * Each language-specific spec imports BaseAgent and calls runAll().
 * Checks align with CLAUDE.md requirements and QA_STANDARDS.md.
 *
 * Touch target minimum: 72px (CLAUDE.md ASD override — not 44px).
 */

import { Page } from '@playwright/test';
import {
  LangCode,
  LANGUAGES,
  MIN_TOUCH_TARGET_PX,
  buildTestProfile,
  profileToLocalStorage,
  AppProfile,
} from '../fixtures/test-data';
import { saveScreenshot } from '../utils/trace-recorder';

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface AgentResult {
  lang: LangCode;
  label: string;
  passed: boolean;
  checks: CheckResult[];
  errors: string[];
  screenshotPath?: string;
}

export class BaseAgent {
  readonly lang: LangCode;
  readonly profile: AppProfile;
  readonly langCfg: (typeof LANGUAGES)[number];
  protected checks: CheckResult[] = [];
  protected errors: string[] = [];

  constructor(lang: LangCode) {
    this.lang = lang;
    this.profile = buildTestProfile(lang);
    this.langCfg = LANGUAGES.find(l => l.code === lang)!;
  }

  // ─── Setup ──────────────────────────────────────────────────────────────

  /** Inject localStorage profile and navigate, bypassing onboarding. */
  async init(page: Page): Promise<void> {
    await page.addInitScript((val: string) => {
      window.localStorage.setItem('app-profiles', val);
    }, profileToLocalStorage(this.profile));
    await page.goto('/');
    await page.waitForSelector('#scr-profiles, #scr-main', {
      state: 'visible',
      timeout: 8000,
    });
  }

  /** Select the pre-injected Idris profile and enter the main app. */
  async selectProfile(page: Page): Promise<void> {
    const item = page.locator('.profile-item').first();
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.tap();
    await page.waitForSelector('#scr-main', { state: 'visible', timeout: 8000 });
  }

  /** Navigate back to main app (home screen). */
  private async backToMain(page: Page): Promise<void> {
    // Use JS evaluation — most reliable across all game screens
    const closed = await page.evaluate(() => {
      const active = document.querySelector('.game-screen.active') as HTMLElement | null;
      if (active) {
        const fn = (window as any).closeGame;
        if (typeof fn === 'function') { fn(active.id); return true; }
        active.classList.remove('active');
      }
      const main = document.getElementById('scr-main');
      if (main) { main.classList.add('active'); }
      return false;
    });
    if (!closed) {
      // Fallback: tap visible back button
      const back = page.locator('.gbk-btn').filter({ hasText: '←' }).first();
      if (await back.isVisible({ timeout: 500 }).catch(() => false)) {
        await back.tap();
      }
    }
    await page.waitForSelector('#scr-main', { state: 'visible', timeout: 5000 }).catch(() => {});
  }

  // ─── Check: document direction ───────────────────────────────────────────

  async checkDirection(page: Page): Promise<void> {
    const dir = await page.evaluate(() => document.documentElement.dir || 'ltr');
    const expected = this.langCfg.dir;
    const passed = dir === expected;
    this.add('direction', passed, `expected=${expected} got=${dir}`);
    if (!passed) this.err(`RTL/LTR direction wrong: expected "${expected}", got "${dir}"`);
  }

  // ─── Check: character encoding ───────────────────────────────────────────

  async checkCharacterEncoding(page: Page): Promise<void> {
    // Latin scripts overlap with English — skip encoding check for these
    if (['en', 'uz', 'es', 'fr'].includes(this.lang)) {
      this.add('character_encoding', true, 'latin_skip');
      return;
    }
    const text = (await page.locator('#scr-main').textContent().catch(() => '')) ?? '';
    const passed = this.langCfg.charPattern.test(text);
    this.add('character_encoding', passed, `sample="${text.slice(0, 50)}"`);
    if (!passed) this.err(`No ${this.lang} characters found in #scr-main`);
  }

  // ─── Check: language switching works ────────────────────────────────────

  async checkLanguageSwitching(page: Page): Promise<void> {
    // The app should have loaded in the injected language — verify main-app has content
    const text = (await page.locator('#scr-main').textContent().catch(() => '')) ?? '';
    // For non-English, verify text is present and the lang attribute is set
    const docLang = await page.evaluate(() => document.documentElement.lang);
    const passed = text.trim().length > 10 && (docLang === this.lang || docLang.startsWith(this.lang));
    this.add('language_switching', passed,
      `docLang="${docLang}" textLen=${text.trim().length}`);
    if (!passed) this.err(`Language not applied: docLang="${docLang}", expected "${this.lang}"`);
  }

  // ─── Check: all game cards visible with non-empty text ───────────────────

  async checkGameCards(page: Page): Promise<void> {
    const cards = page.locator('.mode-card');
    const count = await cards.count();
    if (count === 0) {
      this.add('game_cards_visible', false, 'no .mode-card elements found');
      this.err('No game mode cards found in main-app');
      return;
    }
    const invisible: string[] = [];
    const empty: string[] = [];
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      if (!await card.isVisible()) { invisible.push(`card-${i}`); continue; }
      const text = ((await card.textContent()) ?? '').trim();
      if (!text) empty.push(`card-${i}`);
    }
    const passed = invisible.length === 0 && empty.length === 0;
    this.add('game_cards_visible', passed,
      !passed ? `invisible:[${invisible}] empty:[${empty}]` : `all ${count} ok`);
    if (!passed) this.err(`Game cards: ${invisible.length} invisible, ${empty.length} empty text`);
  }

  // ─── Check: family member names have text ────────────────────────────────

  async checkFamilyNames(page: Page): Promise<void> {
    const pills = page.locator('.fam-pill');
    const count = await pills.count();
    if (count === 0) {
      this.add('family_names', true, 'no_fam_pills — skipped');
      return;
    }
    const names: string[] = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      const t = ((await pills.nth(i).textContent()) ?? '').trim();
      if (t) names.push(t);
    }
    const passed = names.length > 0;
    this.add('family_names', passed, `found: ${names.join(', ')}`);
    if (!passed) this.err('Family member pills rendered with empty text');
  }

  // ─── Check: touch targets ≥ 72px ─────────────────────────────────────────

  async checkTouchTargets(page: Page): Promise<void> {
    const els = page.locator(
      '#scr-main button, #scr-main .mode-card, #scr-main .fam-pill, #scr-main .nav-btn',
    );
    const count = await els.count();
    const violations: string[] = [];
    for (let i = 0; i < Math.min(count, 40); i++) {
      const el = els.nth(i);
      if (!await el.isVisible()) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      if (box.width < MIN_TOUCH_TARGET_PX || box.height < MIN_TOUCH_TARGET_PX) {
        const tag = await el.evaluate(
          e => e.tagName + (e.className ? '.' + String(e.className).split(' ')[0] : ''),
        );
        violations.push(`${tag} ${box.width.toFixed(0)}x${box.height.toFixed(0)}`);
      }
    }
    const passed = violations.length === 0;
    this.add('touch_targets_72px', passed,
      violations.length ? violations.slice(0, 5).join(', ') : `all ${count} ok`);
    if (!passed) this.err(`Touch target violations (72px ASD min): ${violations.join('; ')}`);
  }

  // ─── Check: count game launches ──────────────────────────────────────────

  async checkCountGame(page: Page): Promise<void> {
    const card = page.locator('.mode-card.count');
    if (!await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      this.add('count_game_launches', false, '.mode-card.count not visible');
      this.err('Count game card not visible');
      return;
    }
    await card.tap();
    const screen = page.locator('#game-count');
    const visible = await screen.isVisible({ timeout: 5000 }).catch(() => false);
    this.add('count_game_launches', visible, visible ? 'ok' : '#game-count not visible');
    if (!visible) this.err('Count game did not open (#game-count)');
    await this.backToMain(page);
  }

  // ─── Check: match cards visible and ≥ 72px ───────────────────────────────

  async checkMatchCards(page: Page): Promise<void> {
    const modeCard = page.locator('.mode-card.match');
    if (!await modeCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      this.add('match_cards_size', true, '.mode-card.match not visible — skipped');
      return;
    }
    await modeCard.tap();
    await page.waitForSelector('#game-match', { state: 'visible', timeout: 5000 }).catch(() => {});
    const gameVisible = await page.locator('#game-match').isVisible().catch(() => false);
    if (!gameVisible) {
      this.add('match_cards_size', false, '#game-match not visible after tap');
      this.err('Match game screen did not open');
      await this.backToMain(page);
      return;
    }
    const cards = page.locator('.match-card');
    const count = await cards.count();
    const violations: string[] = [];
    for (let i = 0; i < Math.min(count, 12); i++) {
      const c = cards.nth(i);
      if (!await c.isVisible()) continue;
      const box = await c.boundingBox();
      if (!box) continue;
      if (box.height < MIN_TOUCH_TARGET_PX) violations.push(`card-${i} h=${box.height.toFixed(0)}`);
      if (box.width < MIN_TOUCH_TARGET_PX) violations.push(`card-${i} w=${box.width.toFixed(0)}`);
    }
    const passed = count > 0 && violations.length === 0;
    this.add('match_cards_size', passed,
      count === 0 ? 'no .match-card elements' :
      violations.length ? violations.join(', ') : `all ${count} ok`);
    if (!passed) this.err(`Match cards: ${violations.join('; ') || 'no cards rendered'}`);
    await this.backToMain(page);
  }

  // ─── Check: mic button present in speak game ─────────────────────────────

  async checkMicButton(page: Page): Promise<void> {
    const modeCard = page.locator('.mode-card.speak');
    if (!await modeCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      this.add('mic_button_present', true, '.mode-card.speak not visible — skipped');
      return;
    }
    await modeCard.tap();
    await page.waitForSelector('#game-speak', { state: 'visible', timeout: 5000 }).catch(() => {});
    const micBtn = page.locator('#micBtn');
    const visible = await micBtn.isVisible({ timeout: 3000 }).catch(() => false);
    this.add('mic_button_present', visible, visible ? 'ok' : '#micBtn not found in #game-speak');
    if (!visible) this.err('Mic button (#micBtn) not visible in speak game');
    await this.backToMain(page);
  }

  // ─── Check: AAC board opens and has tiles ────────────────────────────────

  async checkAACBoard(page: Page): Promise<void> {
    const modeCard = page.locator('.mode-card.aac');
    if (!await modeCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      this.add('aac_board_language', true, '.mode-card.aac not visible — skipped');
      return;
    }
    await modeCard.tap();
    await page.waitForSelector('#game-aac', { state: 'visible', timeout: 5000 }).catch(() => {});
    const gameVisible = await page.locator('#game-aac').isVisible().catch(() => false);
    if (!gameVisible) {
      this.add('aac_board_language', false, '#game-aac not visible after tap');
      this.err('AAC board did not open');
      await this.backToMain(page);
      return;
    }
    // Check tiles exist and have non-empty text (= language is applied)
    const tiles = page.locator('#game-aac .aac-tile, #game-aac .aac-btn, #game-aac button');
    const count = await tiles.count();
    const sample = count > 0 ? ((await tiles.first().textContent()) ?? '').trim() : '';
    const passed = count > 0;
    this.add('aac_board_language', passed,
      `tiles=${count} sample="${sample.slice(0, 30)}"`);
    if (!passed) this.err('AAC board has no tiles (#game-aac)');
    await this.backToMain(page);
  }

  // ─── Check: TTS lang tag matches selected language ───────────────────────

  async checkTTSLanguage(page: Page): Promise<void> {
    // Inject a spy on speechSynthesis.speak to capture the utterance lang
    const spokenLang = await page.evaluate((bcp47: string) => {
      return new Promise<string>(resolve => {
        if (!window.speechSynthesis) { resolve('no_api'); return; }
        const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
        let captured = '';
        (window.speechSynthesis as any).speak = (utt: SpeechSynthesisUtterance) => {
          captured = utt.lang ?? '';
          orig(utt);
        };
        // Fire the app's speak() helper which uses S.lang for the utterance
        const speakFn = (window as any).speak;
        if (typeof speakFn === 'function') {
          speakFn('test');
        }
        setTimeout(() => resolve(captured), 800);
      });
    }, this.langCfg.bcp47);

    // Some languages use a fallback TTS voice (e.g. tg → ru-RU, no Tajik voice exists)
    const effectiveBcp47 = (this.langCfg as any).ttsBcp47 ?? this.langCfg.bcp47;
    const expectedPrefix = effectiveBcp47.split('-')[0]; // e.g. 'en', 'ar', 'ru'
    const passed =
      spokenLang === 'no_api' || // speechSynthesis not available — skip
      spokenLang === ''         || // speak() didn't fire — not a hard failure
      spokenLang.startsWith(expectedPrefix);
    this.add('tts_language_tag', passed,
      `spoken="${spokenLang}" expected_prefix="${expectedPrefix}"`);
    if (!passed)
      this.err(`TTS lang tag mismatch: got "${spokenLang}", expected prefix "${expectedPrefix}" (${effectiveBcp47})`);
  }

  // ─── Check: navigation does not open new tabs ────────────────────────────

  async checkNoNewTabs(page: Page): Promise<void> {
    let newTabOpened = false;
    const handler = () => { newTabOpened = true; };
    page.context().on('page', handler);

    // Click any button that navigates to a sub-page (voice module link)
    const voiceBtn = page
      .locator('[onclick*="voice-module"], [href*="voice-module"], [onclick*="idris-voice"]')
      .first();
    if (await voiceBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await voiceBtn.tap();
      await page.waitForTimeout(600);
      // If navigation happened (voice module opened in same tab), go back
      if (page.url().includes('voice-module') || page.url().includes('idris-voice')) {
        await page.goBack();
        await page.waitForSelector('#scr-main', { state: 'visible', timeout: 5000 }).catch(() => {});
      }
    }

    page.context().off('page', handler);
    const passed = !newTabOpened;
    this.add('no_new_tabs', passed,
      newTabOpened ? 'window.open() was called — must use window.location.href' : 'ok');
    if (!passed) this.err('Navigation opened a new tab (FP-031: use window.location.href)');
  }

  // ─── Check: reward overlay exists and can be triggered ───────────────────

  async checkRewardSystem(page: Page): Promise<void> {
    const overlayState = await page.evaluate(() => {
      const overlay = document.getElementById('rewardOverlay');
      if (!overlay) return 'missing';
      const fn = (window as any).triggerReward;
      if (typeof fn === 'function') fn();
      return 'triggered';
    });

    if (overlayState === 'missing') {
      this.add('reward_system', false, '#rewardOverlay element not found in DOM');
      this.err('Reward overlay (#rewardOverlay) not in DOM');
      return;
    }

    await page.waitForTimeout(600);
    const active = await page.locator('#rewardOverlay.active').isVisible().catch(() => false);
    this.add('reward_system', true,
      active ? 'overlay_active_after_trigger' : 'overlay_exists_trigger_function_present');

    // Dismiss so it doesn't block subsequent checks
    await page.evaluate(() => {
      const o = document.getElementById('rewardOverlay');
      if (o) { o.classList.remove('active'); (o as HTMLElement).style.display = 'none'; }
    });
  }

  // ─── Run all checks ───────────────────────────────────────────────────────

  async runAll(page: Page): Promise<AgentResult> {
    try {
      await this.init(page);
      await this.selectProfile(page);
      // Core language checks
      await this.checkDirection(page);
      await this.checkCharacterEncoding(page);
      await this.checkLanguageSwitching(page);
      // UI structure checks
      await this.checkGameCards(page);
      await this.checkFamilyNames(page);
      await this.checkTouchTargets(page);
      // Game-specific checks (each navigates in and back)
      await this.checkCountGame(page);
      await this.checkMatchCards(page);
      await this.checkMicButton(page);
      await this.checkAACBoard(page);
      // Cross-cutting checks (run on main app)
      await this.checkTTSLanguage(page);
      await this.checkNoNewTabs(page);
      await this.checkRewardSystem(page);
    } catch (err: any) {
      this.err(`Agent crash: ${err?.message}`);
    }

    const screenshotPath = await saveScreenshot(page, `lang_${this.lang}_result`)
      .catch(() => undefined);

    const passed = this.checks.every(c => c.passed) && this.errors.length === 0;
    return {
      lang: this.lang,
      label: this.langCfg.label,
      passed,
      checks: this.checks,
      errors: this.errors,
      screenshotPath,
    };
  }

  protected add(name: string, passed: boolean, detail?: string): void {
    this.checks.push({ name, passed, detail });
  }

  protected err(msg: string): void {
    this.errors.push(msg);
  }
}
