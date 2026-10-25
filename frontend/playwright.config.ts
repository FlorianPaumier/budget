import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 8000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: process.env.WEB_BROWSER || 'chromium',
      use: {
        ...devices[
          process.env.WEB_BROWSER === 'firefox'
            ? 'Desktop Firefox'
            : 'Desktop Chrome'
        ],
      },
    },
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:3000/healthz',
    reuseExistingServer: false,
    timeout: 90_000,
  },
})
