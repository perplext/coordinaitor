import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('h2:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');

    await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 5000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@orchestrator.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.fill('input[type="email"]', 'admin@orchestrator.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL(/.*dashboard/);

    // Then logout
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Logout');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h2:has-text("Sign In")')).toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.click('text=Sign Up');
    
    await expect(page.locator('h2:has-text("Create Account")')).toBeVisible();
    await expect(page.locator('input[placeholder="First Name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Last Name"]')).toBeVisible();
  });

  test('should register new user', async ({ page }) => {
    await page.click('text=Sign Up');
    
    const timestamp = Date.now();
    const email = `testuser${timestamp}@test.com`;
    
    await page.fill('input[placeholder="First Name"]', 'Test');
    await page.fill('input[placeholder="Last Name"]', 'User');
    await page.fill('input[placeholder="Email"]', email);
    await page.fill('input[placeholder="Password"]', 'TestPassword123!');
    await page.fill('input[placeholder="Confirm Password"]', 'TestPassword123!');
    await page.fill('input[placeholder="Organization Name"]', `Test Org ${timestamp}`);
    
    await page.click('button:has-text("Create Account")');
    
    // Should login and redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
  });

  test('should handle session expiry', async ({ page, context }) => {
    // Login
    await page.fill('input[type="email"]', 'admin@orchestrator.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL(/.*dashboard/);

    // Clear cookies to simulate session expiry
    await context.clearCookies();
    
    // Try to navigate to protected route
    await page.goto('http://localhost:3001/tasks');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should persist login state on page refresh', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', 'admin@orchestrator.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL(/.*dashboard/);

    // Refresh page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});