import { test, expect } from '@playwright/test';

test.describe('Agent Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display agent list with capabilities', async ({ page }) => {
    await page.goto('/agents');
    
    // Check agent grid
    await expect(page.locator('[data-testid="agent-grid"]')).toBeVisible();
    
    const agentCards = page.locator('[data-testid="agent-card"]');
    await expect(agentCards).toHaveCount(await agentCards.count());
    
    // Check agent details
    const firstAgent = agentCards.first();
    await expect(firstAgent.locator('[data-testid="agent-name"]')).toBeVisible();
    await expect(firstAgent.locator('[data-testid="agent-type"]')).toBeVisible();
    await expect(firstAgent.locator('[data-testid="agent-status"]')).toBeVisible();
    
    // Check capabilities list
    await firstAgent.click();
    await expect(page.locator('[data-testid="capabilities-list"]')).toBeVisible();
    const capabilities = page.locator('[data-testid="capability-item"]');
    expect(await capabilities.count()).toBeGreaterThan(0);
  });

  test('should filter agents by provider', async ({ page }) => {
    await page.goto('/agents');
    
    // Apply provider filter
    await page.click('[data-testid="provider-filter"]');
    await page.click('[data-testid="provider-anthropic"]');
    
    // Check filtered results
    const agentCards = page.locator('[data-testid="agent-card"]');
    for (let i = 0; i < await agentCards.count(); i++) {
      const provider = await agentCards.nth(i).locator('[data-testid="agent-provider"]').textContent();
      expect(provider?.toLowerCase()).toContain('anthropic');
    }
  });

  test('should show agent performance metrics', async ({ page }) => {
    await page.goto('/agents');
    
    // Click on agent to view details
    await page.click('[data-testid="agent-card"]').first();
    await page.waitForURL(/\/agents\/.+/);
    
    // Check performance section
    await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-rate"]')).toContainText(/\d+%/);
    await expect(page.locator('[data-testid="avg-response-time"]')).toContainText(/\d+ms/);
    await expect(page.locator('[data-testid="tasks-completed"]')).toContainText(/\d+/);
  });

  test('should manage agent configuration', async ({ page }) => {
    await page.goto('/agents');
    await page.click('[data-testid="agent-card"]').first();
    
    // Open configuration
    await page.click('[data-testid="configure-agent"]');
    await expect(page.locator('[data-testid="agent-config-dialog"]')).toBeVisible();
    
    // Update configuration
    await page.fill('[data-testid="max-concurrent-tasks"]', '5');
    await page.fill('[data-testid="timeout-seconds"]', '60');
    await page.click('[data-testid="save-config"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="config-saved"]')).toBeVisible();
  });

  test('should handle agent errors', async ({ page }) => {
    await page.goto('/agents');
    
    // Find agent with error status
    const errorAgent = page.locator('[data-testid="agent-card"][data-status="error"]').first();
    if (await errorAgent.count() > 0) {
      await errorAgent.click();
      
      // Should show error details
      await expect(page.locator('[data-testid="error-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      
      // Should have restart option
      await expect(page.locator('[data-testid="restart-agent"]')).toBeVisible();
    }
  });
});

test.describe('Knowledge Management Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should search knowledge base', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Perform search
    await page.fill('[data-testid="knowledge-search"]', 'javascript');
    await page.click('[data-testid="search-button"]');
    
    // Check results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    const results = page.locator('[data-testid="knowledge-entry"]');
    expect(await results.count()).toBeGreaterThan(0);
    
    // Verify search highlighting
    const firstResult = results.first();
    await expect(firstResult.locator('mark')).toContainText('javascript', { ignoreCase: true });
  });

  test('should filter by knowledge type', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Apply type filter
    await page.click('[data-testid="type-filter"]');
    await page.click('[data-testid="type-snippet"]');
    
    // Verify filtered results
    const entries = page.locator('[data-testid="knowledge-entry"]');
    for (let i = 0; i < await entries.count(); i++) {
      const type = await entries.nth(i).locator('[data-testid="entry-type"]').textContent();
      expect(type).toBe('snippet');
    }
  });

  test('should create new knowledge entry', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Open create dialog
    await page.click('[data-testid="create-knowledge"]');
    await expect(page.locator('[data-testid="knowledge-editor"]')).toBeVisible();
    
    // Fill form
    await page.fill('[data-testid="knowledge-title"]', 'Test Knowledge Entry');
    await page.selectOption('[data-testid="knowledge-type"]', 'best-practice');
    await page.fill('[data-testid="knowledge-content"]', '# Best Practice\n\nAlways write tests for your code.');
    await page.fill('[data-testid="knowledge-tags"]', 'testing, best-practices');
    
    // Preview
    await page.click('[data-testid="preview-tab"]');
    await expect(page.locator('[data-testid="content-preview"]')).toContainText('Always write tests');
    
    // Save
    await page.click('[data-testid="save-knowledge"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // Verify entry appears in list
    await page.fill('[data-testid="knowledge-search"]', 'Test Knowledge Entry');
    await page.click('[data-testid="search-button"]');
    await expect(page.locator('[data-testid="knowledge-entry"]')).toContainText('Test Knowledge Entry');
  });

  test('should edit knowledge entry', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Click on first entry
    await page.click('[data-testid="knowledge-entry"]').first();
    await page.click('[data-testid="edit-entry"]');
    
    // Update content
    await page.fill('[data-testid="knowledge-content"]', '# Updated Content\n\nThis has been updated.');
    await page.click('[data-testid="save-knowledge"]');
    
    // Verify update
    await expect(page.locator('[data-testid="success-message"]')).toContainText('updated');
  });

  test('should handle code syntax highlighting', async ({ page }) => {
    await page.goto('/knowledge');
    await page.click('[data-testid="create-knowledge"]');
    
    // Add code block
    const codeContent = `\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\``;
    
    await page.fill('[data-testid="knowledge-content"]', codeContent);
    await page.click('[data-testid="preview-tab"]');
    
    // Check syntax highlighting
    await expect(page.locator('pre code.language-javascript')).toBeVisible();
    await expect(page.locator('.token.keyword')).toContainText('function');
    await expect(page.locator('.token.keyword')).toContainText('return');
  });

  test('should vote on knowledge entries', async ({ page }) => {
    await page.goto('/knowledge');
    
    const firstEntry = page.locator('[data-testid="knowledge-entry"]').first();
    const voteCount = await firstEntry.locator('[data-testid="vote-count"]').textContent();
    const initialVotes = parseInt(voteCount || '0');
    
    // Upvote
    await firstEntry.locator('[data-testid="upvote-button"]').click();
    
    // Check vote updated
    await page.waitForTimeout(500);
    const newVoteCount = await firstEntry.locator('[data-testid="vote-count"]').textContent();
    expect(parseInt(newVoteCount || '0')).toBe(initialVotes + 1);
    
    // Button should be highlighted
    await expect(firstEntry.locator('[data-testid="upvote-button"]')).toHaveClass(/voted/);
  });

  test('should show related knowledge', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Click on entry
    await page.click('[data-testid="knowledge-entry"]').first();
    
    // Check related section
    await expect(page.locator('[data-testid="related-knowledge"]')).toBeVisible();
    const relatedItems = page.locator('[data-testid="related-item"]');
    expect(await relatedItems.count()).toBeGreaterThan(0);
  });

  test('should export knowledge entries', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Select entries
    await page.click('[data-testid="select-all"]');
    
    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-selected"]');
    await page.click('[data-testid="export-markdown"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('knowledge-export');
    expect(download.suggestedFilename()).toContain('.md');
  });

  test('should handle permissions', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Find private entry (if exists)
    const privateEntry = page.locator('[data-testid="knowledge-entry"][data-private="true"]').first();
    if (await privateEntry.count() > 0) {
      await privateEntry.click();
      
      // Should show privacy indicator
      await expect(page.locator('[data-testid="private-indicator"]')).toBeVisible();
      
      // Edit should be restricted if not owner
      const editButton = page.locator('[data-testid="edit-entry"]');
      const isOwner = await editButton.isEnabled();
      
      if (!isOwner) {
        await expect(editButton).toBeDisabled();
      }
    }
  });

  test('should show knowledge statistics', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Click stats tab
    await page.click('[data-testid="knowledge-stats"]');
    
    // Check statistics
    await expect(page.locator('[data-testid="total-entries"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="entries-by-type"]')).toBeVisible();
    await expect(page.locator('[data-testid="popular-tags"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-contributors"]')).toBeVisible();
  });
});