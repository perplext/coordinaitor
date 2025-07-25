import { Page } from '@playwright/test';

export async function loginAsAdmin(page: Page) {
  await page.goto('http://localhost:3001');
  await page.fill('input[type="email"]', 'admin@orchestrator.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(/.*dashboard/, { timeout: 10000 });
}

export async function loginAsUser(page: Page) {
  await page.goto('http://localhost:3001');
  await page.fill('input[type="email"]', 'demo@orchestrator.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(/.*dashboard/, { timeout: 10000 });
}

export async function loginAsViewer(page: Page) {
  await page.goto('http://localhost:3001');
  await page.fill('input[type="email"]', 'viewer@orchestrator.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(/.*dashboard/, { timeout: 10000 });
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('text=Logout');
  await page.waitForURL(/.*login/);
}