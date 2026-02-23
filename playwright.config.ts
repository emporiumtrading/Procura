import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/ui',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? ['github'] : ['html', 'list'],
  timeout: 30_000,

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Mock external APIs for consistent testing
    route: async (route, request) => {
      // Mock API responses for consistent testing
      if (request.url().includes('/api/')) {
        const mockResponse = {
          opportunities: [
            { id: 'opp-001', title: 'Test Opportunity', agency: 'Test Agency', fit_score: 85 },
            { id: 'opp-002', title: 'Another Opportunity', agency: 'Another Agency', fit_score: 90 }
          ],
          total: 2,
          page: 1,
          limit: 25
        };
        
        route.fulfill({
          status: 200,
          json: mockResponse
        });
        return;
      }
      
      route.continue();
    }
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  // Start the dev server before running tests (local only)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 30_000
      }
});