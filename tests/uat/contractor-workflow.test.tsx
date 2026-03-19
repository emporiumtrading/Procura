import { test, expect } from '@playwright/test';

test.describe('UAT - Contractor Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'contractor@procura.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard-header"]');
  });

  test('end-to-end opportunity lifecycle', async ({ page }) => {
    // Filter opportunities
    await page.click('[data-testid="filter-button"]');
    await page.selectOption('[data-testid="filter-status"]', 'new');
    await page.click('[data-testid="apply-filters"]');

    // Save filter view
    await page.click('[data-testid="save-view-button"]');
    await page.fill('[data-testid="save-view-name"]', 'My New Leads');
    await page.click('[data-testid="confirm-save-view"]');

    await expect(page.locator('[data-testid="saved-view-pill"]')).toContainText('My New Leads');

    // Open lead detail
    const firstCard = page.locator('[data-testid="opportunity-card"]').first();
    await firstCard.click();
    await page.waitForSelector('[data-testid="opportunity-detail"]');

    // Update status
    await page.selectOption('[data-testid="status-select"]', 'qualified');
    await page.click('[data-testid="status-save"]');
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('Qualified');

    // Add comment
    await page.fill('[data-testid="comment-input"]', 'Looks like a strong fit.');
    await page.click('[data-testid="add-comment"]');
    await expect(page.locator('[data-testid="comment-item"]')).toContainText(
      'Looks like a strong fit.'
    );

    // Collaborator mention
    await page.fill('[data-testid="comment-input"]', '@teammate please review');
    await page.click('[data-testid="add-comment"]');
    await expect(page.locator('[data-testid="mention-chip"]')).toBeVisible();

    // Export opportunities
    await page.click('[data-testid="back-to-dashboard"]');
    await page.click('[data-testid="export-button"]');
    await page.selectOption('[data-testid="export-format"]', 'csv');
    await page.click('[data-testid="export-confirm"]');
    await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
  });

  test('lead editing and validation', async ({ page }) => {
    const firstCard = page.locator('[data-testid="opportunity-card"]').first();
    await firstCard.click();
    await page.waitForSelector('[data-testid="opportunity-detail"]');

    await page.click('[data-testid="edit-opportunity"]');

    await page.fill('[data-testid="edit-title"]', '');
    await page.click('[data-testid="edit-save"]');
    await expect(page.locator('[data-testid="title-error"]')).toBeVisible();

    await page.fill('[data-testid="edit-title"]', 'Updated Opportunity Title');
    await page.click('[data-testid="edit-save"]');

    await expect(page.locator('[data-testid="opportunity-title"]')).toContainText(
      'Updated Opportunity Title'
    );
  });
});
