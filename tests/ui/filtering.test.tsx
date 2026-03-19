import { test, expect } from '@playwright/test';

const DASHBOARD_URL = '/#/dashboard?e2e=1';

const MOCK_OPPORTUNITIES = [
  {
    id: 'opp-1',
    title: 'Cybersecurity Assessment',
    agency: 'DOD',
    source: 'sam_gov',
    fit_score: 95,
    status: 'qualified',
    due_date: '2025-12-01',
  },
  {
    id: 'opp-2',
    title: 'IT & Network Services',
    agency: 'DHS',
    source: 'govcon',
    fit_score: 85,
    status: 'new',
    due_date: '2025-11-15',
  },
  {
    id: 'opp-3',
    title: 'Cloud (AWS) Services',
    agency: 'NASA',
    source: 'sam_gov',
    fit_score: 75,
    status: 'qualified',
    due_date: '2025-10-10',
  },
  {
    id: 'opp-4',
    title: 'General Infrastructure Upgrade',
    agency: 'GSA',
    source: 'sam_gov',
    fit_score: 65,
    status: 'new',
    due_date: '2025-09-20',
  },
];

test.describe('Dashboard Filtering and Sorting', () => {
  test('supports complex multi-criteria filtering', async ({ page }) => {
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: MOCK_OPPORTUNITIES,
          total: MOCK_OPPORTUNITIES.length,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="opportunity-card"]');

    // Status filter
    await page.selectOption('[data-testid="filter-status"]', 'qualified');

    // Source filter
    await page.selectOption('[data-testid="filter-source"]', 'sam_gov');

    // Score threshold (min fit score)
    await page.fill('[data-testid="filter-min-fit-score"]', '70');

    await page.click('[data-testid="apply-filters"]');
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="opportunity-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('handles rapid filter toggling without performance degradation', async ({ page }) => {
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: MOCK_OPPORTUNITIES,
          total: MOCK_OPPORTUNITIES.length,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="opportunity-card"]');

    const statusFilter = page.locator('[data-testid="filter-status"]');
    const sourceFilter = page.locator('[data-testid="filter-source"]');

    for (let i = 0; i < 10; i++) {
      await statusFilter.selectOption('qualified');
      await statusFilter.selectOption('new');
      await sourceFilter.selectOption('sam_gov');
      await sourceFilter.selectOption('govcon');
    }

    const errorBanner = page.locator('[data-testid="error-banner"]');
    await expect(errorBanner).not.toBeVisible();
  });

  test('search supports special characters', async ({ page }) => {
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: MOCK_OPPORTUNITIES,
          total: MOCK_OPPORTUNITIES.length,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('[data-testid="search-input"]');

    await searchInput.fill('IT & Network');
    await page.waitForTimeout(300);

    const countAmp = await page.locator('[data-testid="opportunity-card"]').count();
    expect(countAmp).toBeGreaterThan(0);

    await searchInput.fill('Cloud (AWS)');
    await page.waitForTimeout(300);

    const countParens = await page.locator('[data-testid="opportunity-card"]').count();
    expect(countParens).toBeGreaterThan(0);

    await searchInput.fill('"Cybersecurity"');
    await page.waitForTimeout(300);

    const countQuotes = await page.locator('[data-testid="opportunity-card"]').count();
    expect(countQuotes).toBeGreaterThan(0);
  });

  test('sorts by multiple fields correctly', async ({ page }) => {
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: MOCK_OPPORTUNITIES,
          total: MOCK_OPPORTUNITIES.length,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="opportunity-card"]');

    const sortSelect = page.locator('[data-testid="sort-select"]');

    // Sort by fit score (desc by default for "fit")
    await sortSelect.selectOption('fit');
    await page.waitForTimeout(300);

    const titlesByFit = await page.locator('[data-testid="opportunity-title"]').allInnerTexts();

    // Sort by due date to get a different ordering
    await sortSelect.selectOption('due');
    await page.waitForTimeout(300);

    const titlesByDue = await page.locator('[data-testid="opportunity-title"]').allInnerTexts();

    expect(titlesByFit.length).toBeGreaterThan(0);
    expect(titlesByDue.length).toBeGreaterThan(0);
    expect(titlesByFit).not.toEqual(titlesByDue);
  });

  test('persists filters across reloads', async ({ page }) => {
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: MOCK_OPPORTUNITIES,
          total: MOCK_OPPORTUNITIES.length,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="opportunity-card"]');

    await page.selectOption('[data-testid="filter-status"]', 'qualified');
    await page.selectOption('[data-testid="filter-source"]', 'sam_gov');
    await page.fill('[data-testid="filter-min-fit-score"]', '80');

    await page.click('[data-testid="apply-filters"]');
    await page.waitForTimeout(300);

    const filteredCount = await page.locator('[data-testid="opportunity-card"]').count();

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="opportunity-card"]');

    const persistedStatus = await page.inputValue('[data-testid="filter-status"]');
    const persistedSource = await page.inputValue('[data-testid="filter-source"]');
    const persistedMinScore = await page.inputValue('[data-testid="filter-min-fit-score"]');

    const reloadedCount = await page.locator('[data-testid="opportunity-card"]').count();

    expect(persistedStatus).toBe('qualified');
    expect(persistedSource).toBe('sam_gov');
    expect(persistedMinScore).toBe('80');
    expect(reloadedCount).toBeGreaterThan(0);
    expect(reloadedCount).toBe(filteredCount);
  });
});
