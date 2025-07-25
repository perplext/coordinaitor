import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('http://localhost:3001/tasks');
  });

  test('should display tasks list', async ({ page }) => {
    await expect(page.locator('h1:has-text("Tasks")')).toBeVisible();
    await expect(page.locator('[data-testid="tasks-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-task-button"]')).toBeVisible();
  });

  test('should create a new task', async ({ page }) => {
    await page.click('[data-testid="create-task-button"]');
    
    // Fill task form
    await page.fill('input[name="title"]', 'Test Task Creation');
    await page.fill('textarea[name="description"]', 'This is a test task created by Playwright');
    await page.selectOption('select[name="priority"]', 'high');
    await page.selectOption('select[name="type"]', 'development');
    
    await page.click('button:has-text("Create Task")');
    
    // Verify task appears in list
    await expect(page.locator('text=Test Task Creation')).toBeVisible({ timeout: 5000 });
  });

  test('should filter tasks by status', async ({ page }) => {
    // Click on status filter
    await page.click('[data-testid="status-filter"]');
    await page.click('text=In Progress');
    
    // Verify only in-progress tasks are shown
    const tasks = page.locator('[data-testid="task-card"]');
    const count = await tasks.count();
    
    for (let i = 0; i < count; i++) {
      const status = await tasks.nth(i).locator('[data-testid="task-status"]').textContent();
      expect(status).toBe('In Progress');
    }
  });

  test('should search tasks', async ({ page }) => {
    const searchTerm = 'authentication';
    
    await page.fill('[data-testid="task-search"]', searchTerm);
    await page.press('[data-testid="task-search"]', 'Enter');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Verify search results contain the search term
    const tasks = page.locator('[data-testid="task-card"]');
    const count = await tasks.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const taskText = await tasks.nth(i).textContent();
        expect(taskText?.toLowerCase()).toContain(searchTerm);
      }
    }
  });

  test('should view task details', async ({ page }) => {
    // Click on first task
    await page.click('[data-testid="task-card"]:first-child');
    
    // Verify task detail page
    await expect(page.locator('[data-testid="task-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-metadata"]')).toBeVisible();
  });

  test('should update task status', async ({ page }) => {
    // Click on first task
    await page.click('[data-testid="task-card"]:first-child');
    
    // Change status
    await page.click('[data-testid="status-dropdown"]');
    await page.click('text=Completed');
    
    // Verify status changed
    await expect(page.locator('[data-testid="task-status"]:has-text("Completed")')).toBeVisible();
  });

  test('should assign task to agent', async ({ page }) => {
    // Click on first unassigned task
    await page.click('[data-testid="task-card"]:has-text("Unassigned"):first-child');
    
    // Open agent assignment
    await page.click('[data-testid="assign-agent-button"]');
    
    // Select an agent
    await page.click('[data-testid="agent-option"]:first-child');
    await page.click('button:has-text("Assign")');
    
    // Verify assignment
    await expect(page.locator('[data-testid="assigned-agent"]')).toBeVisible();
  });

  test('should handle task creation with natural language', async ({ page }) => {
    await page.click('[data-testid="natural-language-button"]');
    
    const nlInput = 'Create a REST API for user management with authentication';
    await page.fill('[data-testid="nl-input"]', nlInput);
    await page.click('button:has-text("Analyze")');
    
    // Wait for NLP processing
    await expect(page.locator('[data-testid="nl-results"]')).toBeVisible({ timeout: 10000 });
    
    // Verify suggested tasks
    await expect(page.locator('text=Suggested Tasks')).toBeVisible();
    await expect(page.locator('[data-testid="suggested-task"]')).toHaveCount(3, { timeout: 5000 });
    
    // Create tasks from suggestions
    await page.click('button:has-text("Create All Tasks")');
    
    // Verify tasks created
    await expect(page.locator('text=Tasks created successfully')).toBeVisible();
  });

  test('should bulk update tasks', async ({ page }) => {
    // Enable bulk selection
    await page.click('[data-testid="bulk-select-toggle"]');
    
    // Select multiple tasks
    await page.click('[data-testid="task-checkbox"]:nth-child(1)');
    await page.click('[data-testid="task-checkbox"]:nth-child(2)');
    await page.click('[data-testid="task-checkbox"]:nth-child(3)');
    
    // Open bulk actions
    await page.click('[data-testid="bulk-actions-button"]');
    await page.click('text=Update Priority');
    await page.selectOption('select[name="priority"]', 'critical');
    await page.click('button:has-text("Apply")');
    
    // Verify update
    await expect(page.locator('text=3 tasks updated')).toBeVisible();
  });

  test('should export tasks', async ({ page }) => {
    // Start download promise before clicking
    const downloadPromise = page.waitForEvent('download');
    
    await page.click('[data-testid="export-button"]');
    await page.click('text=Export as CSV');
    
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/tasks.*\.csv/);
  });
});