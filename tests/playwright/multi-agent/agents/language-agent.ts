import { Page, BrowserContext, expect } from '@playwright/test';
import { AppProfile, buildTestProfile, profileToLocalStorage, MIN_TOUCH_TARGET_PX, GAME_SCREENS } from '../fixtures/test-data';
import { LangCode, LANGUAGES } from '../fixtures/test-data';
import { saveScreenshot } from '../utils/trace-recorder';

export interface LanguageAgentResult {
  lang: LangCode;
  label: string;
  passed: boolean;
  checks: CheckResult[];
  screenshotPath?: string;
  errors: string[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

/**
 * Base language agent — drives the app in a specific language, runs standard
 * checks, and returns structured results for the QA judge to evaluate.
 */
export class LanguageAgent {
  readonly langCode: LangCode;
  readonly profile: AppProfile;
  private results: CheckResult[] = [];
  private errors: string[] = [];

  constructor(langCode: LangCode) {
    this.langCode = langCode;
    this.profile = buildTestProfile(langCode);
  }

  /** Inject localStorage and navigate, bypassing onboarding entirely. */
  async init(page: Page): Promise<void> {
    await page.addInitScript((storageValue: string) => {
      window.localStorage.setItem('app-profiles', storageValue);
    }, profileToLocalStorage(this.profile));
    await page.goto('/');
    // Wait for the profiles screen (shows after localStorage injection)
    await page.waitForSelector('#scr-profiles, #scr-main', { state: 'visible', timeout: 20000 })
      .catch(async () => {
        await page.evaluate(() => {
          // @ts-ignore
          if (typeof showProfiles === 'function') showProfiles();
        });
        await page.waitForSelector('#scr-profiles, #scr-main', { state: 'visible', timeout: 10000 });
      });
  }

  /** Select the pre-injected Idris profile and enter the main app. */
  async selectProfile(page: Page): Promise<void> {
    const profileItem = page.locator('.profile-item').first();
    await profileItem.waitFor({ state: 'visible', timeout: 5000 });
    await profileItem.tap();
    await page.waitForSelector('#main-app', { state: 'visible', timeout: 8000 });
  }

  /** Check that the document direction is correct for this language. */
  async checkDirection(page: Page): Promise<void> {
    const lang = LANGUAGES.find(l => l.code === this.langCode)!;
    const dir = await page.evaluate(() => document.documentElement.dir || 'ltr');
    const passed = dir === lang.dir;
    this.results.push({
      name: 'document_direction',
      passed,
      detail: `expected=${lang.dir} got=${dir}`,
    });
    if (!passed) this.errors.push(`Direction mismatch: expected ${lang.dir}, got ${dir}`);
  }

  /** Check that at least one visible text element uses the expected character set. */
  async checkCharacterEncoding(page: Page): Promise<void> {
    const lang = LANGUAGES.find(l => l.code === this.langCode)!;
    // Skip Latin scripts where ASCII overlap makes this ambiguous
    if (['en', 'uz', 'es', 'fr'].includes(this.langCode)) {
      this.results.push({ name: 'character_encoding', passed: true, detail: 'latin_script_skip' });
      return;
    }
    const bodyText = await page.locator('#main-app').textContent() || '';
    const passed = lang.charPattern.test(bodyText);
    this.results.push({
      name: 'character_encoding',
      passed,
      detail: `pattern=${lang.charPattern} sample=${bodyText.slice(0, 60)}`,
    });
    if (!passed) this.errors.push(`No expected characters found for lang=${this.langCode}`);
  }

  /** Check that all interactive elements meet the 72px ASD touch target minimum. */
  async checkTouchTargets(page: Page): Promise<void> {
    const violations: string[] = [];
    const interactives = page.locator('button, .mode-card, .fam-pill, .lang-card, .nav-btn, .aac-tile');
    const count = await interactives.count();

    for (let i = 0; i < Math.min(count, 30); i++) {
      const el = interactives.nth(i);
      if (!await el.isVisible()) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      if (box.width < MIN_TOUCH_TARGET_PX || box.height < MIN_TOUCH_TARGET_PX) {
        const tag = await el.evaluate(e => e.tagName + (e.className ? '.' + e.className.split(' ')[0] : ''));
        violations.push(`${tag} ${box.width.toFixed(0)}x${box.height.toFixed(0)}px`);
      }
    }

    const passed = violations.length === 0;
    this.results.push({
      name: 'touch_targets_72px',
      passed,
      detail: violations.length ? `violations: ${violations.slice(0, 5).join(', ')}` : 'all ok',
    });
    if (!passed) this.errors.push(`Touch target violations: ${violations.join('; ')}`);
  }

  /** Open a game screen and verify it becomes visible. */
  async checkGameLaunches(page: Page, gameKey: keyof typeof GAME_SCREENS): Promise<void> {
    const game = GAME_SCREENS[gameKey];
    // Click the mode card
    const card = page.locator(`.mode-card.${gameKey}`);
    if (!await card.isVisible()) {
      this.results.push({ name: `game_${gameKey}_launches`, passed: false, detail: 'mode card not visible' });
      return;
    }
    await card.tap();
    const screen = page.locator(`#${game.screenId}`);
    const visible = await screen.isVisible().catch(() => false);
    this.results.push({
      name: `game_${gameKey}_launches`,
      passed: visible,
      detail: visible ? 'ok' : `#${game.screenId} not visible`,
    });
    if (!visible) this.errors.push(`Game ${gameKey} did not open (#${game.screenId})`);
    // Navigate back
    const backBtn = page.locator(`#${game.screenId} .back-btn, #${game.screenId} [onclick*="showScreen"]`).first();
    if (await backBtn.isVisible()) await backBtn.tap();
  }

  /** Check that UI text labels are present and non-empty. */
  async checkUILabels(page: Page): Promise<void> {
    const labelIds = ['subtitle', 'fam-label', 'modes-title'];
    const missing: string[] = [];
    for (const id of labelIds) {
      const el = page.locator(`#${id}`);
      if (!await el.isVisible().catch(() => false)) continue;
      const text = (await el.textContent() || '').trim();
      if (!text) missing.push(id);
    }
    const passed = missing.length === 0;
    this.results.push({ name: 'ui_labels_present', passed, detail: missing.join(', ') || 'all present' });
    if (!passed) this.errors.push(`Empty UI labels: ${missing.join(', ')}`);
  }

  /** Run the full standard check suite for this language. */
  async runChecks(page: Page): Promise<LanguageAgentResult> {
    const lang = LANGUAGES.find(l => l.code === this.langCode)!;
    try {
      await this.init(page);
      await this.selectProfile(page);
      await this.checkDirection(page);
      await this.checkCharacterEncoding(page);
      await this.checkUILabels(page);
      await this.checkTouchTargets(page);
      await this.checkGameLaunches(page, 'count');
    } catch (err: any) {
      this.errors.push(`Agent crash: ${err?.message}`);
    }

    const screenshotPath = await saveScreenshot(page, `lang_${this.langCode}_result`)
      .catch(() => undefined);

    const passed = this.results.every(r => r.passed) && this.errors.length === 0;
    return {
      lang: this.langCode,
      label: lang.label,
      passed,
      checks: this.results,
      screenshotPath,
      errors: this.errors,
    };
  }
}


