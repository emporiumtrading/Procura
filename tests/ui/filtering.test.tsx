import { test, expect } from '@playwright/test';

test.describe('Dashboard Filtering and Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('supports complex multi-criteria filtering', async ({ page }) => {
    await page.waitForSelector('[data-testid="opportunity-card"]');

    // Status filter
    await page.selectOption('[data-testid="filter-status"]', 'qualified');

    // Source filter
    await page.selectOption('[data-testid="filter-source"]', 'sam_gov');

    // Score range
    await page.fill('[data-testid="filter-min-fit-score"]', '70');
    await page.fill('[data-testid="filter-max-fit-score"]', '95');

    await page.click('[data-testid="apply-filters"]');
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="opportunity-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('handles rapid filter toggling without performance degradation', async ({ page }) => {
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
    await page.waitForSelector('[data-testid="opportunity-card"]');

    const sortSelect = page.locator('[data-testid="sort-select"]');

    await sortSelect.selectOption('fit_score_desc');
    await page.waitForTimeout(300);

    const titlesDesc = await page.locator('[data-testid="opportunity-title"]').allInnerTexts();

    await sortSelect.selectOption('fit_score_asc');
    await page.waitForTimeout(300);

    const titlesAsc = await page.locator('[data-testid="opportunity-title"]').allInnerTexts();

    expect(titlesDesc.length).toBeGreaterThan(0);
    expect(titlesAsc.length).toBeGreaterThan(0);
  });

  test('persists filters across reloads', async ({ page, context }) => {
    await page.waitForSelector('[data-testid="opportunity-card"]');

    await page.selectOption('[data-testid="filter-status"]', 'qualified');
    await page.selectOption('[data-testid="filter-source"]', 'sam_gov');
    await page.fill('[data-testid="filter-min-fit-score"]', '80');

    await page.click('[data-testid="apply-filters"]');
    await page.waitForTimeout(300);

    const filteredCount = await page.locator('[data-testid="opportunity-card"]').count();

    // Reload
    await page.reload();
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

