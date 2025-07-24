import puppeteer, { Browser, Page } from 'puppeteer';

describe('Task Management E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.BASE_URL || 'http://localhost:5173';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Login before each test
    await page.goto(`${baseUrl}/login`);
    await page.waitForSelector('[data-testid="login-form"]');
    await page.type('[data-testid="username-input"]', 'testuser');
    await page.type('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-submit"]');
    await page.waitForNavigation();
  });

  afterEach(async () => {
    await page.close();
  });

  describe('Task List', () => {
    it('should display task list', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-list"]');
      
      // Check for task cards
      const taskCards = await page.$$('[data-testid="task-card"]');
      expect(taskCards.length).toBeGreaterThanOrEqual(0);
      
      // Check for filters
      const statusFilter = await page.$('[data-testid="status-filter"]');
      const priorityFilter = await page.$('[data-testid="priority-filter"]');
      const typeFilter = await page.$('[data-testid="type-filter"]');
      
      expect(statusFilter).toBeTruthy();
      expect(priorityFilter).toBeTruthy();
      expect(typeFilter).toBeTruthy();
    });

    it('should filter tasks by status', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-list"]');
      
      // Click status filter
      await page.click('[data-testid="status-filter"]');
      await page.waitForSelector('[data-testid="status-pending"]');
      await page.click('[data-testid="status-pending"]');
      
      // Wait for filtered results
      await page.waitForTimeout(500);
      
      // Check all visible tasks have pending status
      const taskStatuses = await page.$$eval(
        '[data-testid="task-status"]',
        elements => elements.map(el => el.textContent)
      );
      
      taskStatuses.forEach(status => {
        expect(status?.toLowerCase()).toContain('pending');
      });
    });

    it('should sort tasks', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-list"]');
      
      // Click sort dropdown
      await page.click('[data-testid="sort-dropdown"]');
      await page.waitForSelector('[data-testid="sort-priority"]');
      await page.click('[data-testid="sort-priority"]');
      
      // Wait for sort to apply
      await page.waitForTimeout(500);
      
      // Get task priorities
      const priorities = await page.$$eval(
        '[data-testid="task-priority"]',
        elements => elements.map(el => el.textContent)
      );
      
      // Check if sorted (critical should come first)
      const priorityOrder = ['critical', 'high', 'medium', 'low'];
      let lastIndex = -1;
      
      priorities.forEach(priority => {
        const index = priorityOrder.indexOf(priority?.toLowerCase() || '');
        expect(index).toBeGreaterThanOrEqual(lastIndex);
        if (index > lastIndex) lastIndex = index;
      });
    });
  });

  describe('Task Creation', () => {
    it('should open create task dialog', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      await page.click('[data-testid="create-task-button"]');
      await page.waitForSelector('[data-testid="create-task-dialog"]');
      
      // Check form fields
      const titleInput = await page.$('[data-testid="task-title-input"]');
      const descriptionInput = await page.$('[data-testid="task-description-input"]');
      const typeSelect = await page.$('[data-testid="task-type-select"]');
      const prioritySelect = await page.$('[data-testid="task-priority-select"]');
      
      expect(titleInput).toBeTruthy();
      expect(descriptionInput).toBeTruthy();
      expect(typeSelect).toBeTruthy();
      expect(prioritySelect).toBeTruthy();
    });

    it('should create new task', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      // Open dialog
      await page.click('[data-testid="create-task-button"]');
      await page.waitForSelector('[data-testid="create-task-dialog"]');
      
      // Fill form
      const taskTitle = `Test Task ${Date.now()}`;
      await page.type('[data-testid="task-title-input"]', taskTitle);
      await page.type('[data-testid="task-description-input"]', 'Test task description');
      
      // Select type
      await page.click('[data-testid="task-type-select"]');
      await page.waitForSelector('[data-testid="type-implementation"]');
      await page.click('[data-testid="type-implementation"]');
      
      // Select priority
      await page.click('[data-testid="task-priority-select"]');
      await page.waitForSelector('[data-testid="priority-high"]');
      await page.click('[data-testid="priority-high"]');
      
      // Submit
      await page.click('[data-testid="create-task-submit"]');
      
      // Wait for dialog to close and task to appear
      await page.waitForSelector(`text=${taskTitle}`);
      
      // Verify task appears in list
      const newTaskCard = await page.$(`[data-testid="task-card"]:has-text("${taskTitle}")`);
      expect(newTaskCard).toBeTruthy();
    });

    it('should validate required fields', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.click('[data-testid="create-task-button"]');
      await page.waitForSelector('[data-testid="create-task-dialog"]');
      
      // Try to submit empty form
      await page.click('[data-testid="create-task-submit"]');
      
      // Check for validation errors
      await page.waitForSelector('.MuiFormHelperText-root');
      const errorTexts = await page.$$eval(
        '.MuiFormHelperText-root',
        elements => elements.map(el => el.textContent)
      );
      
      expect(errorTexts).toContain('Title is required');
      expect(errorTexts).toContain('Description is required');
    });
  });

  describe('Task Detail View', () => {
    it('should navigate to task detail', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Click first task
      const firstTask = await page.$('[data-testid="task-card"]');
      await firstTask?.click();
      
      // Should navigate to detail page
      await page.waitForNavigation();
      expect(page.url()).toMatch(/\/tasks\/[a-zA-Z0-9-]+/);
      
      // Check detail elements
      await page.waitForSelector('[data-testid="task-detail"]');
      const taskTitle = await page.$('[data-testid="task-detail-title"]');
      const taskStatus = await page.$('[data-testid="task-detail-status"]');
      const taskDescription = await page.$('[data-testid="task-detail-description"]');
      
      expect(taskTitle).toBeTruthy();
      expect(taskStatus).toBeTruthy();
      expect(taskDescription).toBeTruthy();
    });

    it('should execute task', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Navigate to first pending task
      await page.click('[data-testid="task-card"][data-status="pending"]');
      await page.waitForNavigation();
      
      // Click execute button
      await page.waitForSelector('[data-testid="execute-task-button"]');
      await page.click('[data-testid="execute-task-button"]');
      
      // Wait for execution to start
      await page.waitForSelector('[data-testid="task-executing"]');
      
      // Check status change
      const statusText = await page.$eval(
        '[data-testid="task-detail-status"]',
        el => el.textContent
      );
      expect(['assigned', 'in_progress']).toContain(statusText?.toLowerCase());
    });

    it('should update task', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Navigate to first task
      await page.click('[data-testid="task-card"]');
      await page.waitForNavigation();
      
      // Click edit button
      await page.waitForSelector('[data-testid="edit-task-button"]');
      await page.click('[data-testid="edit-task-button"]');
      
      // Update priority
      await page.waitForSelector('[data-testid="task-priority-select"]');
      await page.click('[data-testid="task-priority-select"]');
      await page.waitForSelector('[data-testid="priority-critical"]');
      await page.click('[data-testid="priority-critical"]');
      
      // Save changes
      await page.click('[data-testid="save-task-button"]');
      
      // Verify update
      await page.waitForSelector('[data-testid="task-detail-priority"]:has-text("critical")');
    });
  });

  describe('Real-time Updates', () => {
    it('should receive task status updates', async () => {
      // Open two pages
      const page2 = await browser.newPage();
      await page2.setViewport({ width: 1280, height: 720 });
      
      // Login on second page
      await page2.goto(`${baseUrl}/login`);
      await page2.waitForSelector('[data-testid="login-form"]');
      await page2.type('[data-testid="username-input"]', 'testuser');
      await page2.type('[data-testid="password-input"]', 'TestPass123!');
      await page2.click('[data-testid="login-submit"]');
      await page2.waitForNavigation();
      
      // Navigate both to tasks
      await page.goto(`${baseUrl}/tasks`);
      await page2.goto(`${baseUrl}/tasks`);
      
      // Create task on page 1
      await page.click('[data-testid="create-task-button"]');
      await page.waitForSelector('[data-testid="create-task-dialog"]');
      
      const taskTitle = `Real-time Test ${Date.now()}`;
      await page.type('[data-testid="task-title-input"]', taskTitle);
      await page.type('[data-testid="task-description-input"]', 'Real-time test');
      await page.click('[data-testid="create-task-submit"]');
      
      // Check if task appears on page 2
      await page2.waitForSelector(`text=${taskTitle}`, { timeout: 5000 });
      
      await page2.close();
    });

    it('should show notifications for task updates', async () => {
      await page.goto(`${baseUrl}/tasks`);
      
      // Enable notifications if prompted
      const notificationPermission = await page.evaluate(() => {
        return Notification.permission;
      });
      
      if (notificationPermission === 'default') {
        // Would need to handle permission request
        console.log('Notification permission needed');
      }
      
      // Wait for any task update notification
      await page.evaluateOnNewDocument(() => {
        window.addEventListener('notification', (event: any) => {
          console.log('Notification received:', event.detail);
        });
      });
      
      // Trigger a task update (would come from WebSocket in real scenario)
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification', {
          detail: { title: 'Task Updated', message: 'Task status changed' }
        }));
      });
      
      // Check for notification UI element
      await page.waitForSelector('[data-testid="notification-toast"]');
    });
  });

  describe('Bulk Actions', () => {
    it('should select multiple tasks', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Enable selection mode
      await page.click('[data-testid="bulk-select-button"]');
      
      // Select first two tasks
      const checkboxes = await page.$$('[data-testid="task-checkbox"]');
      if (checkboxes.length >= 2) {
        await checkboxes[0].click();
        await checkboxes[1].click();
      }
      
      // Check bulk action bar appears
      await page.waitForSelector('[data-testid="bulk-action-bar"]');
      const selectedCount = await page.$eval(
        '[data-testid="selected-count"]',
        el => el.textContent
      );
      expect(selectedCount).toContain('2');
    });

    it('should bulk update task priority', async () => {
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForSelector('[data-testid="task-card"]');
      
      // Enable selection and select tasks
      await page.click('[data-testid="bulk-select-button"]');
      const checkboxes = await page.$$('[data-testid="task-checkbox"]');
      if (checkboxes.length >= 2) {
        await checkboxes[0].click();
        await checkboxes[1].click();
      }
      
      // Click bulk update
      await page.click('[data-testid="bulk-update-button"]');
      await page.waitForSelector('[data-testid="bulk-update-dialog"]');
      
      // Update priority
      await page.click('[data-testid="bulk-priority-select"]');
      await page.waitForSelector('[data-testid="priority-high"]');
      await page.click('[data-testid="priority-high"]');
      
      // Apply update
      await page.click('[data-testid="bulk-update-submit"]');
      
      // Verify tasks updated
      await page.waitForTimeout(1000);
      const updatedPriorities = await page.$$eval(
        '[data-testid="task-priority"]',
        elements => elements.slice(0, 2).map(el => el.textContent)
      );
      
      updatedPriorities.forEach(priority => {
        expect(priority?.toLowerCase()).toContain('high');
      });
    });
  });
});