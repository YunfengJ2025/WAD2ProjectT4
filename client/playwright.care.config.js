import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  expect: { timeout: 10000 },
  testMatch: '**/care-*.spec.js',
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5178',
    headless: true,
    actionTimeout: 10000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Singapore',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --config vite.care.config.js',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
  },
})
