import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import winston from 'winston';
import { SAMLService } from '../services/saml-service';
import { OAuth2Service } from '../services/oauth-service';
import { DatabaseService } from '../database/database-service';

interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  authMethod: 'local' | 'saml' | 'oauth2' | 'oidc';
  sessionId?: string;
  tokenExpiry?: Date;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  session?: {
    id: string;
    userId: string;
    organizationId: string;
    authMethod: string;
    createdAt: Date;
    expiresAt: Date;
    data?: Record<string, any>;
  };
}

interface AuthenticationConfig {
  jwtSecret: string;
  jwtExpiry: string;
  sessionExpiry: number; // in milliseconds
  requireAuth: boolean;
  allowedMethods: ('local' | 'saml' | 'oauth2' | 'oidc')[];
  organizationFromRequest?: (req: Request) => string | undefined;
}

export class SSOAuthMiddleware {
  private logger: winston.Logger;
  private config: AuthenticationConfig;
  private db: DatabaseService;
  private samlService?: SAMLService;
  private oauthService?: OAuth2Service;
  private sessionStore: Map<string, any> = new Map();

  constructor(
    config: AuthenticationConfig,
    samlService?: SAMLService,
    oauthService?: OAuth2Service
  ) {
    this.config = config;
    this.samlService = samlService;
    this.oauthService = oauthService;
    this.db = DatabaseService.getInstance();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new winston.transports.File({ 
          filename: 'logs/sso-auth-middleware.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Main authentication middleware with SSO support
   */
  authenticate = (options?: {
    required?: boolean;
    permissions?: string[];
    roles?: string[];
    allowedMethods?: ('local' | 'saml' | 'oauth2' | 'oidc')[];
  }) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const required = options?.required ?? this.config.requireAuth;
      const allowedMethods = options?.allowedMethods ?? this.config.allowedMethods;

      try {
        // Try to authenticate the request
        const authResult = await this.extractAndValidateAuth(req, allowedMethods);

        if (authResult.success && authResult.user) {
          req.user = authResult.user;
          req.session = authResult.session;

          // Check permissions if specified
          if (options?.permissions) {
            const hasPermissions = this.checkPermissions(authResult.user, options.permissions);
            if (!hasPermissions) {
              return res.status(403).json({
                error: 'Insufficient permissions',
                required: options.permissions
              });
            }
          }

          // Check roles if specified
          if (options?.roles) {
            const hasRoles = this.checkRoles(authResult.user, options.roles);
            if (!hasRoles) {
              return res.status(403).json({
                error: 'Insufficient role access',
                required: options.roles
              });
            }
          }

          this.logger.debug('Request authenticated successfully', {
            userId: authResult.user.id,
            email: authResult.user.email,
            method: authResult.user.authMethod,
            organizationId: authResult.user.organizationId
          });

          return next();
        }

        // Authentication failed
        if (required) {
          this.logger.warn('Authentication required but failed', {
            error: authResult.error,
            path: req.path,
            method: req.method
          });

          return res.status(401).json({
            error: 'Authentication required',
            message: authResult.error || 'Invalid or missing authentication',
            supportedMethods: allowedMethods
          });
        }

        // Authentication not required, continue without user
        next();

      } catch (error) {
        this.logger.error('Authentication middleware error:', error);
        
        if (required) {
          return res.status(500).json({
            error: 'Authentication service error'
          });
        }

        next();
      }
    };
  };

  /**
   * Organization-specific authentication
   */
  authenticateOrganization = (options?: {
    required?: boolean;
    allowSuperAdmin?: boolean;
  }) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // First, run standard authentication
      await new Promise<void>((resolve, reject) => {
        this.authenticate({ required: options?.required })(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.user) {
        return next();
      }

      // Extract organization ID from request
      const requestedOrgId = this.extractOrganizationId(req);
      
      if (!requestedOrgId) {
        return res.status(400).json({
          error: 'Organization ID required'
        });
      }

      // Check if user belongs to the organization
      const belongsToOrg = req.user.organizationId === requestedOrgId;
      const isSuperAdmin = options?.allowSuperAdmin && req.user.roles.includes('super_admin');

      if (!belongsToOrg && !isSuperAdmin) {
        this.logger.warn('Organization access denied', {
          userId: req.user.id,
          userOrgId: req.user.organizationId,
          requestedOrgId
        });

        return res.status(403).json({
          error: 'Access denied to organization',
          organizationId: requestedOrgId
        });
      }

      next();
    };
  };

  /**
   * Extract and validate authentication from request
   */
  private async extractAndValidateAuth(
    req: AuthenticatedRequest,
    allowedMethods: string[]
  ): Promise<{
    success: boolean;
    user?: AuthenticatedUser;
    session?: any;
    error?: string;
  }> {
    // Try different authentication methods in order of preference

    // 1. JWT Token (Bearer token) - works for all methods
    if (allowedMethods.includes('local') || allowedMethods.includes('oauth2') || allowedMethods.includes('oidc')) {
      const jwtResult = await this.validateJWT(req);
      if (jwtResult.success) {
        return jwtResult;
      }
    }

    // 2. Session-based authentication (SAML, OAuth2)
    if (allowedMethods.includes('saml') || allowedMethods.includes('oauth2') || allowedMethods.includes('oidc')) {
      const sessionResult = await this.validateSession(req);
      if (sessionResult.success) {
        return sessionResult;
      }
    }

    // 3. API Key authentication (local only)
    if (allowedMethods.includes('local')) {
      const apiKeyResult = await this.validateApiKey(req);
      if (apiKeyResult.success) {
        return apiKeyResult;
      }
    }

    return {
      success: false,
      error: 'No valid authentication found'
    };
  }

  /**
   * Validate JWT token
   */
  private async validateJWT(req: Request): Promise<{
    success: boolean;
    user?: AuthenticatedUser;
    error?: string;
  }> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'No Bearer token found' };
    }

    const token = authHeader.substring(7);

    try {
      const payload = jwt.verify(token, this.config.jwtSecret) as any;

      // Load user details from database
      const user = await this.loadUserById(payload.userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check token expiry
      if (payload.exp && new Date(payload.exp * 1000) < new Date()) {
        return { success: false, error: 'Token expired' };
      }

      return {
        success: true,
        user: {
          ...user,
          authMethod: payload.authMethod || 'local',
          tokenExpiry: payload.exp ? new Date(payload.exp * 1000) : undefined
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid token'
      };
    }
  }

  /**
   * Validate session (for SAML and OAuth2)
   */
  private async validateSession(req: AuthenticatedRequest): Promise<{
    success: boolean;
    user?: AuthenticatedUser;
    session?: any;
    error?: string;
  }> {
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    if (!sessionId) {
      return { success: false, error: 'No session ID found' };
    }

    try {
      // Load session from store (in production, use Redis or database)
      const session = this.sessionStore.get(sessionId) || await this.loadSessionFromDatabase(sessionId);
      
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Check session expiry
      if (session.expiresAt < new Date()) {
        this.sessionStore.delete(sessionId);
        return { success: false, error: 'Session expired' };
      }

      // Load user details
      const user = await this.loadUserById(session.userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Update last activity
      session.data.lastActivity = new Date();
      this.sessionStore.set(sessionId, session);

      return {
        success: true,
        user: {
          ...user,
          authMethod: session.authMethod,
          sessionId: session.id
        },
        session
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  /**
   * Validate API key
   */
  private async validateApiKey(req: Request): Promise<{
    success: boolean;
    user?: AuthenticatedUser;
    error?: string;
  }> {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return { success: false, error: 'No API key found' };
    }

    try {
      // Load API key from database
      const apiKeyRecord = await this.loadApiKey(apiKey);
      if (!apiKeyRecord) {
        return { success: false, error: 'Invalid API key' };
      }

      // Check if API key is active
      if (!apiKeyRecord.isActive) {
        return { success: false, error: 'API key is disabled' };
      }

      // Check expiry
      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        return { success: false, error: 'API key expired' };
      }

      // Load associated user
      const user = await this.loadUserById(apiKeyRecord.userId);
      if (!user) {
        return { success: false, error: 'Associated user not found' };
      }

      // Update last used timestamp
      await this.updateApiKeyLastUsed(apiKeyRecord.id);

      return {
        success: true,
        user: {
          ...user,
          authMethod: 'local' as const
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API key validation failed'
      };
    }
  }

  /**
   * Generate JWT token for user
   */
  generateToken = (user: AuthenticatedUser, options?: {
    expiresIn?: string;
    audience?: string;
    issuer?: string;
  }): string => {
    const payload = {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles,
      authMethod: user.authMethod
    };

    const tokenOptions: jwt.SignOptions = {
      expiresIn: options?.expiresIn || this.config.jwtExpiry,
      audience: options?.audience,
      issuer: options?.issuer || 'multi-agent-orchestrator'
    };

    return jwt.sign(payload, this.config.jwtSecret, tokenOptions);
  };

  /**
   * Create session for user (used by SAML and OAuth2)
   */
  createSession = async (user: AuthenticatedUser, req: Request): Promise<{
    sessionId: string;
    expiresAt: Date;
  }> => {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + this.config.sessionExpiry);

    const session = {
      id: sessionId,
      userId: user.id,
      organizationId: user.organizationId,
      authMethod: user.authMethod,
      createdAt: new Date(),
      expiresAt,
      data: {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        lastActivity: new Date()
      }
    };

    // Store session (in production, use Redis or database)
    this.sessionStore.set(sessionId, session);
    await this.saveSessionToDatabase(session);

    this.logger.info('Session created', {
      sessionId,
      userId: user.id,
      authMethod: user.authMethod,
      expiresAt
    });

    return { sessionId, expiresAt };
  };

  /**
   * Destroy session
   */
  destroySession = async (sessionId: string): Promise<void> => {
    this.sessionStore.delete(sessionId);
    await this.deleteSessionFromDatabase(sessionId);

    this.logger.info('Session destroyed', { sessionId });
  };

  /**
   * Middleware for SAML authentication initiation
   */
  initiateSAMLAuth = (idpId: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      try {
        const organizationId = this.extractOrganizationId(req) || 'default';
        const relayState = req.query.relayState as string;

        const authRequest = await this.samlService.generateAuthRequest(
          organizationId,
          idpId,
          relayState
        );

        // Store request context for validation
        req.session = req.session || {};
        (req.session as any).samlRequestId = authRequest.id;

        res.redirect(authRequest.url);

      } catch (error) {
        this.logger.error('SAML auth initiation failed:', error);
        res.status(500).json({ 
          error: 'Failed to initiate SAML authentication' 
        });
      }
    };
  };

  /**
   * Middleware for SAML authentication callback
   */
  handleSAMLCallback = (idpId: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      try {
        const organizationId = this.extractOrganizationId(req) || 'default';
        const samlResponse = req.body.SAMLResponse;
        const relayState = req.body.RelayState;

        const authResult = await this.samlService.processAuthResponse(
          organizationId,
          idpId,
          samlResponse,
          relayState
        );

        if (!authResult.success || !authResult.user) {
          return res.status(401).json({
            error: 'SAML authentication failed',
            message: authResult.error
          });
        }

        // Create authenticated user object
        const user: AuthenticatedUser = {
          id: authResult.user.nameId,
          email: authResult.user.email,
          name: authResult.user.firstName && authResult.user.lastName 
            ? `${authResult.user.firstName} ${authResult.user.lastName}`
            : undefined,
          organizationId,
          roles: [], // Would be populated from SAML attributes or database
          permissions: [], // Would be populated from roles
          authMethod: 'saml'
        };

        // Create session
        const session = await this.createSession(user, req);

        // Set session cookie
        res.cookie('sessionId', session.sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: this.config.sessionExpiry,
          sameSite: 'lax'
        });

        // Redirect to relay state or default
        const redirectUrl = relayState || '/dashboard';
        res.redirect(redirectUrl);

      } catch (error) {
        this.logger.error('SAML callback handling failed:', error);
        res.status(500).json({ 
          error: 'Failed to process SAML authentication' 
        });
      }
    };
  };

  /**
   * Middleware for OAuth2 authentication initiation
   */
  initiateOAuth2Auth = (providerId: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      try {
        const state = req.query.state as string;
        const authRequest = await this.oauthService.generateAuthorizationUrl(
          providerId,
          state
        );

        // Store code verifier and state for validation
        req.session = req.session || {};
        (req.session as any).oauth2State = authRequest.state;
        (req.session as any).oauth2CodeVerifier = authRequest.codeVerifier;
        (req.session as any).oauth2Nonce = authRequest.nonce;

        res.redirect(authRequest.url);

      } catch (error) {
        this.logger.error('OAuth2 auth initiation failed:', error);
        res.status(500).json({ 
          error: 'Failed to initiate OAuth2 authentication' 
        });
      }
    };
  };

  /**
   * Middleware for OAuth2 authentication callback
   */
  handleOAuth2Callback = (providerId: string) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      try {
        const code = req.query.code as string;
        const state = req.query.state as string;
        const codeVerifier = (req.session as any)?.oauth2CodeVerifier;

        if (!code) {
          return res.status(400).json({ error: 'Authorization code not provided' });
        }

        const authResult = await this.oauthService.exchangeCodeForTokens(
          providerId,
          code,
          state,
          codeVerifier
        );

        if (!authResult.success || !authResult.user) {
          return res.status(401).json({
            error: 'OAuth2 authentication failed',
            message: authResult.error
          });
        }

        // Create authenticated user object
        const organizationId = this.extractOrganizationId(req) || 'default';
        const user: AuthenticatedUser = {
          id: authResult.user.id,
          email: authResult.user.email,
          name: authResult.user.name,
          organizationId,
          roles: [], // Would be populated from OAuth2 attributes or database
          permissions: [], // Would be populated from roles
          authMethod: 'oauth2'
        };

        // Create session
        const session = await this.createSession(user, req);

        // Set session cookie
        res.cookie('sessionId', session.sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: this.config.sessionExpiry,
          sameSite: 'lax'
        });

        // Redirect to state or default
        const redirectUrl = authResult.state || '/dashboard';
        res.redirect(redirectUrl);

      } catch (error) {
        this.logger.error('OAuth2 callback handling failed:', error);
        res.status(500).json({ 
          error: 'Failed to process OAuth2 authentication' 
        });
      }
    };
  };

  /**
   * Check if user has required permissions
   */
  private checkPermissions(user: AuthenticatedUser, requiredPermissions: string[]): boolean {
    // Super admins have all permissions
    if (user.roles.includes('super_admin')) {
      return true;
    }

    // Check if user has all required permissions
    return requiredPermissions.every(permission => 
      user.permissions.includes(permission)
    );
  }

  /**
   * Check if user has required roles
   */
  private checkRoles(user: AuthenticatedUser, requiredRoles: string[]): boolean {
    // Check if user has any of the required roles
    return requiredRoles.some(role => user.roles.includes(role));
  }

  /**
   * Extract organization ID from request
   */
  private extractOrganizationId(req: Request): string | undefined {
    // Try custom extractor first
    if (this.config.organizationFromRequest) {
      const orgId = this.config.organizationFromRequest(req);
      if (orgId) return orgId;
    }

    // Try common patterns
    return req.params.organizationId || 
           req.query.organizationId as string ||
           req.headers['x-organization-id'] as string;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  // Database operations (simplified - would use actual database queries)
  private async loadUserById(userId: string): Promise<AuthenticatedUser | null> {
    // Mock implementation - replace with actual database query
    return null;
  }

  private async loadSessionFromDatabase(sessionId: string): Promise<any | null> {
    // Mock implementation - replace with actual database query
    return null;
  }

  private async saveSessionToDatabase(session: any): Promise<void> {
    // Mock implementation - replace with actual database query
  }

  private async deleteSessionFromDatabase(sessionId: string): Promise<void> {
    // Mock implementation - replace with actual database query
  }

  private async loadApiKey(apiKey: string): Promise<any | null> {
    // Mock implementation - replace with actual database query
    return null;
  }

  private async updateApiKeyLastUsed(apiKeyId: string): Promise<void> {
    // Mock implementation - replace with actual database query
  }
}

/**
 * Factory function to create SSO authentication middleware
 */
export function createSSOAuthMiddleware(
  config: AuthenticationConfig,
  samlService?: SAMLService,
  oauthService?: OAuth2Service
): SSOAuthMiddleware {
  return new SSOAuthMiddleware(config, samlService, oauthService);
}

/**
 * Common permission constants
 */
export const PERMISSIONS = {
  // User management
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',

  // Organization management
  ORG_READ: 'organization:read',
  ORG_WRITE: 'organization:write',
  ORG_ADMIN: 'organization:admin',

  // Task management
  TASK_READ: 'task:read',
  TASK_WRITE: 'task:write',
  TASK_EXECUTE: 'task:execute',
  TASK_DELETE: 'task:delete',

  // Agent management
  AGENT_READ: 'agent:read',
  AGENT_WRITE: 'agent:write',
  AGENT_EXECUTE: 'agent:execute',

  // Repository integration
  REPO_READ: 'repository:read',
  REPO_WRITE: 'repository:write',
  REPO_ADMIN: 'repository:admin',

  // SSO management
  SSO_READ: 'sso:read',
  SSO_WRITE: 'sso:write',
  SSO_ADMIN: 'sso:admin',

  // System administration
  SYSTEM_ADMIN: 'system:admin',
  AUDIT_READ: 'audit:read'
} as const;

/**
 * Common role constants
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  ORG_MEMBER: 'org_member',
  DEVELOPER: 'developer',
  VIEWER: 'viewer'
} as const;