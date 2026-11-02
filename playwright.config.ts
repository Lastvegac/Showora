import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://localhost:5178',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    channel: process.env.CI ? undefined : 'chrome',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5178/api/v1/health/ready',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
