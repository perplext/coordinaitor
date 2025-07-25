import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('http://localhost:3001/agents');
  });

  test('should display agents list', async ({ page }) => {
    await expect(page.locator('h1:has-text("Agents")')).toBeVisible();
    await expect(page.locator('[data-testid="agents-grid"]')).toBeVisible();
    
    // Verify at least one agent is displayed
    const agentCards = page.locator('[data-testid="agent-card"]');
    await expect(agentCards).toHaveCount(4, { timeout: 5000 });
  });

  test('should show agent details', async ({ page }) => {
    // Click on first agent card
    await page.click('[data-testid="agent-card"]:first-child');
    
    // Verify agent detail modal/page
    await expect(page.locator('[data-testid="agent-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-capabilities"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-metrics"]')).toBeVisible();
  });

  test('should filter agents by provider', async ({ page }) => {
    // Apply provider filter
    await page.click('[data-testid="provider-filter"]');
    await page.click('text=Anthropic');
    
    // Verify filtered results
    const agentCards = page.locator('[data-testid="agent-card"]');
    const count = await agentCards.count();
    
    for (let i = 0; i < count; i++) {
      const provider = await agentCards.nth(i).locator('[data-testid="agent-provider"]').textContent();
      expect(provider).toBe('Anthropic');
    }
  });

  test('should filter agents by capability', async ({ page }) => {
    // Apply capability filter
    await page.click('[data-testid="capability-filter"]');
    await page.click('text=Development');
    
    // Verify filtered results show agents with development capability
    const agentCards = page.locator('[data-testid="agent-card"]');
    const count = await agentCards.count();
    
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      const capabilities = await agentCards.nth(i).locator('[data-testid="agent-capabilities"]').textContent();
      expect(capabilities).toContain('development');
    }
  });

  test('should configure agent settings', async ({ page }) => {
    // Open first agent's settings
    await page.click('[data-testid="agent-card"]:first-child [data-testid="agent-settings"]');
    
    // Modify settings
    await page.fill('input[name="maxConcurrentTasks"]', '10');
    await page.fill('input[name="timeout"]', '300000');
    await page.selectOption('select[name="model"]', { index: 1 });
    
    // Save settings
    await page.click('button:has-text("Save Configuration")');
    
    // Verify success message
    await expect(page.locator('text=Configuration saved successfully')).toBeVisible();
  });

  test('should view agent performance metrics', async ({ page }) => {
    // Click on agent performance tab/button
    await page.click('[data-testid="agent-card"]:first-child');
    await page.click('[data-testid="performance-tab"]');
    
    // Verify metrics are displayed
    await expect(page.locator('[data-testid="success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="tasks-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
  });

  test('should enable/disable agent', async ({ page }) => {
    // Find an active agent
    const activeAgent = page.locator('[data-testid="agent-card"]:has([data-testid="agent-status"]:has-text("Active"))').first();
    
    // Click disable button
    await activeAgent.locator('[data-testid="agent-toggle"]').click();
    
    // Confirm action
    await page.click('button:has-text("Confirm")');
    
    // Verify status changed
    await expect(activeAgent.locator('[data-testid="agent-status"]')).toHaveText('Inactive');
  });

  test('should test agent connection', async ({ page }) => {
    // Open first agent's details
    await page.click('[data-testid="agent-card"]:first-child');
    
    // Click test connection
    await page.click('[data-testid="test-connection"]');
    
    // Wait for test to complete
    await expect(page.locator('text=Testing connection...')).toBeVisible();
    await expect(page.locator('text=Connection successful')).toBeVisible({ timeout: 10000 });
  });

  test('should view agent logs', async ({ page }) => {
    // Open agent details
    await page.click('[data-testid="agent-card"]:first-child');
    
    // Navigate to logs tab
    await page.click('[data-testid="logs-tab"]');
    
    // Verify logs are displayed
    await expect(page.locator('[data-testid="agent-logs"]')).toBeVisible();
    await expect(page.locator('[data-testid="log-entry"]').first()).toBeVisible();
    
    // Test log filtering
    await page.selectOption('[data-testid="log-level-filter"]', 'error');
    
    // Verify filtered logs
    const logEntries = page.locator('[data-testid="log-entry"]');
    const count = await logEntries.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const level = await logEntries.nth(i).locator('[data-testid="log-level"]').textContent();
        expect(level).toBe('ERROR');
      }
    }
  });

  test('should compare agents', async ({ page }) => {
    // Select agents for comparison
    await page.click('[data-testid="compare-mode"]');
    await page.click('[data-testid="agent-card"]:nth-child(1) [data-testid="compare-checkbox"]');
    await page.click('[data-testid="agent-card"]:nth-child(2) [data-testid="compare-checkbox"]');
    
    // Open comparison view
    await page.click('[data-testid="compare-button"]');
    
    // Verify comparison table
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-metric"]')).toHaveCount(5, { timeout: 5000 });
  });

  test('should manage agent API keys', async ({ page }) => {
    // Open agent settings
    await page.click('[data-testid="agent-card"]:first-child [data-testid="agent-settings"]');
    
    // Navigate to API keys section
    await page.click('[data-testid="api-keys-tab"]');
    
    // Add new API key
    await page.click('[data-testid="add-api-key"]');
    await page.fill('input[name="apiKeyName"]', 'Test API Key');
    await page.fill('input[name="apiKeyValue"]', 'test-key-12345');
    await page.click('button:has-text("Add Key")');
    
    // Verify key added (should be masked)
    await expect(page.locator('text=Test API Key')).toBeVisible();
    await expect(page.locator('text=test-key-12345')).not.toBeVisible();
    await expect(page.locator('text=••••••12345')).toBeVisible();
  });
});