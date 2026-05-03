import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['agents/*.spec.ts', 'orchestrator.spec.ts'],
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // agents run sequentially to avoid port conflicts
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: './reports/html', open: 'never' }],
    ['json', { outputFile: './reports/results.json' }],
  ],
  outputDir: './reports/artifacts',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on', // always record traces (FP pattern discovery)
    screenshot: 'on',
    video: 'off',
    viewport: { width: 1024, height: 1366 }, // iPad viewport (CLAUDE.md)
    hasTouch: true,
    isMobile: true,
    locale: 'en-US',
  },
  projects: [
    {
      name: 'ipad-safari',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
        hasTouch: true,
      },
    },
    {
      name: 'iphone-safari',
      use: {
        ...devices['iPhone 14'],
        hasTouch: true,
      },
    },
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        hasTouch: false,
        isMobile: false,
      },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npx serve .. -p 3000 -s',
        port: 3000,
        reuseExistingServer: false,
        timeout: 30_000,
      }
    : undefined,
});
