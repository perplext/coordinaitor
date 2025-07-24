import { Router, Request, Response } from 'express';
import { SAMLService } from '../services/saml-service';
import { OAuth2Service } from '../services/oauth-service';
import { SSOAuthMiddleware, PERMISSIONS } from '../middleware/sso-auth-middleware';
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
      filename: 'logs/sso-routes.log',
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
 * Initialize SSO routes with services
 */
export function initializeSSORoutes(
  saml: SAMLService,
  oauth: OAuth2Service,
  middleware: SSOAuthMiddleware
) {
  samlService = saml;
  oauthService = oauth;
  authMiddleware = middleware;
}

// SSO Settings Routes

/**
 * @openapi
 * /sso/settings:
 *   get:
 *     tags:
 *       - SSO
 *     summary: Get SSO settings
 *     description: Retrieve SSO settings for the user's organization
 *     security:
 *       - bearerAuth: []
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: SSO settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                       description: Whether SSO is enabled
 *                     allowLocalAuth:
 *                       type: boolean
 *                       description: Whether local authentication is allowed
 *                     forceSSO:
 *                       type: boolean
 *                       description: Whether SSO is mandatory
 *                     sessionTimeout:
 *                       type: integer
 *                       description: Session timeout in milliseconds
 *                     organizationId:
 *                       type: string
 *                       description: Organization identifier
 *             example:
 *               settings:
 *                 enabled: true
 *                 allowLocalAuth: true
 *                 forceSSO: false
 *                 sessionTimeout: 86400000
 *                 organizationId: "default"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/settings', 
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_READ] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || 'default';
      
      // Mock SSO settings - replace with actual database query
      const settings = {
        enabled: true,
        allowLocalAuth: true,
        forceSSO: false,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        organizationId
      };

      res.json({ settings });

    } catch (error) {
      logger.error('Failed to get SSO settings:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve SSO settings' 
      });
    }
  }
);

/**
 * Update SSO settings for organization
 */
router.put('/settings',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_ADMIN] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || 'default';
      const { enabled, allowLocalAuth, forceSSO, sessionTimeout } = req.body;

      // Mock settings update - replace with actual database update
      const updatedSettings = {
        enabled: enabled ?? true,
        allowLocalAuth: allowLocalAuth ?? true,
        forceSSO: forceSSO ?? false,
        sessionTimeout: sessionTimeout ?? 24 * 60 * 60 * 1000,
        organizationId,
        updatedAt: new Date()
      };

      logger.info('SSO settings updated', {
        organizationId,
        updatedBy: req.user?.id,
        settings: updatedSettings
      });

      res.json({ 
        success: true,
        settings: updatedSettings 
      });

    } catch (error) {
      logger.error('Failed to update SSO settings:', error);
      res.status(500).json({ 
        error: 'Failed to update SSO settings' 
      });
    }
  }
);

// SAML Provider Routes

/**
 * List SAML providers for organization
 */
router.get('/saml/providers',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_READ] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || 'default';
      
      if (!samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      const providers = await samlService.listIdentityProviders(organizationId);
      
      res.json({ providers });

    } catch (error) {
      logger.error('Failed to list SAML providers:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve SAML providers' 
      });
    }
  }
);

/**
 * Create new SAML provider
 */
router.post('/saml/providers',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_WRITE] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || 'default';
      
      if (!samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      const {
        name,
        entityId,
        ssoUrl,
        sloUrl,
        metadata,
        publicCert,
        nameIdFormat,
        attributeMapping,
        autoProvisionUsers,
        defaultRole,
        allowedDomains,
        enabled
      } = req.body;

      // Validate required fields
      if (!name || !entityId || !ssoUrl) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'entityId', 'ssoUrl']
        });
      }

      if (!metadata && !publicCert) {
        return res.status(400).json({
          error: 'Either metadata or public certificate is required'
        });
      }

      const providerId = await samlService.createIdentityProvider(organizationId, {
        name,
        entityId,
        ssoUrl,
        sloUrl,
        metadata,
        publicCert,
        nameIdFormat: nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attributeMapping: attributeMapping || {
          email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
          firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
          lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
          groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
        },
        autoProvisionUsers: autoProvisionUsers ?? true,
        defaultRole: defaultRole || 'org_member',
        allowedDomains: allowedDomains || [],
        enabled: enabled ?? true
      });

      logger.info('SAML provider created', {
        organizationId,
        providerId,
        name,
        createdBy: req.user?.id
      });

      res.status(201).json({
        success: true,
        providerId,
        message: 'SAML provider created successfully'
      });

    } catch (error) {
      logger.error('Failed to create SAML provider:', error);
      res.status(500).json({ 
        error: 'Failed to create SAML provider',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Update SAML provider
 */
router.put('/saml/providers/:providerId',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_WRITE] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      await samlService.updateIdentityProvider(organizationId, providerId, req.body);

      logger.info('SAML provider updated', {
        organizationId,
        providerId,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'SAML provider updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update SAML provider:', error);
      res.status(500).json({ 
        error: 'Failed to update SAML provider',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Delete SAML provider
 */
router.delete('/saml/providers/:providerId',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_ADMIN] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      await samlService.deleteIdentityProvider(organizationId, providerId);

      logger.info('SAML provider deleted', {
        organizationId,
        providerId,
        deletedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'SAML provider deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete SAML provider:', error);
      res.status(500).json({ 
        error: 'Failed to delete SAML provider',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get SAML provider mapping configuration
 */
router.get('/saml/providers/:providerId/mapping',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_READ] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      const provider = await samlService.getIdentityProvider(organizationId, providerId);
      
      if (!provider) {
        return res.status(404).json({ error: 'SAML provider not found' });
      }

      res.json({
        attributeMapping: provider.attributeMapping,
        userProvisioning: {
          autoCreate: provider.autoProvisionUsers,
          autoUpdate: true,
          autoSuspend: false,
          defaultRole: provider.defaultRole,
          allowedDomains: provider.allowedDomains,
          groupMappings: provider.groupMappings || [],
          roleMappings: provider.roleMappings || []
        }
      });

    } catch (error) {
      logger.error('Failed to get SAML provider mapping:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve SAML provider mapping' 
      });
    }
  }
);

/**
 * Update SAML provider mapping configuration
 */
router.put('/saml/providers/:providerId/mapping',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_WRITE] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      const { attributeMapping, userProvisioning } = req.body;
      
      if (!samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      await samlService.updateIdentityProvider(organizationId, providerId, {
        attributeMapping,
        autoProvisionUsers: userProvisioning.autoCreate,
        defaultRole: userProvisioning.defaultRole,
        allowedDomains: userProvisioning.allowedDomains,
        groupMappings: userProvisioning.groupMappings,
        roleMappings: userProvisioning.roleMappings
      });

      logger.info('SAML provider mapping updated', {
        organizationId,
        providerId,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'SAML provider mapping updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update SAML provider mapping:', error);
      res.status(500).json({ 
        error: 'Failed to update SAML provider mapping' 
      });
    }
  }
);

/**
 * Test SAML provider mapping
 */
router.post('/saml/providers/:providerId/test-mapping',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_READ] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!samlService) {
        return res.status(500).json({ error: 'SAML service not configured' });
      }

      // Mock test results - replace with actual mapping test
      const testResults = {
        success: true,
        mappedAttributes: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          groups: ['users', 'developers'],
          department: 'Engineering'
        },
        assignedRole: 'org_member',
        assignedGroups: ['application-users'],
        warnings: []
      };

      res.json(testResults);

    } catch (error) {
      logger.error('Failed to test SAML provider mapping:', error);
      res.status(500).json({ 
        error: 'Failed to test SAML provider mapping' 
      });
    }
  }
);

// OAuth2 Provider Routes

/**
 * List OAuth2 providers for organization
 */
router.get('/oauth2/providers',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_READ] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || 'default';
      
      if (!oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      const providers = await oauthService.listProviders(organizationId);
      
      res.json({ providers });

    } catch (error) {
      logger.error('Failed to list OAuth2 providers:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve OAuth2 providers' 
      });
    }
  }
);

/**
 * Create new OAuth2 provider
 */
router.post('/oauth2/providers',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_WRITE] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || 'default';
      
      if (!oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      const {
        name,
        provider,
        clientId,
        clientSecret,
        authorizationUrl,
        tokenUrl,
        userInfoUrl,
        jwksUrl,
        scopes,
        redirectUri,
        discoveryUrl,
        useDiscovery,
        issuer,
        enabled
      } = req.body;

      // Validate required fields
      if (!name || !provider || !clientId || !clientSecret) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'provider', 'clientId', 'clientSecret']
        });
      }

      if (!useDiscovery && (!authorizationUrl || !tokenUrl)) {
        return res.status(400).json({
          error: 'Authorization URL and Token URL are required when not using discovery'
        });
      }

      const providerId = await oauthService.createProvider(organizationId, {
        name,
        provider,
        clientId,
        clientSecret,
        authorizationUrl,
        tokenUrl,
        userInfoUrl,
        jwksUrl,
        scopes: Array.isArray(scopes) ? scopes : scopes?.split(' ').filter(Boolean) || [],
        redirectUri: redirectUri || `${req.protocol}://${req.get('host')}/auth/oauth2/${provider}/callback`,
        discoveryUrl,
        useDiscovery: useDiscovery ?? true,
        issuer,
        enabled: enabled ?? true
      });

      logger.info('OAuth2 provider created', {
        organizationId,
        providerId,
        name,
        provider,
        createdBy: req.user?.id
      });

      res.status(201).json({
        success: true,
        providerId,
        message: 'OAuth2 provider created successfully'
      });

    } catch (error) {
      logger.error('Failed to create OAuth2 provider:', error);
      res.status(500).json({ 
        error: 'Failed to create OAuth2 provider',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Update OAuth2 provider
 */
router.put('/oauth2/providers/:providerId',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_WRITE] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      await oauthService.updateProvider(organizationId, providerId, req.body);

      logger.info('OAuth2 provider updated', {
        organizationId,
        providerId,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'OAuth2 provider updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update OAuth2 provider:', error);
      res.status(500).json({ 
        error: 'Failed to update OAuth2 provider',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Delete OAuth2 provider
 */
router.delete('/oauth2/providers/:providerId',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_ADMIN] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      await oauthService.deleteProvider(organizationId, providerId);

      logger.info('OAuth2 provider deleted', {
        organizationId,
        providerId,
        deletedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'OAuth2 provider deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete OAuth2 provider:', error);
      res.status(500).json({ 
        error: 'Failed to delete OAuth2 provider',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get OAuth2 provider mapping configuration
 */
router.get('/oauth2/providers/:providerId/mapping',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_READ] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      const provider = await oauthService.getProvider(organizationId, providerId);
      
      if (!provider) {
        return res.status(404).json({ error: 'OAuth2 provider not found' });
      }

      res.json({
        attributeMapping: provider.attributeMapping || {
          email: 'email',
          firstName: 'given_name',
          lastName: 'family_name',
          displayName: 'name',
          groups: 'groups'
        },
        userProvisioning: {
          autoCreate: provider.autoProvisionUsers ?? true,
          autoUpdate: true,
          autoSuspend: false,
          defaultRole: provider.defaultRole || 'org_member',
          allowedDomains: provider.allowedDomains || [],
          groupMappings: provider.groupMappings || [],
          roleMappings: provider.roleMappings || []
        }
      });

    } catch (error) {
      logger.error('Failed to get OAuth2 provider mapping:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve OAuth2 provider mapping' 
      });
    }
  }
);

/**
 * Update OAuth2 provider mapping configuration
 */
router.put('/oauth2/providers/:providerId/mapping',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_WRITE] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      const { attributeMapping, userProvisioning } = req.body;
      
      if (!oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      await oauthService.updateProvider(organizationId, providerId, {
        attributeMapping,
        autoProvisionUsers: userProvisioning.autoCreate,
        defaultRole: userProvisioning.defaultRole,
        allowedDomains: userProvisioning.allowedDomains,
        groupMappings: userProvisioning.groupMappings,
        roleMappings: userProvisioning.roleMappings
      });

      logger.info('OAuth2 provider mapping updated', {
        organizationId,
        providerId,
        updatedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'OAuth2 provider mapping updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update OAuth2 provider mapping:', error);
      res.status(500).json({ 
        error: 'Failed to update OAuth2 provider mapping' 
      });
    }
  }
);

/**
 * Test OAuth2 provider mapping
 */
router.post('/oauth2/providers/:providerId/test-mapping',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.SSO_READ] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { providerId } = req.params;
      const organizationId = req.user?.organizationId || 'default';
      
      if (!oauthService) {
        return res.status(500).json({ error: 'OAuth2 service not configured' });
      }

      // Mock test results - replace with actual mapping test
      const testResults = {
        success: true,
        mappedAttributes: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          displayName: 'Test User',
          groups: ['users', 'developers']
        },
        assignedRole: 'org_member',
        assignedGroups: ['application-users'],
        warnings: []
      };

      res.json(testResults);

    } catch (error) {
      logger.error('Failed to test OAuth2 provider mapping:', error);
      res.status(500).json({ 
        error: 'Failed to test OAuth2 provider mapping' 
      });
    }
  }
);

export default router;