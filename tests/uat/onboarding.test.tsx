import { test, expect } from '@playwright/test';

test.describe('User Acceptance Testing - New User Onboarding', () => {
  test('complete account creation flow', async ({ page }) => {
    // Start from login page
    await page.goto('/login');

    // Click on create account link
    await page.click('[data-testid="create-account-link"]');
    await page.waitForSelector('[data-testid="signup-form"]');

    // Fill signup form
    await page.fill('[data-testid="signup-name"]', 'Test User');
    await page.fill('[data-testid="signup-email"]', 'testuser@procura.com');
    await page.fill('[data-testid="signup-password"]', 'SecurePass123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'SecurePass123!');

    // Select subscription tier
    await page.click('//label[contains(text(), "Pro Monthly")]//preceding-sibling::input');

    // Accept terms and conditions
    await page.check('[data-testid="terms-checkbox"]');

    // Complete captcha (mocked for testing)
    await page.click('[data-testid="captcha-checkbox"]');

    // Submit signup form
    await page.click('[data-testid="signup-submit-button"]');

    // Wait for email verification step
    await page.waitForSelector('[data-testid="email-verification"]');
    await expect(page.locator('[data-testid="email-verification"]')).toContainText(
      'Check your email for verification link'
    );

    // Mock email verification (in real test, would use email testing service)
    await page.click('[data-testid="resend-verification-link"]');
    await expect(page.locator('[data-testid="verification-sent"]')).toBeVisible();

    // Simulate email verification (mock)
    await page.click('[data-testid="verify-email-button"]');
    await page.waitForTimeout(2000); // Wait for verification

    // Wait for onboarding to complete
    await page.waitForSelector('[data-testid="onboarding-welcome"]');
    await expect(page.locator('[data-testid="onboarding-welcome"]')).toContainText(
      'Welcome to Procura!'
    );

    // Verify user is redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
  });

  test('first-time dashboard experience', async ({ page }) => {
    // Login as new user (skip signup for this test)
    await page.fill('[data-testid="email-input"]', 'newuser@procura.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="login-button"]');

    // Wait for onboarding to start
    await page.waitForSelector('[data-testid="onboarding-tour"]');

    // Test welcome modal
    await expect(page.locator('[data-testid="welcome-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="welcome-title"]')).toContainText('Welcome to Procura');

    // Test tour steps
    const tourSteps = page.locator('[data-testid="tour-step"]');
    await expect(tourSteps).toHaveCount.greaterThan(0);

    // Navigate through tour steps
    const nextButtons = page.locator('[data-testid="tour-next"]');
    for (let i = 0; i < (await nextButtons.count()); i++) {
      await nextButtons.nth(i).click();
      await page.waitForTimeout(500);
    }

    // Complete tour
    await page.click('[data-testid="tour-complete"]');

    // Verify dashboard is fully visible after tour
    await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();

    // Test empty state with helpful content
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="empty-state"]')).toContainText('Get started by');

    // Test quick start guide
    await expect(page.locator('[data-testid="quick-start"]')).toBeVisible();
    await expect(page.locator('[data-testid="quick-start"]')).toContainText('Quick Start Guide');

    // Test getting started checklist
    await expect(page.locator('[data-testid="checklist"]')).toBeVisible();
    const checklistItems = page.locator('[data-testid="checklist-item"]');
    await expect(checklistItems).toHaveCount.greaterThan(0);

    // Test help system
    await page.click('[data-testid="help-button"]');
    await page.waitForSelector('[data-testid="help-panel"]');
    await expect(page.locator('[data-testid="help-panel"]')).toBeVisible();

    // Test contextual help
    await page.hover('[data-testid="filter-button"]');
    await expect(page.locator('[data-testid="contextual-help"]')).toBeVisible();

    // Test first opportunity creation
    await page.click('[data-testid="create-first-opportunity"]');
    await page.waitForSelector('[data-testid="opportunity-form"]');

    // Fill basic opportunity form
    await page.fill('[data-testid="opportunity-title"]', 'Test Opportunity');
    await page.fill('[data-testid="opportunity-agency"]', 'Test Agency');
    await page.fill('[data-testid="opportunity-description"]', 'Test opportunity description');

    // Save opportunity
    await page.click('[data-testid="save-opportunity-button"]');

    // Verify opportunity created
    await expect(page.locator('[data-testid="opportunity-card"]')).toBeVisible();

    // Test onboarding completion
    await page.click('[data-testid="onboarding-complete"]');
    await expect(page.locator('[data-testid="onboarding-completed"]')).toBeVisible();

    // Verify user is now in regular dashboard mode
    await expect(page.locator('[data-testid="regular-dashboard"]')).toBeVisible();
  });

  test('tutorial and help system functionality', async ({ page }) => {
    // Login
    await page.fill('[data-testid="email-input"]', 'newuser@procura.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard-header"]');

    // Test main help system
    await page.click('[data-testid="help-center"]');
    await page.waitForSelector('[data-testid="help-center-panel"]');

    // Verify help categories
    await expect(page.locator('[data-testid="help-categories"]')).toBeVisible();
    const categories = page.locator('[data-testid="help-category"]');
    await expect(categories).toHaveCount.greaterThan(0);

    // Test searching help content
    await page.fill('[data-testid="help-search"]', 'dashboard');
    await page.waitForTimeout(1000);

    // Verify search results
    await expect(page.locator('[data-testid="help-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="help-results"]')).toContainText('dashboard');

    // Test help article
    await page.click('[data-testid="help-article-link"]');
    await page.waitForSelector('[data-testid="help-article-content"]');
    await expect(page.locator('[data-testid="help-article-content"]')).toBeVisible();

    // Test video tutorials
    await page.click('[data-testid="video-tutorials"]');
    await page.waitForSelector('[data-testid="video-list"]');
    await expect(page.locator('[data-testid="video-list"]')).toBeVisible();

    // Test interactive tutorial
    await page.click('[data-testid="interactive-tutorial"]');
    await page.waitForSelector('[data-testid="tutorial-steps"]');
    await expect(page.locator('[data-testid="tutorial-steps"]')).toBeVisible();

    // Test help chat
    await page.click('[data-testid="help-chat"]');
    await page.waitForSelector('[data-testid="chat-widget"]');
    await expect(page.locator('[data-testid="chat-widget"]')).toBeVisible();

    // Test FAQ section
    await page.click('[data-testid="faq-section"]');
    await page.waitForSelector('[data-testid="faq-list"]');
    await expect(page.locator('[data-testid="faq-list"]')).toBeVisible();

    // Test contact support
    await page.click('[data-testid="contact-support"]');
    await page.waitForSelector('[data-testid="support-form"]');
    await expect(page.locator('[data-testid="support-form"]')).toBeVisible();

    // Test contextual help
    await page.hover('[data-testid="filter-button"]');
    await expect(page.locator('[data-testid="contextual-tooltip"]')).toBeVisible();

    // Test help article bookmarking
    await page.click('[data-testid="bookmark-help-article"]');
    await expect(page.locator('[data-testid="bookmark-confirmation"]')).toBeVisible();

    // Test help history
    await page.click('[data-testid="help-history"]');
    await page.waitForSelector('[data-testid="history-list"]');
    await expect(page.locator('[data-testid="history-list"]')).toBeVisible();

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
  });

  test('email verification workflow', async ({ page }) => {
    // Start signup process
    await page.goto('/signup');
    await page.waitForSelector('[data-testid="signup-form"]');

    // Fill signup form
    await page.fill('[data-testid="signup-name"]', 'Test User');
    await page.fill('[data-testid="signup-email"]', 'testuser@procura.com');
    await page.fill('[data-testid="signup-password"]', 'SecurePass123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'SecurePass123!');

    // Submit signup
    await page.click('[data-testid="signup-submit-button"]');

    // Wait for verification step
    await page.waitForSelector('[data-testid="email-verification"]');

    // Test verification email resent
    await page.click('[data-testid="resend-verification"]');
    await expect(page.locator('[data-testid="verification-resent"]')).toBeVisible();

    // Test verification code entry
    await page.click('[data-testid="enter-code-link"]');
    await page.waitForSelector('[data-testid="verification-code-form"]');

    // Fill verification code (mocked)
    await page.fill('[data-testid="verification-code"]', '123456');
    await page.click('[data-testid="verify-code-button"]');

    // Verify verification success
    await expect(page.locator('[data-testid="verification-success"]')).toBeVisible();

    // Test account activation
    await page.click('[data-testid="activate-account"]');
    await page.waitForSelector('[data-testid="account-activated"]');

    // Test welcome email
    await page.click('[data-testid="view-welcome-email"]');
    await expect(page.locator('[data-testid="welcome-email-content"]')).toBeVisible();

    // Test onboarding completion
    await page.click('[data-testid="complete-onboarding"]');
    await expect(page.locator('[data-testid="onboarding-complete"]')).toBeVisible();

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
  });

  test('initial data population and setup', async ({ page }) => {
    // Login as new user
    await page.fill('[data-testid="email-input"]', 'newuser@procura.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard-header"]');

    // Test data import functionality
    await page.click('[data-testid="import-data"]');
    await page.waitForSelector('[data-testid="import-panel"]');

    // Test CSV import
    await page.click('[data-testid="import-csv"]');
    await page.setInputFiles('[data-testid="csv-file-input"]', './tests/mocks/sample-data.csv');
    await page.click('[data-testid="csv-import-button"]');

    // Verify import progress
    await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();

    // Test API integration setup
    await page.click('[data-testid="api-integration"]');
    await page.waitForSelector('[data-testid="api-setup"]');

    // Test connecting external data sources
    await page.click('[data-testid="connect-source"]');
    await page.selectOption('[data-testid="source-type"]', 'sam_gov');
    await page.fill('[data-testid="api-key"]', 'test-api-key');
    await page.click('[data-testid="connect-button"]');

    // Verify connection success
    await expect(page.locator('[data-testid="connection-success"]')).toBeVisible();

    // Test default preferences setup
    await page.click('[data-testid="preferences"]');
    await page.waitForSelector('[data-testid="preferences-panel"]');

    // Set default filters
    await page.selectOption('[data-testid="default-status"]', 'qualified');
    await page.fill('[data-testid="default-fit-score"]', '80');

    // Save preferences
    await page.click('[data-testid="save-preferences"]');
    await expect(page.locator('[data-testid="preferences-saved"]')).toBeVisible();

    // Test dashboard customization
    await page.click('[data-testid="customize-dashboard"]');
    await page.waitForSelector('[data-testid="dashboard-customizer"]');

    // Add widgets
    await page.click('[data-testid="add-widget"]');
    await page.click('[data-testid="widget-stats"]');
    await page.click('[data-testid="widget-activity"]');

    // Save dashboard layout
    await page.click('[data-testid="save-dashboard"]');
    await expect(page.locator('[data-testid="dashboard-saved"]')).toBeVisible();

    // Test notification setup
    await page.click('[data-testid="notifications"]');
    await page.waitForSelector('[data-testid="notification-settings"]');

    // Enable email notifications
    await page.check('[data-testid="email-notifications"]');
    await page.check('[data-testid="new-opportunities"]');

    // Save notification settings
    await page.click('[data-testid="save-notifications"]');
    await expect(page.locator('[data-testid="notifications-saved"]')).toBeVisible();

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
  });

  test('account management and settings', async ({ page }) => {
    // Login
    await page.fill('[data-testid="email-input"]', 'newuser@procura.com');
    await page.fill('[data-testid="password-input"]', 'SecurePass123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard-header"]');

    // Navigate to account settings
    await page.click('[data-testid="account-settings"]');
    await page.waitForSelector('[data-testid="settings-panel"]');

    // Test profile update
    await page.fill('[data-testid="profile-name"]', 'Updated Name');
    await page.fill('[data-testid="profile-company"]', 'Updated Company');
    await page.fill('[data-testid="profile-phone"]', '+1234567890');

    // Save profile
    await page.click('[data-testid="save-profile"]');
    await expect(page.locator('[data-testid="profile-saved"]')).toBeVisible();

    // Test password change
    await page.click('[data-testid="change-password"]');
    await page.waitForSelector('[data-testid="password-change-form"]');

    await page.fill('[data-testid="current-password"]', 'SecurePass123!');
    await page.fill('[data-testid="new-password"]', 'NewSecurePass123!');
    await page.fill('[data-testid="confirm-new-password"]', 'NewSecurePass123!');

    await page.click('[data-testid="update-password"]');
    await expect(page.locator('[data-testid="password-updated"]')).toBeVisible();

    // Test subscription management
    await page.click('[data-testid="subscription"]');
    await page.waitForSelector('[data-testid="subscription-panel"]');

    // View current plan
    await expect(page.locator('[data-testid="current-plan"]')).toBeVisible();

    // Test upgrade option
    await page.click('[data-testid="upgrade-plan"]');
    await page.waitForSelector('[data-testid="upgrade-options"]');
    await expect(page.locator('[data-testid="upgrade-options"]')).toBeVisible();

    // Test billing information
    await page.click('[data-testid="billing-info"]');
    await page.waitForSelector('[data-testid="billing-form"]');

    await page.fill('[data-testid="billing-name"]', 'Test User');
    await page.fill('[data-testid="billing-address"]', '123 Test St');
    await page.fill('[data-testid="billing-city"]', 'Test City');
    await page.fill('[data-testid="billing-zip"]', '12345');

    await page.click('[data-testid="save-billing"]');
    await expect(page.locator('[data-testid="billing-saved"]')).toBeVisible();

    // Test API key management
    await page.click('[data-testid="api-keys"]');
    await page.waitForSelector('[data-testid="api-keys-panel"]');

    // Generate new API key
    await page.click('[data-testid="generate-api-key"]');
    await expect(page.locator('[data-testid="api-key-generated"]')).toBeVisible();

    // Test integration settings
    await page.click('[data-testid="integrations"]');
    await page.waitForSelector('[data-testid="integrations-panel"]');

    // Connect Slack integration
    await page.click('[data-testid="connect-slack"]');
    await page.fill(
      '[data-testid="slack-webhook"]',
      'https://hooks.slack.com/services/T123/B456/XYZ'
    );
    await page.click('[data-testid="save-slack"]');

    await expect(page.locator('[data-testid="slack-connected"]')).toBeVisible();

    // Test export preferences
    await page.click('[data-testid="export-preferences"]');
    await page.waitForSelector('[data-testid="export-settings"]');

    // Set default export format
    await page.selectOption('[data-testid="default-format"]', 'csv');
    await page.check('[data-testid="include-metadata"]');

    await page.click('[data-testid="save-export"]');
    await expect(page.locator('[data-testid="export-saved"]')).toBeVisible();

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
  });

  // Meta-cognitive debug protocol tags used:
  // [UI_STATE] - UI interaction and state management
  // [ASYNC_TIMING] - Form submission timing and loading states
  // [EXTERNAL_DEPENDENCY] - Mocked API responses for onboarding
  // [DATA_CORRUPTION] - Data consistency during onboarding
});
