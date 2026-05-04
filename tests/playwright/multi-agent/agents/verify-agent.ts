import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

const APP_URL       = process.env.APP_URL || 'http://localhost:3000';
const BUG_QUEUE     = path.resolve(__dirname, '../reports/bug-queue.json');
const VERIFY_REPORT = path.resolve(__dirname, '../reports/verify-report.json');
const FP_LOG        = path.resolve(__dirname, '../reports/fp-log.md');

interface BoundingBox { x: number; y: number; width: number; height: number; }
interface ViewportDef  { name: string; width: number; height: number; }
interface Bug {
  id: string; title: string; status: string; file: string; test_file: string;
  verify: { selector: string; assert_max_height_px: number; assert_max_width_px: number; assert_min_height_px: number; viewports: ViewportDef[]; };
  attempts: number; fix_result: string | null; verify_result: string | null; logged_to_fix_patterns: boolean;
}
interface BugQueue { version: string; generated: string; bugs: Bug[]; }
interface ViewportResult { viewport: string; width: number; height: number; passed: boolean; cards_checked: number; failures: string[]; }
interface BugVerifyResult { id: string; title: string; overall: 'PASS' | 'FAIL'; viewport_results: ViewportResult[]; timestamp: string; }
interface VerifyReport { agent: string; timestamp: string; app_url: string; bugs_verified: number; passed: number; failed: number; results: BugVerifyResult[]; }

function log(msg: string): void { console.log(`[verify-agent ${new Date().toISOString().substring(11,19)}] ${msg}`); }
function readQueue(): BugQueue  { return JSON.parse(fs.readFileSync(BUG_QUEUE, 'utf-8')); }
function writeQueue(q: BugQueue): void { fs.writeFileSync(BUG_QUEUE, JSON.stringify(q, null, 2)); }

async function openMatchGame(page: Page): Promise<void> {
  // Inject complete profile to skip onboarding (app reads localStorage in init())
  await page.addInitScript(() => {
    localStorage.setItem('app-profiles', JSON.stringify([{
      id: 1, name: 'Idris', age: 7, uiLang: 'en', homeLangs: ['en'],
      interests: [1], family: 'mama', doctor: '', avatar: '🦕', stars: 0,
      createdAt: new Date().toISOString()
    }]));
  });
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 15000 });
  // App shows #scr-profiles when a profile exists — click it to load main app
  await page.waitForSelector('.profile-item', { timeout: 8000 });
  await page.locator('.profile-item').first().click();
  // Main app now shows — wait for mode cards
  await page.waitForSelector('#modesGrid .mode-card', { timeout: 8000 });
  await page.locator('.mode-card.match').click();
  // Game screen becomes active (class added by openGame())
  await page.waitForSelector('#game-match.active', { timeout: 8000 });
  // Wait for cards to render
  await page.waitForSelector('#match-grid .match-card', { timeout: 5000 });
  // slideIn animation is 0.3s — wait for it to complete before measuring bounding boxes
  await page.waitForTimeout(400);
}

async function verifyViewport(browser: Browser, bug: Bug, vp: ViewportDef): Promise<ViewportResult> {
  const result: ViewportResult = { viewport: vp.name, width: vp.width, height: vp.height, passed: true, cards_checked: 0, failures: [] };
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page: Page = await ctx.newPage();
  try {
    await openMatchGame(page);
    const { selector, assert_max_height_px, assert_max_width_px, assert_min_height_px } = bug.verify;
    const cards = page.locator(selector);
    const count = await cards.count();
    result.cards_checked = count;
    if (count === 0) { result.passed = false; result.failures.push('No cards rendered'); }

    const gridBox: BoundingBox | null = await page.locator('#match-grid').boundingBox();
    if (gridBox) {
      if (gridBox.width > 365) result.failures.push(`Grid too wide: ${gridBox.width.toFixed(0)}px`);
      const offset = Math.abs((gridBox.x + gridBox.width / 2) - vp.width / 2);
      if (offset > 50) result.failures.push(`Grid not centered: offset=${offset.toFixed(0)}px`);
    }

    for (let i = 0; i < count; i++) {
      const box: BoundingBox | null = await cards.nth(i).boundingBox();
      if (!box) { result.failures.push(`Card ${i}: not visible`); continue; }
      if (box.height >= assert_max_height_px) result.failures.push(`Card ${i}: height ${box.height.toFixed(0)}px >= ${assert_max_height_px}px [FP-039]`);
      if (box.width  >= assert_max_width_px)  result.failures.push(`Card ${i}: width ${box.width.toFixed(0)}px >= ${assert_max_width_px}px`);
      if (box.height <  assert_min_height_px) result.failures.push(`Card ${i}: height ${box.height.toFixed(0)}px < ${assert_min_height_px}px`);
      if (Math.abs(box.width - box.height) > 10) result.failures.push(`Card ${i}: not square w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}`);
    }
    if (result.failures.length > 0) result.passed = false;
    log(`    ${result.passed ? 'PASS' : 'FAIL'} [${vp.name} ${vp.width}x${vp.height}] — ${count} cards`);
    result.failures.forEach(f => log(`         -> ${f}`));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.passed = false; result.failures.push(`Error: ${msg}`);
    log(`    ERROR [${vp.name}]: ${msg}`);
  } finally { await ctx.close(); }
  return result;
}

function logToFpLog(bug: Bug, result: BugVerifyResult): void {
  const entry = `\n## ${bug.id} — ${bug.title}\n- **File**: \`${bug.file}\`\n- **Verified**: ${result.timestamp} — ${result.overall}\n`;
  fs.appendFileSync(FP_LOG, entry, 'utf-8');
}

export async function runVerifyAgent(): Promise<VerifyReport> {
  log('VERIFY-AGENT starting | ' + APP_URL);
  const queue = readQueue();
  const report: VerifyReport = { agent: 'verify-agent', timestamp: new Date().toISOString(), app_url: APP_URL, bugs_verified: 0, passed: 0, failed: 0, results: [] };
  const fixedBugs = queue.bugs.filter((b: Bug) => b.status === 'fixed');
  log(`${fixedBugs.length} fixed bug(s) to verify`);
  if (fixedBugs.length === 0) { fs.writeFileSync(VERIFY_REPORT, JSON.stringify(report, null, 2)); return report; }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    for (const bug of fixedBugs) {
      log(`Verifying [${bug.id}]: ${bug.title}`);
      const bugResult: BugVerifyResult = { id: bug.id, title: bug.title, overall: 'PASS', viewport_results: [], timestamp: new Date().toISOString() };
      for (const vp of bug.verify.viewports) {
        const vpr = await verifyViewport(browser, bug, vp);
        bugResult.viewport_results.push(vpr);
        if (!vpr.passed) bugResult.overall = 'FAIL';
      }
      const qBug = queue.bugs.find((b: Bug) => b.id === bug.id);
      if (qBug) {
        qBug.verify_result = bugResult.overall;
        if (bugResult.overall === 'PASS') { qBug.status = 'verified'; qBug.logged_to_fix_patterns = true; logToFpLog(bug, bugResult); report.passed++; log(`[${bug.id}] VERIFIED`); }
        else { qBug.status = 'verify_failed'; report.failed++; log(`[${bug.id}] FAILED`); }
      }
      report.results.push(bugResult); report.bugs_verified++;
    }
  } finally { if (browser) await browser.close(); }

  writeQueue(queue);
  fs.writeFileSync(VERIFY_REPORT, JSON.stringify(report, null, 2));
  log(`Done | passed: ${report.passed} | failed: ${report.failed}`);
  return report;
}

if (require.main === module) {
  runVerifyAgent().catch((err: unknown) => { console.error('[verify-agent] FATAL:', err); process.exit(1); });
}
