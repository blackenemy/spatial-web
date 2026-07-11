import { defineConfig, devices } from '@playwright/test';

// Basic Playwright config. Web tests boot vite dev; API tests hit API_URL directly.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.WEB_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Skip the built-in web server when pointing at an already-running/deployed site.
  webServer: process.env.WEB_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
