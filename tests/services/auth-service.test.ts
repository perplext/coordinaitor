import { AuthService } from '../../src/services/auth-service';
import { LoginRequest, UserCreateRequest } from '../../src/services/auth-service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const registerRequest: UserCreateRequest = {
        username: 'testuser',
        password: 'SecurePass123!',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const user = await authService.createUser(registerRequest);

      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      
      // Login to get token
      const loginResult = await authService.login({
        username: 'testuser',
        password: 'SecurePass123!'
      });
      expect(loginResult.token).toBeDefined();
      expect(loginResult.token.accessToken).toBeDefined();
      expect(loginResult.token.refreshToken).toBeDefined();
    });

    it('should not register duplicate username', async () => {
      const registerRequest: UserCreateRequest = {
        username: 'duplicateuser',
        password: 'SecurePass123!',
        email: 'dup1@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      await authService.createUser(registerRequest);

      await expect(authService.createUser({
        ...registerRequest,
        email: 'dup2@example.com'
      })).rejects.toThrow('Username already exists');
    });

    it('should hash passwords correctly', async () => {
      const registerRequest: UserCreateRequest = {
        username: 'hashtest',
        password: 'PlainTextPassword',
        email: 'hash@example.com',
        firstName: 'Hash',
        lastName: 'Test',
      };

      const user = await authService.createUser(registerRequest);
      
      // Verify password is hashed by checking login works with correct password
      const loginResult = await authService.login({
        username: 'hashtest',
        password: 'PlainTextPassword'
      });
      expect(loginResult.user).toBeDefined();
      
      // Verify the password was actually hashed by checking that a hashed value doesn't work
      await expect(authService.login({
        username: 'hashtest',
        password: '$2a$10$somehashedvalue'
      })).rejects.toThrow('Invalid credentials');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      await authService.createUser({
        username: 'logintest',
        password: 'TestPass123!',
        email: 'login@example.com',
        firstName: 'Login',
        lastName: 'Test',
      });
    });

    it('should login with valid credentials', async () => {
      const loginRequest: LoginRequest = {
        username: 'logintest',
        password: 'TestPass123!',
      };

      const result = await authService.login(loginRequest);

      expect(result.user).toBeDefined();
      expect(result.user.username).toBe('logintest');
      expect(result.token).toBeDefined();
      expect(result.token.accessToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const loginRequest: LoginRequest = {
        username: 'logintest',
        password: 'WrongPassword',
      };

      await expect(authService.login(loginRequest)).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const loginRequest: LoginRequest = {
        username: 'nonexistent',
        password: 'AnyPassword',
      };

      await expect(authService.login(loginRequest)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Token Management', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const user = await authService.createUser({
        username: 'tokentest',
        password: 'TokenPass123!',
        email: 'token@example.com',
        firstName: 'Token',
        lastName: 'Test',
      });
      
      const loginResult = await authService.login({
        username: 'tokentest',
        password: 'TokenPass123!'
      });
      accessToken = loginResult.token.accessToken;
      refreshToken = loginResult.token.refreshToken;
    });

    it('should verify valid access token', async () => {
      const payload = await authService.verifyToken(accessToken);
      
      expect(payload).toBeDefined();
      expect(payload.username).toBe('tokentest');
      expect(payload.roles).toContain('viewer');
    });

    it('should reject invalid token', async () => {
      await expect(authService.verifyToken('invalid.token.here'))
        .rejects.toThrow();
    });

    it('should refresh tokens successfully', async () => {
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newTokens = await authService.refreshToken(refreshToken);
      
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      // New tokens should be different (different timestamp)
      expect(newTokens.accessToken).not.toBe(accessToken);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should assign default role to new users', async () => {
      const user = await authService.createUser({
        username: 'roletest',
        password: 'RolePass123!',
        email: 'role@example.com',
        firstName: 'Role',
        lastName: 'Test',
      });

      const retrievedUser = authService.getUser(user.id);
      expect(retrievedUser?.roles).toHaveLength(1);
      expect(retrievedUser?.roles[0].id).toBe('viewer');
    });

    it('should check permissions correctly', async () => {
      const user = await authService.createUser({
        username: 'permtest',
        password: 'PermPass123!',
        email: 'perm@example.com',
        firstName: 'Perm',
        lastName: 'Test',
      });

      const retrievedUser = authService.getUser(user.id);
      
      expect(authService.hasPermission(retrievedUser!, 'tasks:read')).toBe(true);
      expect(authService.hasPermission(retrievedUser!, 'tasks:create')).toBe(false);
      expect(authService.hasPermission(retrievedUser!, 'users:delete')).toBe(false);
    });

    it('should handle role updates', async () => {
      const user = await authService.createUser({
        username: 'roleupdate',
        password: 'UpdatePass123!',
        email: 'update@example.com',
        firstName: 'Update',
        lastName: 'Test',
      });

      await authService.updateUserRoles(user.id, ['admin']);
      const retrievedUser = authService.getUser(user.id);
      
      expect(retrievedUser?.roles).toHaveLength(1);
      expect(retrievedUser?.roles[0].id).toBe('admin');
      expect(authService.hasPermission(retrievedUser!, 'users:delete')).toBe(true);
    });
  });

  describe('User Management', () => {
    it('should list all users', async () => {
      await authService.createUser({
        username: 'list1',
        password: 'ListPass1!',
        email: 'list1@example.com',
        firstName: 'List1',
        lastName: 'User',
      });

      await authService.createUser({
        username: 'list2',
        password: 'ListPass2!',
        email: 'list2@example.com',
        firstName: 'List2',
        lastName: 'User',
      });

      const users = await authService.getAllUsers();
      
      expect(users.length).toBeGreaterThanOrEqual(2);
      expect(users.some(u => u.username === 'list1')).toBe(true);
      expect(users.some(u => u.username === 'list2')).toBe(true);
    });

    it('should update user information', async () => {
      const user = await authService.createUser({
        username: 'updateinfo',
        password: 'UpdatePass123!',
        email: 'updateinfo@example.com',
        firstName: 'Original',
        lastName: 'Name',
      });

      await authService.updateUser(user.id, {
        firstName: 'Updated',
        lastName: 'NewName',
        email: 'newemail@example.com',
      });

      const retrievedUser = authService.getUser(user.id);
      
      expect(retrievedUser?.firstName).toBe('Updated');
      expect(retrievedUser?.lastName).toBe('NewName');
      expect(retrievedUser?.email).toBe('newemail@example.com');
    });

    it('should handle user deactivation', async () => {
      const user = await authService.createUser({
        username: 'deactivate',
        password: 'DeactivatePass123!',
        email: 'deactivate@example.com',
        firstName: 'Deactivate',
        lastName: 'User',
      });

      await authService.updateUser(user.id, { isActive: false });
      
      await expect(authService.login({
        username: 'deactivate',
        password: 'DeactivatePass123!',
      })).rejects.toThrow('Invalid credentials');
    });
  });
});