import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        organizationId: string;
      };
    }
  }
}

/**
 * Mock authentication middleware for development
 * In production, this would validate JWT tokens and load user from database
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // For development, we'll use a mock user
  // In production, this would decode and validate a JWT token
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // For development, auto-authenticate with a test user
    req.user = {
      id: 'test-user-1',
      email: 'test@example.com',
      role: 'developer',
      organizationId: 'test-org-1',
    };
    return next();
  }

  // In production, this would validate the token
  try {
    // Mock token validation
    const token = authHeader.split(' ')[1];
    if (token) {
      req.user = {
        id: 'test-user-1',
        email: 'test@example.com',
        role: 'developer',
        organizationId: 'test-org-1',
      };
      next();
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};