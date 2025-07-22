import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/auth-service';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      authService?: AuthService;
    }
  }
}

export function createAuthMiddleware(authService: AuthService) {
  return {
    // Middleware to verify JWT token
    authenticate: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.substring(7);
        const payload = await authService.verifyToken(token);
        
        req.user = payload;
        req.authService = authService;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    },

    // Middleware to check specific permission
    requirePermission: (permission: string) => {
      return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if user has the required permission
        const user = authService.getUser(req.user.userId);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }

        if (!authService.hasPermission(user, permission)) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: permission 
          });
        }

        next();
      };
    },

    // Middleware to check multiple permissions (user must have at least one)
    requireAnyPermission: (permissions: string[]) => {
      return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = authService.getUser(req.user.userId);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }

        const hasAnyPermission = permissions.some(permission => 
          authService.hasPermission(user, permission)
        );

        if (!hasAnyPermission) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: permissions 
          });
        }

        next();
      };
    },

    // Middleware to check all permissions (user must have all)
    requireAllPermissions: (permissions: string[]) => {
      return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = authService.getUser(req.user.userId);
        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }

        const hasAllPermissions = permissions.every(permission => 
          authService.hasPermission(user, permission)
        );

        if (!hasAllPermissions) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: permissions 
          });
        }

        next();
      };
    },

    // Middleware to check if user has specific role
    requireRole: (roleId: string) => {
      return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.user.roles.includes(roleId)) {
          return res.status(403).json({ 
            error: 'Insufficient role',
            required: roleId 
          });
        }

        next();
      };
    },

    // Optional authentication - sets user if token is valid but doesn't require it
    optionalAuth: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const payload = await authService.verifyToken(token);
          req.user = payload;
          req.authService = authService;
        }
      } catch (error) {
        // Ignore invalid tokens for optional auth
      }
      next();
    }
  };
}