import { Router, Request, Response } from 'express';
import { AuthService, UserCreateRequest, LoginRequest } from '../services/auth-service';
import { createAuthMiddleware } from '../middleware/auth-middleware';

export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(authService);

  // Public routes
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const createRequest: UserCreateRequest = req.body;
      
      // Validate input
      if (!createRequest.email || !createRequest.username || !createRequest.password) {
        return res.status(400).json({ error: 'Email, username, and password are required' });
      }

      if (!createRequest.firstName || !createRequest.lastName) {
        return res.status(400).json({ error: 'First name and last name are required' });
      }

      // Validate password strength
      if (createRequest.password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      // Create user (defaults to viewer role)
      const user = await authService.createUser(createRequest);
      
      // Auto-login after registration
      const { token } = await authService.login({
        username: createRequest.username,
        password: createRequest.password
      });

      res.json({ user, token });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    try {
      const loginRequest: LoginRequest = req.body;
      
      if (!loginRequest.username || !loginRequest.password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const result = await authService.login(loginRequest);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const token = await authService.refreshToken(refreshToken);
      res.json({ token });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  // Protected routes
  router.get('/me', authMiddleware.authenticate, async (req: Request, res: Response) => {
    try {
      const user = authService.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/me', authMiddleware.authenticate, async (req: Request, res: Response) => {
    try {
      const updates = req.body;
      
      // Users can only update their own profile
      const user = await authService.updateUser(req.user!.userId, {
        firstName: updates.firstName,
        lastName: updates.lastName,
        email: updates.email,
        metadata: updates.metadata
      });

      res.json({ user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/me/change-password', authMiddleware.authenticate, async (req: Request, res: Response) => {
    try {
      const { oldPassword, newPassword } = req.body;
      
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old password and new password are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long' });
      }

      await authService.changePassword(req.user!.userId, oldPassword, newPassword);
      res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // User management (admin only)
  router.get('/users', 
    authMiddleware.authenticate,
    authMiddleware.requirePermission('users:read'),
    async (req: Request, res: Response) => {
      try {
        const users = authService.getAllUsers();
        res.json({ users });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  router.post('/users',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('users:create'),
    async (req: Request, res: Response) => {
      try {
        const createRequest: UserCreateRequest = req.body;
        const user = await authService.createUser(createRequest);
        res.json({ user });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  router.get('/users/:userId',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('users:read'),
    async (req: Request, res: Response) => {
      try {
        const user = authService.getUser(req.params.userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  router.put('/users/:userId',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('users:update'),
    async (req: Request, res: Response) => {
      try {
        const user = await authService.updateUser(req.params.userId, req.body);
        res.json({ user });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  router.put('/users/:userId/roles',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('users:update'),
    async (req: Request, res: Response) => {
      try {
        const { roles } = req.body;
        if (!Array.isArray(roles)) {
          return res.status(400).json({ error: 'Roles must be an array of role IDs' });
        }
        
        const user = await authService.updateUserRoles(req.params.userId, roles);
        res.json({ user });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  router.post('/users/:userId/reset-password',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('users:update'),
    async (req: Request, res: Response) => {
      try {
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        await authService.resetPassword(req.params.userId, newPassword);
        res.json({ message: 'Password reset successfully' });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  // Role management
  router.get('/roles',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('roles:read'),
    async (req: Request, res: Response) => {
      try {
        const roles = authService.getAllRoles();
        res.json({ roles });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  router.post('/roles',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('roles:create'),
    async (req: Request, res: Response) => {
      try {
        const { name, description, permissions } = req.body;
        
        if (!name || !description || !Array.isArray(permissions)) {
          return res.status(400).json({ 
            error: 'Name, description, and permissions array are required' 
          });
        }

        const role = authService.createRole(name, description, permissions);
        res.json({ role });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  router.put('/roles/:roleId',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('roles:update'),
    async (req: Request, res: Response) => {
      try {
        const role = authService.updateRole(req.params.roleId, req.body);
        res.json({ role });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  router.delete('/roles/:roleId',
    authMiddleware.authenticate,
    authMiddleware.requirePermission('roles:delete'),
    async (req: Request, res: Response) => {
      try {
        authService.deleteRole(req.params.roleId);
        res.json({ message: 'Role deleted successfully' });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  // Permissions list
  router.get('/permissions',
    authMiddleware.authenticate,
    async (req: Request, res: Response) => {
      try {
        const permissions = authService.getAllPermissions();
        res.json({ permissions });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  return router;
}