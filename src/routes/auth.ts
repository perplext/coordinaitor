import { Router, Request, Response } from 'express';
import { SAMLService } from '../services/saml-service';
import { OAuth2Service } from '../services/oauth-service';
import { SSOAuthMiddleware } from '../middleware/sso-auth-middleware';
import { DatabaseService } from '../database/database-service';
import winston from 'winston';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    roles: string[];
    authMethod: string;
  };
}

const logger = winston.createLogger({
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
      filename: 'logs/auth-routes.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Store services (would be injected in real application)
let samlService: SAMLService;
let oauthService: OAuth2Service;
let authMiddleware: SSOAuthMiddleware;

/**
 * Initialize auth routes with services
 */
export function initializeAuthRoutes(
  saml: SAMLService,
  oauth: OAuth2Service,
  middleware: SSOAuthMiddleware
) {
  samlService = saml;
  oauthService = oauth;
  authMiddleware = middleware;
}

/**
 * @openapi
 * /auth/methods/{organizationId}:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Get available authentication methods
 *     description: Retrieve all available authentication methods for an organization, including local auth, SAML, and OAuth2 providers
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: Organization ID (defaults to 'default')
 *     responses:
 *       200:
 *         description: List of available authentication methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizationId:
 *                   type: string
 *                   description: Organization identifier
 *                 methods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Method identifier
 *                       name:
 *                         type: string
 *                         description: Display name
 *                       type:
 *                         type: string
 *                         enum: [local, saml, oauth2, oidc]
 *                       provider:
 *                         type: string
 *                         description: Provider name (for OAuth2)
 *                       enabled:
 *                         type: boolean
 *                       loginUrl:
 *                         type: string
 *                         format: uri
 *                         description: Authentication initiation URL
 *             example:
 *               organizationId: "default"
 *               methods:
 *                 - id: "local"
 *                   name: "Email/Password"
 *                   type: "local"
 *                   enabled: true
 *                   loginUrl: "/auth/login"
 *                 - id: "google-sso"
 *                   name: "Google OAuth2"
 *                   type: "oauth2"
 *                   provider: "google"
 *                   enabled: true
 *                   loginUrl: "/auth/oauth2/google-sso/login"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/methods/:organizationId?', async (req: Request, res: Response) => {
  try {
    const organizationId = req.params.organizationId || 'default';
    
    const methods: any[] = [
      {
        id: 'local',
        name: 'Email/Password',
        type: 'local',
        enabled: true,
        loginUrl: '/auth/login'
      }
    ];

    // Get SAML providers
    if (samlService) {
      const samlProviders = await samlService.listIdentityProviders(organizationId);
      methods.push(...samlProviders.map(provider => ({
        id: provider.id,
        name: provider.name,
        type: 'saml',
        enabled: provider.enabled,
        loginUrl: `/auth/saml/${provider.id}/login`
      })));
    }

    // Get OAuth2 providers
    if (oauthService) {
      const oauthProviders = await oauthService.listProviders(organizationId);
      methods.push(...oauthProviders.map(provider => ({
        id: provider.id,
        name: provider.name,
        type: provider.provider === 'custom' ? 'oauth2' : 'oidc',
        provider: provider.provider,
        enabled: provider.enabled,
        loginUrl: `/auth/oauth2/${provider.id}/login`
      })));
    }

    res.json({
      organizationId,
      methods: methods.filter(method => method.enabled)
    });

  } catch (error) {
    logger.error('Failed to get auth methods:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve authentication methods' 
    });
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Local authentication login
 *     description: Authenticate a user with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: "SecurePassword123!"
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *                 description: Organization ID (optional, defaults to 'default')
 *                 example: "org-123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expiresIn:
 *                   type: string
 *                   description: Token expiration time
 *                   example: "24h"
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Email and password are required"
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Authentication failed"
 *               message: "Invalid credentials"
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, organizationId } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Mock local authentication - replace with actual implementation
    const user = {
      id: 'user-123',
      email,
      name: 'Test User',
      organizationId: organizationId || 'default',
      roles: ['org_member'],
      permissions: ['task:read', 'task:write'],
      authMethod: 'local' as const
    };

    // Generate JWT token
    const token = authMiddleware.generateToken(user);

    logger.info('Local authentication successful', {
      email,
      organizationId: user.organizationId
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: user.organizationId,
        roles: user.roles,
        authMethod: user.authMethod
      },
      token,
      expiresIn: '24h'
    });

  } catch (error) {
    logger.error('Local authentication failed:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid credentials'
    });
  }
});

/**
 * Logout endpoint
 */
router.post('/logout', authMiddleware.authenticate({ required: false }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.cookies?.sessionId;
    
    if (sessionId) {
      await authMiddleware.destroySession(sessionId);
      res.clearCookie('sessionId');
    }

    if (req.user) {
      logger.info('User logged out', {
        userId: req.user.id,
        authMethod: req.user.authMethod
      });
    }

    res.json({ success: true });

  } catch (error) {
    logger.error('Logout failed:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Get current user info
 */
router.get('/me', authMiddleware.authenticate({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        organizationId: req.user.organizationId,
        roles: req.user.roles,
        authMethod: req.user.authMethod
      }
    });

  } catch (error) {
    logger.error('Failed to get user info:', error);
    res.status(500).json({ error: 'Failed to retrieve user information' });
  }
});

// SAML Authentication Routes

/**
 * SAML Login - Initiate authentication
 */
router.get('/saml/:idpId/login', async (req: Request, res: Response) => {
  const { idpId } = req.params;
  const relayState = req.query.RelayState as string;
  
  if (!samlService) {
    return res.status(500).json({ error: 'SAML not configured' });
  }

  try {
    const organizationId = req.query.organizationId as string || 'default';
    
    const authRequest = await samlService.generateAuthRequest(
      organizationId,
      idpId,
      relayState
    );

    logger.info('SAML authentication initiated', {
      idpId,
      organizationId,
      requestId: authRequest.id
    });

    res.redirect(authRequest.url);

  } catch (error) {
    logger.error('SAML authentication initiation failed:', error);
    res.status(500).json({ 
      error: 'Failed to initiate SAML authentication' 
    });
  }
});

/**
 * SAML Callback - Process authentication response
 */
router.post('/saml/:idpId/acs', async (req: Request, res: Response) => {
  const { idpId } = req.params;
  
  if (!samlService) {
    return res.status(500).json({ error: 'SAML not configured' });
  }

  try {
    const organizationId = req.query.organizationId as string || 'default';
    const samlResponse = req.body.SAMLResponse;
    const relayState = req.body.RelayState;

    const authResult = await samlService.processAuthResponse(
      organizationId,
      idpId,
      samlResponse,
      relayState
    );

    if (!authResult.success || !authResult.user) {
      logger.warn('SAML authentication failed', {
        idpId,
        organizationId,
        error: authResult.error
      });

      return res.status(401).json({
        error: 'SAML authentication failed',
        message: authResult.error
      });
    }

    // Create authenticated user object
    const user = {
      id: authResult.user.nameId,
      email: authResult.user.email,
      name: authResult.user.firstName && authResult.user.lastName 
        ? `${authResult.user.firstName} ${authResult.user.lastName}`
        : undefined,
      organizationId,
      roles: ['org_member'], // Would be populated from SAML attributes
      permissions: ['task:read', 'task:write'], // Would be populated from roles
      authMethod: 'saml' as const
    };

    // Create session
    const session = await authMiddleware.createSession(user, req);

    // Set session cookie
    res.cookie('sessionId', session.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    logger.info('SAML authentication successful', {
      idpId,
      organizationId,
      userId: user.id,
      email: user.email
    });

    // Redirect to relay state or default
    const redirectUrl = relayState || '/dashboard';
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('SAML callback processing failed:', error);
    res.status(500).json({ 
      error: 'Failed to process SAML authentication' 
    });
  }
});

/**
 * SAML Logout
 */
router.get('/saml/:idpId/logout', authMiddleware.authenticate({ required: false }), async (req: Request, res: Response) => {
  const { idpId } = req.params;
  
  if (!samlService) {
    return res.status(500).json({ error: 'SAML not configured' });
  }

  try {
    const organizationId = req.query.organizationId as string || 'default';
    const nameId = (req as AuthenticatedRequest).user?.id || req.query.nameId as string;
    const sessionId = req.cookies?.sessionId;

    if (nameId) {
      const logoutRequest = await samlService.generateLogoutRequest(
        organizationId,
        idpId,
        nameId,
        sessionId
      );

      logger.info('SAML logout initiated', {
        idpId,
        organizationId,
        nameId
      });

      res.redirect(logoutRequest.url);
    } else {
      // Local logout only
      if (sessionId) {
        await authMiddleware.destroySession(sessionId);
        res.clearCookie('sessionId');
      }
      res.redirect('/login');
    }

  } catch (error) {
    logger.error('SAML logout failed:', error);
    res.status(500).json({ 
      error: 'Failed to initiate SAML logout' 
    });
  }
});

/**
 * SAML Single Logout Service
 */
router.post('/saml/:idpId/sls', async (req: Request, res: Response) => {
  const { idpId } = req.params;
  
  if (!samlService) {
    return res.status(500).json({ error: 'SAML not configured' });
  }

  try {
    const organizationId = req.query.organizationId as string || 'default';
    const samlResponse = req.body.SAMLResponse;

    const logoutResult = await samlService.processLogoutResponse(
      organizationId,
      idpId,
      samlResponse
    );

    if (logoutResult.success) {
      logger.info('SAML logout successful', {
        idpId,
        organizationId
      });
    } else {
      logger.warn('SAML logout failed', {
        idpId,
        organizationId,
        error: logoutResult.error
      });
    }

    res.redirect('/login');

  } catch (error) {
    logger.error('SAML logout processing failed:', error);
    res.redirect('/login');
  }
});

// OAuth2/OIDC Authentication Routes

/**
 * OAuth2 Login - Initiate authentication
 */
router.get('/oauth2/:providerId/login', async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const state = req.query.state as string;
  
  if (!oauthService) {
    return res.status(500).json({ error: 'OAuth2 not configured' });
  }

  try {
    const authRequest = await oauthService.generateAuthorizationUrl(
      providerId,
      state
    );

    // Store state and code verifier in session for validation
    req.session = req.session || {};
    (req.session as any).oauth2State = authRequest.state;
    (req.session as any).oauth2CodeVerifier = authRequest.codeVerifier;
    (req.session as any).oauth2Nonce = authRequest.nonce;

    logger.info('OAuth2 authentication initiated', {
      providerId,
      state: authRequest.state
    });

    res.redirect(authRequest.url);

  } catch (error) {
    logger.error('OAuth2 authentication initiation failed:', error);
    res.status(500).json({ 
      error: 'Failed to initiate OAuth2 authentication' 
    });
  }
});

/**
 * OAuth2 Callback - Process authentication response
 */
router.get('/oauth2/:providerId/callback', async (req: Request, res: Response) => {
  const { providerId } = req.params;
  
  if (!oauthService) {
    return res.status(500).json({ error: 'OAuth2 not configured' });
  }

  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;
    const codeVerifier = (req.session as any)?.oauth2CodeVerifier;

    if (error) {
      logger.warn('OAuth2 authentication error', {
        providerId,
        error,
        errorDescription: req.query.error_description
      });

      return res.status(401).json({
        error: 'OAuth2 authentication failed',
        message: req.query.error_description || error
      });
    }

    if (!code) {
      return res.status(400).json({ 
        error: 'Authorization code not provided' 
      });
    }

    const authResult = await oauthService.exchangeCodeForTokens(
      providerId,
      code,
      state,
      codeVerifier
    );

    if (!authResult.success || !authResult.user) {
      logger.warn('OAuth2 token exchange failed', {
        providerId,
        error: authResult.error
      });

      return res.status(401).json({
        error: 'OAuth2 authentication failed',
        message: authResult.error
      });
    }

    // Create authenticated user object
    const organizationId = req.query.organizationId as string || 'default';
    const user = {
      id: authResult.user.id,
      email: authResult.user.email,
      name: authResult.user.name,
      organizationId,
      roles: ['org_member'], // Would be populated from OAuth2 attributes
      permissions: ['task:read', 'task:write'], // Would be populated from roles
      authMethod: 'oauth2' as const
    };

    // Create session
    const session = await authMiddleware.createSession(user, req);

    // Set session cookie
    res.cookie('sessionId', session.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    logger.info('OAuth2 authentication successful', {
      providerId,
      organizationId,
      userId: user.id,
      email: user.email
    });

    // Redirect to state or default
    const redirectUrl = authResult.state || '/dashboard';
    res.redirect(redirectUrl);

  } catch (error) {
    logger.error('OAuth2 callback processing failed:', error);
    res.status(500).json({ 
      error: 'Failed to process OAuth2 authentication' 
    });
  }
});

/**
 * Get SAML Service Provider metadata
 */
router.get('/saml/:organizationId/metadata', async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  
  if (!samlService) {
    return res.status(500).json({ error: 'SAML not configured' });
  }

  try {
    const metadata = await samlService.getServiceProviderMetadata(organizationId);
    
    res.set('Content-Type', 'application/xml');
    res.send(metadata);

  } catch (error) {
    logger.error('Failed to get SAML metadata:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve SAML metadata' 
    });
  }
});

/**
 * Validate SAML IdP metadata
 */
router.post('/saml/validate-metadata', async (req: Request, res: Response) => {
  if (!samlService) {
    return res.status(500).json({ error: 'SAML not configured' });
  }

  try {
    const { metadata } = req.body;
    
    if (!metadata) {
      return res.status(400).json({ error: 'Metadata is required' });
    }

    const validation = await samlService.validateIdPMetadata(metadata);
    
    res.json(validation);

  } catch (error) {
    logger.error('SAML metadata validation failed:', error);
    res.status(500).json({ 
      error: 'Failed to validate SAML metadata' 
    });
  }
});

/**
 * Test OAuth2 provider connection
 */
router.post('/oauth2/:providerId/test', async (req: Request, res: Response) => {
  const { providerId } = req.params;
  
  if (!oauthService) {
    return res.status(500).json({ error: 'OAuth2 not configured' });
  }

  try {
    const result = await oauthService.testConnection(providerId);
    res.json(result);

  } catch (error) {
    logger.error('OAuth2 connection test failed:', error);
    res.status(500).json({ 
      error: 'Failed to test OAuth2 connection' 
    });
  }
});

/**
 * Refresh OAuth2 access token
 */
router.post('/oauth2/:providerId/refresh', async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { refreshToken } = req.body;
  
  if (!oauthService) {
    return res.status(500).json({ error: 'OAuth2 not configured' });
  }

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const result = await oauthService.refreshAccessToken(providerId, refreshToken);
    
    if (result.success) {
      res.json({
        success: true,
        tokens: result.tokens
      });
    } else {
      res.status(401).json({
        error: 'Token refresh failed',
        message: result.error
      });
    }

  } catch (error) {
    logger.error('OAuth2 token refresh failed:', error);
    res.status(500).json({ 
      error: 'Failed to refresh OAuth2 token' 
    });
  }
});

export default router;