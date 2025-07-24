import { test, expect, Page } from '@playwright/test';

test.describe('Dashboard Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display dashboard overview', async () => {
    // Check main dashboard elements
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-tasks"]')).toBeVisible();
    await expect(page.locator('[data-testid="agent-status"]')).toBeVisible();
  });

  test('should show real-time statistics', async () => {
    // Check stat cards
    const statCards = page.locator('[data-testid="stat-card"]');
    await expect(statCards).toHaveCount(4);
    
    // Verify stat values are displayed
    const totalTasks = page.locator('[data-testid="stat-total-tasks"]');
    await expect(totalTasks).toContainText(/\d+/);
    
    const activeTasks = page.locator('[data-testid="stat-active-tasks"]');
    await expect(activeTasks).toContainText(/\d+/);
    
    const completedTasks = page.locator('[data-testid="stat-completed-tasks"]');
    await expect(completedTasks).toContainText(/\d+/);
    
    const successRate = page.locator('[data-testid="stat-success-rate"]');
    await expect(successRate).toContainText(/\d+%/);
  });

  test('should display activity chart', async () => {
    const chart = page.locator('[data-testid="activity-chart"]');
    await expect(chart).toBeVisible();
    
    // Check chart has rendered (canvas element should exist)
    const canvas = chart.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Verify chart controls
    const timeRangeSelector = page.locator('[data-testid="chart-time-range"]');
    await expect(timeRangeSelector).toBeVisible();
    
    // Change time range
    await timeRangeSelector.click();
    await page.click('[data-testid="time-range-week"]');
    
    // Chart should update (wait for animation)
    await page.waitForTimeout(500);
  });

  test('should show recent tasks with live updates', async () => {
    const recentTasks = page.locator('[data-testid="recent-tasks"]');
    await expect(recentTasks).toBeVisible();
    
    // Check task items
    const taskItems = recentTasks.locator('[data-testid="recent-task-item"]');
    const count = await taskItems.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify task information is displayed
    const firstTask = taskItems.first();
    await expect(firstTask.locator('[data-testid="task-title"]')).toBeVisible();
    await expect(firstTask.locator('[data-testid="task-status"]')).toBeVisible();
    await expect(firstTask.locator('[data-testid="task-time"]')).toBeVisible();
    
    // Test refresh button
    await page.click('[data-testid="refresh-recent-tasks"]');
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('should display agent status grid', async () => {
    const agentGrid = page.locator('[data-testid="agent-status-grid"]');
    await expect(agentGrid).toBeVisible();
    
    // Check agent cards
    const agentCards = agentGrid.locator('[data-testid="agent-card"]');
    const count = await agentCards.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify agent information
    const firstAgent = agentCards.first();
    await expect(firstAgent.locator('[data-testid="agent-name"]')).toBeVisible();
    await expect(firstAgent.locator('[data-testid="agent-status"]')).toBeVisible();
    await expect(firstAgent.locator('[data-testid="agent-provider"]')).toBeVisible();
    
    // Check status indicators
    const statusIndicator = firstAgent.locator('[data-testid="status-indicator"]');
    await expect(statusIndicator).toHaveClass(/status-(idle|busy|error|offline)/);
  });

  test('should navigate to different sections', async () => {
    // Click on total tasks stat card
    await page.click('[data-testid="stat-total-tasks"]');
    await page.waitForURL('**/tasks');
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();
    
    // Go back to dashboard
    await page.goBack();
    
    // Click on agent card
    await page.click('[data-testid="agent-card"]').first();
    await page.waitForURL(/\/agents\/.+/);
    await expect(page.locator('[data-testid="agent-detail"]')).toBeVisible();
  });

  test('should handle quick actions', async () => {
    // Test create task quick action
    await page.click('[data-testid="quick-create-task"]');
    await expect(page.locator('[data-testid="create-task-dialog"]')).toBeVisible();
    
    // Fill quick task form
    await page.fill('[data-testid="quick-task-title"]', 'Quick Task from Dashboard');
    await page.selectOption('[data-testid="quick-task-priority"]', 'high');
    await page.click('[data-testid="quick-task-submit"]');
    
    // Should show success notification
    await expect(page.locator('[data-testid="notification-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-success"]')).toContainText('Task created');
  });

  test('should display performance metrics', async () => {
    const performanceSection = page.locator('[data-testid="performance-metrics"]');
    await expect(performanceSection).toBeVisible();
    
    // Check average completion time
    const avgTime = performanceSection.locator('[data-testid="avg-completion-time"]');
    await expect(avgTime).toContainText(/\d+\s*(minutes|hours)/);
    
    // Check agent utilization
    const utilization = performanceSection.locator('[data-testid="agent-utilization"]');
    await expect(utilization).toContainText(/\d+%/);
    
    // Check cost metrics
    const costMetrics = performanceSection.locator('[data-testid="cost-metrics"]');
    await expect(costMetrics).toContainText(/\$\d+/);
  });

  test('should update in real-time', async () => {
    // Get initial task count
    const initialCount = await page.locator('[data-testid="stat-total-tasks"]').textContent();
    
    // Create a new task in another tab
    const newPage = await page.context().newPage();
    await newPage.goto('/login');
    await newPage.fill('[data-testid="username-input"]', 'testuser');
    await newPage.fill('[data-testid="password-input"]', 'TestPass123!');
    await newPage.click('[data-testid="login-submit"]');
    await newPage.waitForURL('**/dashboard');
    
    await newPage.goto('/tasks');
    await newPage.click('[data-testid="create-task-button"]');
    await newPage.fill('[data-testid="task-title-input"]', 'Real-time Test Task');
    await newPage.fill('[data-testid="task-description-input"]', 'Testing real-time updates');
    await newPage.click('[data-testid="create-task-submit"]');
    
    // Check if dashboard updates
    await page.waitForTimeout(2000); // Wait for WebSocket update
    const newCount = await page.locator('[data-testid="stat-total-tasks"]').textContent();
    expect(parseInt(newCount || '0')).toBeGreaterThan(parseInt(initialCount || '0'));
    
    await newPage.close();
  });

  test('should show system health indicators', async () => {
    const systemHealth = page.locator('[data-testid="system-health"]');
    await expect(systemHealth).toBeVisible();
    
    // Check API status
    const apiStatus = systemHealth.locator('[data-testid="api-status"]');
    await expect(apiStatus).toHaveClass(/health-(good|warning|error)/);
    
    // Check database status
    const dbStatus = systemHealth.locator('[data-testid="db-status"]');
    await expect(dbStatus).toHaveClass(/health-(good|warning|error)/);
    
    // Check WebSocket status
    const wsStatus = systemHealth.locator('[data-testid="ws-status"]');
    await expect(wsStatus).toHaveClass(/health-(good|warning|error)/);
  });

  test('should be responsive on mobile', async ({ viewport }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check mobile menu
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-drawer"]')).toBeVisible();
    
    // Check that stats are stacked vertically
    const statCards = page.locator('[data-testid="stat-card"]');
    const firstCard = await statCards.first().boundingBox();
    const secondCard = await statCards.nth(1).boundingBox();
    
    expect(firstCard?.y).toBeLessThan(secondCard?.y || 0);
    expect(firstCard?.x).toBe(secondCard?.x);
  });

  test('should export dashboard data', async () => {
    // Click export button
    await page.click('[data-testid="export-dashboard-data"]');
    
    // Select export format
    await expect(page.locator('[data-testid="export-dialog"]')).toBeVisible();
    await page.click('[data-testid="export-format-csv"]');
    
    // Start download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-confirm"]');
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('dashboard-export');
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should handle errors gracefully', async () => {
    // Simulate network error
    await page.route('**/api/dashboard/stats', route => {
      route.abort('failed');
    });
    
    // Refresh page
    await page.reload();
    
    // Should show error state
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load');
    
    // Should have retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Fix network and retry
    await page.unroute('**/api/dashboard/stats');
    await page.click('[data-testid="retry-button"]');
    
    // Should load successfully
    await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();
  });
});