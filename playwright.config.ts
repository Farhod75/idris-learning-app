import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  testIgnore: '**/multi-agent/**',
  timeout: 60000,
  reporter: [['list'], ['html', { outputFolder: 'tests/reports/html', open: 'never' }]],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone14', use: { ...devices['iPhone 14'], hasTouch: true } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'], hasTouch: true } },
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://idris-learning-app.vercel.app',
    screenshot: 'only-on-failure',
  },
});