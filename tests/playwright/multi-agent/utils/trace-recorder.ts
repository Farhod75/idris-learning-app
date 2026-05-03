import { BrowserContext, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TRACES_DIR = path.resolve(__dirname, '../reports/traces');

export function ensureTracesDir(): void {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
}

/**
 * Start a named trace chunk on the context.
 * Call stopTrace() to save it.
 */
export async function startTrace(context: BrowserContext, name: string): Promise<void> {
  ensureTracesDir();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
}

/**
 * Stop and save the trace to reports/traces/<name>.zip.
 * Returns the file path.
 */
export async function stopTrace(context: BrowserContext, name: string): Promise<string> {
  const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const filePath = path.join(TRACES_DIR, `${safeName}_${Date.now()}.zip`);
  await context.tracing.stop({ path: filePath });
  return filePath;
}

/**
 * Attach a Playwright trace file to the test report via annotations.
 * Use inside a test: attachTrace(testInfo, tracePath, 'lang-en').
 */
export function traceLabel(langCode: string, testName: string): string {
  return `${langCode}_${testName}`.replace(/\s+/g, '_');
}

/**
 * Capture a full-page screenshot and save to reports/screenshots.
 */
export async function saveScreenshot(page: Page, name: string): Promise<string> {
  const dir = path.resolve(__dirname, '../reports/screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const filePath = path.join(dir, `${safeName}_${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}
