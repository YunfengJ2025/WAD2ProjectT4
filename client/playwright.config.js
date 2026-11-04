import process from 'node:process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// Keep account passwords outside source control. Node 22+ reads this optional file.
// Resolve from this config file, not the terminal's current working directory.
// This supports both `cd client` and running Playwright with --config from root.
const envFile = fileURLToPath(new URL('./.env.e2e.local', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)
const remote = process.env.E2E_BASE_URL
const baseURL = remote || 'http://localhost:5173'
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  // Dedicated accounts share a backend; serialize journeys for predictable state.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Optional installed Chrome/Edge channel when Playwright browsers are unavailable.
    ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // A deployed frontend is already running. Local mode starts only Vite; the
  // real Express backend must be started separately against a test database.
  webServer: remote
    ? undefined
    : {
        command: 'npm run dev -- --host localhost --port 5173 --strictPort',
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
})
