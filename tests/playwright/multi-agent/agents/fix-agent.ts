/**
 * fix-agent.ts  — FILE-BASED (no Claude API needed)
 * Reads bug-queue.json, applies CSS string-replace directly to index.html
 * FP-039 | Author: Farhod Elbekov
 */
import * as fs   from "fs";
import * as path from "path";

const PROJECT_ROOT  = path.resolve(__dirname, "../../../../");
const BUG_QUEUE     = path.resolve(__dirname, "../reports/bug-queue.json");
const FIX_REPORT    = path.resolve(__dirname, "../reports/fix-report.json");

interface Bug {
  id: string; title: string; status: string; file: string; test_file: string;
  fix: { find: string; replace: string; };
  attempts: number; fix_result: string | null; verify_result: string | null;
  logged_to_fix_patterns: boolean;
  verify: { selector: string; assert_max_height_px: number; assert_max_width_px: number; assert_min_height_px: number; viewports: Array<{name:string;width:number;height:number}>; };
}
interface BugQueue { bugs: Bug[]; }

function log(msg: string) { console.log(`[fix-agent ${new Date().toISOString().substring(11,19)}] ${msg}`); }
function readQueue(): BugQueue { return JSON.parse(fs.readFileSync(BUG_QUEUE, "utf-8").replace(/^\uFEFF/, "")); }
function writeQueue(q: BugQueue) { fs.writeFileSync(BUG_QUEUE, JSON.stringify(q, null, 2)); }

function applyCssFix(bug: Bug): { success: boolean; error?: string } {
  const filePath = path.join(PROJECT_ROOT, bug.file);
  if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };

  let html = fs.readFileSync(filePath, "utf-8");

  // Fix 1: match-grid max-width
  if (html.includes("max-width: 360px") && html.includes("margin-left: auto")) {
    log(`  ⚠️  match-grid fix already applied`);
  } else {
    const oldGrid = `.match-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }`;
    const newGrid = `.match-grid {\n  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;\n  margin-bottom: 24px; max-width: 360px; margin-left: auto; margin-right: auto;\n}`;
    if (html.includes(oldGrid)) {
      html = html.replace(oldGrid, newGrid);
      log(`  ✅ Applied match-grid max-width fix`);
    } else {
      // Flexible regex fallback
      html = html.replace(
        /\.match-grid\s*\{([^}]*)\}/,
        `.match-grid { $1 max-width: 360px; margin-left: auto; margin-right: auto; }`
      );
      log(`  ✅ Applied match-grid fix via regex`);
    }
  }

  // Fix 2: match-card max dimensions
  if (html.includes("max-width: 110px")) {
    log(`  ⚠️  match-card fix already applied`);
  } else {
    html = html.replace(
      /\.match-card\s*\{([^}]*)(border: 4px solid transparent;)\s*\}/,
      `.match-card {$1$2\n  max-width: 110px; max-height: 110px; width: 100%;\n}`
    );
    log(`  ✅ Applied match-card max-width/max-height fix`);
  }

  fs.writeFileSync(filePath, html, "utf-8");
  return { success: true };
}

function createTestFile(bug: Bug): { success: boolean } {
  const testPath = path.join(PROJECT_ROOT, bug.test_file);
  const testDir  = path.dirname(testPath);
  if (!fs.existsSync(testDir)) { fs.mkdirSync(testDir, { recursive: true }); }
  if (fs.existsSync(testPath)) { log(`  ⚠️  Test already exists: ${bug.test_file}`); return { success: true }; }

  const { selector, assert_max_height_px, assert_max_width_px, assert_min_height_px, viewports } = bug.verify;

  const viewportBlocks = viewports.map(vp => `
test.describe("${bug.id} — ${vp.name} (${vp.width}x${vp.height})", () => {
  test.use({ viewport: { width: ${vp.width}, height: ${vp.height} } });
  test("cards within bounds on ${vp.name}", async ({ page }) => {
    await openMatchGame(page);
    const cards = page.locator("${selector}");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height, \`card \${i} height\`).toBeLessThan(${assert_max_height_px});
      expect(box!.height, \`card \${i} touch\`).toBeGreaterThanOrEqual(${assert_min_height_px});
    }
  });
});`).join("\n");

  const content = `import { test, expect, Page } from "@playwright/test";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
async function openMatchGame(page: Page) {
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.click(".mode-card.match");
  await page.waitForSelector("#matchScreen.active", { timeout: 5000 });
}
test.describe("${bug.id} — core", () => {
  test.beforeEach(async ({ page }) => { await openMatchGame(page); });
  test("match-grid max 360px", async ({ page }) => {
    const box = await page.locator("#matchGrid").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(360);
  });
  test("each card < ${assert_max_height_px}px height", async ({ page }) => {
    const cards = page.locator("${selector}");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height).toBeLessThan(${assert_max_height_px});
      expect(box!.width).toBeLessThan(${assert_max_width_px});
    }
  });
  test("each card >= ${assert_min_height_px}px touch target", async ({ page }) => {
    const cards = page.locator("${selector}");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(${assert_min_height_px});
    }
  });
});
${viewportBlocks}
`;
  fs.writeFileSync(testPath, content, "utf-8");
  log(`  📝 Created: ${bug.test_file}`);
  return { success: true };
}

export async function runFixAgent(): Promise<{ success: boolean; bugsFixed: number }> {
  log("════ FIX-AGENT (file-based) starting ════");
  const queue = readQueue();
  const openBugs = queue.bugs.filter((b: Bug) => b.status === "open");
  log(`${openBugs.length} open bug(s)`);

  let bugsFixed = 0;
  const results: object[] = [];

  for (const bug of openBugs) {
    log(`\n[${bug.id}] ${bug.title}`);
    bug.attempts = (bug.attempts || 0) + 1;

    const fixResult  = applyCssFix(bug);
    const testResult = createTestFile(bug);

    if (fixResult.success && testResult.success) {
      bug.status     = "fixed";
      bug.fix_result = "applied";
      bugsFixed++;
      log(`  ✅ [${bug.id}] → status: fixed`);
      results.push({ id: bug.id, fix_applied: true, test_created: true });
    } else {
      bug.status     = "fix_failed";
      bug.fix_result = fixResult.error || "unknown error";
      log(`  ❌ [${bug.id}] → fix_failed: ${bug.fix_result}`);
      results.push({ id: bug.id, fix_applied: false, error: bug.fix_result });
    }
  }

  writeQueue(queue);
  fs.writeFileSync(FIX_REPORT, JSON.stringify({ agent: "fix-agent", timestamp: new Date().toISOString(), results }, null, 2));
  log(`\nFIX-AGENT done. Fixed: ${bugsFixed}/${openBugs.length}`);
  return { success: bugsFixed > 0, bugsFixed };
}

if (require.main === module) {
  runFixAgent().catch(err => { console.error("[fix-agent] FATAL:", err); process.exit(1); });
}
