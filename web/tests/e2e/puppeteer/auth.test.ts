import puppeteer, { Browser, Page } from 'puppeteer';

describe('Authentication E2E Tests', () => {
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
  });

  afterEach(async () => {
    await page.close();
  });

  describe('Login Flow', () => {
    it('should display login form', async () => {
      await page.goto(`${baseUrl}/login`);
      
      // Wait for login form
      await page.waitForSelector('[data-testid="login-form"]');
      
      // Check form elements
      const usernameInput = await page.$('[data-testid="username-input"]');
      const passwordInput = await page.$('[data-testid="password-input"]');
      const submitButton = await page.$('[data-testid="login-submit"]');
      
      expect(usernameInput).toBeTruthy();
      expect(passwordInput).toBeTruthy();
      expect(submitButton).toBeTruthy();
    });

    it('should show validation errors for empty form', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('[data-testid="login-form"]');
      
      // Click submit without filling form
      await page.click('[data-testid="login-submit"]');
      
      // Wait for error messages
      await page.waitForSelector('.MuiFormHelperText-root');
      
      const errorTexts = await page.$$eval(
        '.MuiFormHelperText-root',
        elements => elements.map(el => el.textContent)
      );
      
      expect(errorTexts).toContain('Username is required');
      expect(errorTexts).toContain('Password is required');
    });

    it('should login with valid credentials', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('[data-testid="login-form"]');
      
      // Fill in credentials
      await page.type('[data-testid="username-input"]', 'testuser');
      await page.type('[data-testid="password-input"]', 'TestPass123!');
      
      // Submit form
      await page.click('[data-testid="login-submit"]');
      
      // Wait for navigation
      await page.waitForNavigation();
      
      // Should redirect to dashboard
      expect(page.url()).toContain('/dashboard');
      
      // Check for user menu
      await page.waitForSelector('[data-testid="user-menu"]');
      const userMenuText = await page.$eval(
        '[data-testid="user-menu"]',
        el => el.textContent
      );
      expect(userMenuText).toContain('testuser');
    });

    it('should show error for invalid credentials', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('[data-testid="login-form"]');
      
      // Fill in invalid credentials
      await page.type('[data-testid="username-input"]', 'testuser');
      await page.type('[data-testid="password-input"]', 'WrongPassword');
      
      // Submit form
      await page.click('[data-testid="login-submit"]');
      
      // Wait for error message
      await page.waitForSelector('[data-testid="login-error"]');
      const errorText = await page.$eval(
        '[data-testid="login-error"]',
        el => el.textContent
      );
      
      expect(errorText).toContain('Invalid credentials');
    });

    it('should logout successfully', async () => {
      // First login
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('[data-testid="login-form"]');
      await page.type('[data-testid="username-input"]', 'testuser');
      await page.type('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForNavigation();
      
      // Click user menu
      await page.click('[data-testid="user-menu"]');
      
      // Click logout
      await page.waitForSelector('[data-testid="logout-button"]');
      await page.click('[data-testid="logout-button"]');
      
      // Should redirect to login
      await page.waitForNavigation();
      expect(page.url()).toContain('/login');
    });
  });

  describe('Registration Flow', () => {
    it('should navigate to registration form', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('[data-testid="register-link"]');
      
      await page.click('[data-testid="register-link"]');
      await page.waitForNavigation();
      
      expect(page.url()).toContain('/register');
      await page.waitForSelector('[data-testid="register-form"]');
    });

    it('should validate registration form', async () => {
      await page.goto(`${baseUrl}/register`);
      await page.waitForSelector('[data-testid="register-form"]');
      
      // Submit empty form
      await page.click('[data-testid="register-submit"]');
      
      // Check for validation errors
      await page.waitForSelector('.MuiFormHelperText-root');
      const errorCount = await page.$$eval(
        '.MuiFormHelperText-root',
        elements => elements.length
      );
      
      expect(errorCount).toBeGreaterThanOrEqual(5); // All required fields
    });

    it('should validate password requirements', async () => {
      await page.goto(`${baseUrl}/register`);
      await page.waitForSelector('[data-testid="register-form"]');
      
      // Type weak password
      await page.type('[data-testid="password-input"]', 'weak');
      await page.click('[data-testid="register-submit"]');
      
      // Check password error
      await page.waitForSelector('[data-testid="password-error"]');
      const errorText = await page.$eval(
        '[data-testid="password-error"]',
        el => el.textContent
      );
      
      expect(errorText).toContain('at least 8 characters');
    });

    it('should register new user successfully', async () => {
      const timestamp = Date.now();
      const username = `newuser${timestamp}`;
      
      await page.goto(`${baseUrl}/register`);
      await page.waitForSelector('[data-testid="register-form"]');
      
      // Fill registration form
      await page.type('[data-testid="username-input"]', username);
      await page.type('[data-testid="email-input"]', `${username}@example.com`);
      await page.type('[data-testid="password-input"]', 'SecurePass123!');
      await page.type('[data-testid="confirm-password-input"]', 'SecurePass123!');
      await page.type('[data-testid="firstname-input"]', 'Test');
      await page.type('[data-testid="lastname-input"]', 'User');
      
      // Submit form
      await page.click('[data-testid="register-submit"]');
      
      // Should redirect to dashboard after successful registration
      await page.waitForNavigation();
      expect(page.url()).toContain('/dashboard');
    });
  });

  describe('Protected Routes', () => {
    it('should redirect to login when accessing protected route', async () => {
      await page.goto(`${baseUrl}/dashboard`);
      
      // Should redirect to login
      await page.waitForNavigation();
      expect(page.url()).toContain('/login');
      
      // Should show redirect message
      await page.waitForSelector('[data-testid="redirect-message"]');
      const messageText = await page.$eval(
        '[data-testid="redirect-message"]',
        el => el.textContent
      );
      expect(messageText).toContain('Please login to continue');
    });

    it('should maintain redirect after login', async () => {
      // Try to access protected route
      await page.goto(`${baseUrl}/tasks`);
      await page.waitForNavigation();
      
      // Should be on login page
      expect(page.url()).toContain('/login');
      
      // Login
      await page.type('[data-testid="username-input"]', 'testuser');
      await page.type('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-submit"]');
      
      // Should redirect to originally requested page
      await page.waitForNavigation();
      expect(page.url()).toContain('/tasks');
    });
  });

  describe('Session Management', () => {
    it('should persist session on page reload', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('[data-testid="login-form"]');
      await page.type('[data-testid="username-input"]', 'testuser');
      await page.type('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForNavigation();
      
      // Reload page
      await page.reload();
      
      // Should still be logged in
      await page.waitForSelector('[data-testid="user-menu"]');
      expect(page.url()).toContain('/dashboard');
    });

    it('should handle expired session gracefully', async () => {
      // Login
      await page.goto(`${baseUrl}/login`);
      await page.waitForSelector('[data-testid="login-form"]');
      await page.type('[data-testid="username-input"]', 'testuser');
      await page.type('[data-testid="password-input"]', 'TestPass123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForNavigation();
      
      // Clear auth token to simulate expiration
      await page.evaluate(() => {
        localStorage.removeItem('auth-token');
      });
      
      // Try to navigate to protected route
      await page.goto(`${baseUrl}/tasks`);
      
      // Should redirect to login
      await page.waitForNavigation();
      expect(page.url()).toContain('/login');
    });
  });
});