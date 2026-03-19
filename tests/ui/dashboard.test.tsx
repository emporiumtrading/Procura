import { test, expect } from '@playwright/test';

const DASHBOARD_URL = '/#/dashboard?e2e=1';

test.describe('Dashboard Tests', () => {
  test('renders empty state when no opportunities exist', async ({ page }) => {
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: { data: [], total: 0, page: 1, limit: 25 },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible({ timeout: 20000 });
    await expect(emptyState).toContainText('No opportunities found');

    const filters = page.locator('[data-testid="filters"]');
    await expect(filters).toBeVisible();
  });

  test('renders dashboard with partial dataset (10-50 leads)', async ({ page }) => {
    // Mock API response with 25 opportunities
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: Array.from({ length: 25 }, (_, i) => ({
            id: `opp-${i}`,
            title: `Opportunity ${i}`,
            agency: 'Test Agency',
            source: 'sam_gov',
            fit_score: 85,
            status: 'new',
          })),
          total: 25,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="opportunity-card"]');
    const cards = page.locator('[data-testid="opportunity-card"]');
    await expect(cards).toHaveCount(25);

    // Check pagination controls
    const pagination = page.locator('[data-testid="pagination"]');
    await expect(pagination).toBeVisible();
  });

  test('handles large dataset (500+ leads) with pagination', async ({ page }) => {
    // Mock API response with 500 opportunities
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: Array.from({ length: 500 }, (_, i) => ({
            id: `opp-${i}`,
            title: `Opportunity ${i}`,
            agency: 'Test Agency',
            source: 'sam_gov',
            fit_score: 85,
            status: 'new',
          })),
          total: 500,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="opportunity-card"]');
    const cards = page.locator('[data-testid="opportunity-card"]');
    await expect(cards).toHaveCount(25); // Only first page loaded

    // Test pagination navigation
    const nextPageButton = page.locator('[data-testid="pagination-next"]');
    await expect(nextPageButton).toBeVisible();
    await nextPageButton.click();

    await page.waitForTimeout(1000); // Wait for page change

    // Verify new page loaded
    const updatedCards = page.locator('[data-testid="opportunity-card"]');
    await expect(updatedCards).toHaveCount(25);
  });

  test('handles malformed lead objects gracefully', async ({ page }) => {
    // Mock API response with malformed data
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 'opp-1',
              title: 'Valid Opportunity',
              agency: 'Test Agency',
              source: 'sam_gov',
              fit_score: 85,
              status: 'new',
            },
            {
              id: 'opp-2',
              // Missing title field
              agency: 'Test Agency',
              source: 'sam_gov',
              fit_score: 85,
              status: 'new',
            },
            {
              id: 'opp-3',
              title: 'Malformed Opportunity',
              // Missing agency field
              source: 'sam_gov',
              fit_score: 85,
              status: 'new',
            },
          ],
          total: 3,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="opportunity-card"]');
    const cards = page.locator('[data-testid="opportunity-card"]');
    await expect(cards).toHaveCount(3);

    // Verify malformed cards still render without crashing
    const malformedCard1 = page.locator('[data-testid="opportunity-card"][data-id="opp-2"]');
    const malformedCard2 = page.locator('[data-testid="opportunity-card"][data-id="opp-3"]');

    await expect(malformedCard1).toBeVisible();
    await expect(malformedCard2).toBeVisible();
  });

  test('filters work correctly with various combinations', async ({ page }) => {
    // Mock API response with mixed data
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 'opp-1',
              title: 'Cybersecurity Opportunity',
              agency: 'DOD',
              source: 'sam_gov',
              fit_score: 95,
              status: 'qualified',
            },
            {
              id: 'opp-2',
              title: 'IT Modernization',
              agency: 'DHS',
              source: 'govcon',
              fit_score: 85,
              status: 'new',
            },
            {
              id: 'opp-3',
              title: 'Cloud Services',
              agency: 'NASA',
              source: 'sam_gov',
              fit_score: 75,
              status: 'qualified',
            },
            {
              id: 'opp-4',
              title: 'Network Infrastructure',
              agency: 'DoD',
              source: 'sam_gov',
              fit_score: 65,
              status: 'new',
            },
          ],
          total: 4,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="opportunity-card"]');

    // Test status filter
    const statusFilter = page.locator('[data-testid="filter-status"]');
    await statusFilter.selectOption('qualified');
    await page.waitForTimeout(500); // Wait for filtering

    let filteredCards = page.locator('[data-testid="opportunity-card"]');
    await expect(filteredCards).toHaveCount(2);

    // Test source filter
    const sourceFilter = page.locator('[data-testid="filter-source"]');
    await sourceFilter.selectOption('sam_gov');
    await page.waitForTimeout(500);

    filteredCards = page.locator('[data-testid="opportunity-card"]');
    await expect(filteredCards).toHaveCount(2); // Both qualified are from sam_gov

    // Test fit score range filter
    const minScoreFilter = page.locator('[data-testid="filter-min-fit-score"]');
    await minScoreFilter.fill('80');
    await page.waitForTimeout(500);

    filteredCards = page.locator('[data-testid="opportunity-card"]');
    await expect(filteredCards).toHaveCount(1); // Only opp-1 has fit_score >= 80
  });

  test('handles rapid filter toggling without errors', async ({ page }) => {
    // Mock API response
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 'opp-1',
              title: 'Opportunity 1',
              agency: 'Agency 1',
              source: 'sam_gov',
              fit_score: 90,
              status: 'new',
            },
            {
              id: 'opp-2',
              title: 'Opportunity 2',
              agency: 'Agency 2',
              source: 'govcon',
              fit_score: 80,
              status: 'qualified',
            },
            {
              id: 'opp-3',
              title: 'Opportunity 3',
              agency: 'Agency 3',
              source: 'sam_gov',
              fit_score: 70,
              status: 'new',
            },
          ],
          total: 3,
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

    // Rapidly toggle filters
    for (let i = 0; i < 10; i++) {
      await statusFilter.selectOption('qualified');
      await page.waitForTimeout(100);
      await statusFilter.selectOption('new');
      await page.waitForTimeout(100);

      await sourceFilter.selectOption('sam_gov');
      await page.waitForTimeout(100);
      await sourceFilter.selectOption('govcon');
      await page.waitForTimeout(100);
    }

    // Verify no errors occurred
    const errorBanner = page.locator('[data-testid="error-banner"]');
    await expect(errorBanner).not.toBeVisible();

    // Verify final state is correct
    const finalCards = page.locator('[data-testid="opportunity-card"]');
    await expect(finalCards).toHaveCount(3); // Should be back to all opportunities
  });

  test('loading states and disabled buttons work correctly', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 'opp-1',
              title: 'Opportunity 1',
              agency: 'Agency 1',
              source: 'sam_gov',
              fit_score: 90,
              status: 'new',
            },
          ],
          total: 1,
          page: 1,
          limit: 25,
        },
        delay: 2000, // 2 second delay
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // Verify loading state
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();

    // Verify buttons are disabled during loading
    const filterButtons = page.locator('[data-testid="filter-button"]');
    await expect(filterButtons).toBeDisabled();

    // Wait for data to load
    await page.waitForSelector('[data-testid="opportunity-card"]', { timeout: 3000 });

    // Verify loading state is gone
    await expect(loadingSpinner).not.toBeVisible();
    await expect(filterButtons).toBeEnabled();
  });

  test('error UI is visible when API fails', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 500,
        json: { error: 'Internal Server Error' },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // Verify error banner is visible
    const errorBanner = page.locator('[data-testid="error-banner"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Failed to load opportunities');

    // Verify retry button is present
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();

    // Test retry functionality
    await retryButton.click();
    await page.waitForTimeout(500);

    // Error should still be visible (API still failing)
    await expect(errorBanner).toBeVisible();
  });

  test('accessibility basics are implemented', async ({ page }) => {
    // Mock API response
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 'opp-1',
              title: 'Opportunity 1',
              agency: 'Agency 1',
              source: 'sam_gov',
              fit_score: 90,
              status: 'new',
            },
          ],
          total: 1,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="opportunity-card"]');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Test ARIA labels
    const opportunityCard = page.locator('[data-testid="opportunity-card"]');
    await expect(opportunityCard).toHaveAttribute('role', 'article');

    // Test focus management
    const filterButton = page.locator('[data-testid="filter-button"]');
    await filterButton.focus();
    await expect(filterButton).toBeFocused();

    // Test screen reader support
    const opportunityTitle = page.locator('[data-testid="opportunity-title"]');
    await expect(opportunityTitle).toHaveAttribute('aria-label');
  });

  test('search functionality works with special characters', async ({ page }) => {
    // Mock API response
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 'opp-1',
              title: 'Cybersecurity Assessment',
              agency: 'DOD',
              source: 'sam_gov',
              fit_score: 95,
              status: 'qualified',
            },
            {
              id: 'opp-2',
              title: 'IT & Network Services',
              agency: 'DHS',
              source: 'govcon',
              fit_score: 85,
              status: 'new',
            },
            {
              id: 'opp-3',
              title: 'Cloud (AWS) Services',
              agency: 'NASA',
              source: 'sam_gov',
              fit_score: 75,
              status: 'qualified',
            },
          ],
          total: 3,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="opportunity-card"]');

    const searchInput = page.locator('[data-testid="search-input"]');

    // Test search with special characters
    await searchInput.fill('IT & Network');
    await page.waitForTimeout(500);

    const filteredCards = page.locator('[data-testid="opportunity-card"]');
    await expect(filteredCards).toHaveCount(1); // Should match opp-2

    // Test search with parentheses
    await searchInput.fill('Cloud (AWS)');
    await page.waitForTimeout(500);

    await expect(filteredCards).toHaveCount(1); // Should match opp-3

    // Test search with quotes
    await searchInput.fill('"Cybersecurity"');
    await page.waitForTimeout(500);

    await expect(filteredCards).toHaveCount(1); // Should match opp-1
  });

  test('sort functionality works correctly', async ({ page }) => {
    // Mock API response
    await page.route('**/api/opportunities**', (route) => {
      route.fulfill({
        status: 200,
        json: {
          data: [
            {
              id: 'opp-1',
              title: 'Opportunity A',
              agency: 'Agency A',
              source: 'sam_gov',
              fit_score: 90,
              status: 'new',
            },
            {
              id: 'opp-2',
              title: 'Opportunity B',
              agency: 'Agency B',
              source: 'govcon',
              fit_score: 80,
              status: 'qualified',
            },
            {
              id: 'opp-3',
              title: 'Opportunity C',
              agency: 'Agency C',
              source: 'sam_gov',
              fit_score: 70,
              status: 'new',
            },
          ],
          total: 3,
          page: 1,
          limit: 25,
        },
      });
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="opportunity-card"]');

    const sortSelect = page.locator('[data-testid="sort-select"]');

    // Sort by fit score (descending)
    await sortSelect.selectOption('fit');
    await page.waitForTimeout(500);

    const titles = page.locator('[data-testid="opportunity-title"]');
    const titlesByFit = await titles.allInnerTexts();

    // Sort by due date (ascending)
    await sortSelect.selectOption('due');
    await page.waitForTimeout(500);

    const titlesByDue = await titles.allInnerTexts();

    expect(titlesByFit.length).toBeGreaterThan(0);
    expect(titlesByDue.length).toBeGreaterThan(0);
    expect(titlesByFit).not.toEqual(titlesByDue);
  });
});

// Meta-cognitive debug protocol tags used:
// [UI_STATE] - UI rendering and state management
// [ASYNC_TIMING] - Loading states and async operations
// [DATA_CORRUPTION] - Malformed data handling
// [EXTERNAL_DEPENDENCY] - API mocking and failure simulation
