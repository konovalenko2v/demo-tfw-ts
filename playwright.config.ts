import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      // restful-booker.herokuapp.com rate-limits aggressive parallel bursts
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'graphql',
      testDir: './tests/graphql',
      // Hygraph demo CDN endpoint returns 429 under parallel load
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
