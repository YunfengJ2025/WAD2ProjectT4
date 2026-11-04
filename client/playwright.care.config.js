import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  expect: { timeout: 10000 },
  testMatch: '**/care-workflow.spec.js',
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://localhost:5173', headless: true, timezoneId: 'Asia/Singapore' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
