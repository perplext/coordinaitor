import { Router, Request, Response } from 'express';
import { OrganizationService, Organization, OrganizationUser } from '../services/organization-service';
import { SSOAuthMiddleware, PERMISSIONS, ROLES } from '../middleware/sso-auth-middleware';
import winston from 'winston';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
    roles: string[];
    permissions: string[];
    authMethod: string;
  };
  tenant?: {
    organization: Organization;
    subdomain?: string;
    domain?: string;
    isMultiTenant: boolean;
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
      filename: 'logs/organization-routes.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Store services (would be injected in real application)
let organizationService: OrganizationService;
let authMiddleware: SSOAuthMiddleware;

/**
 * Initialize organization routes with services
 */
export function initializeOrganizationRoutes(
  orgService: OrganizationService,
  middleware: SSOAuthMiddleware
) {
  organizationService = orgService;
  authMiddleware = middleware;
}

/**
 * @openapi
 * /organizations:
 *   post:
 *     tags:
 *       - Organizations
 *     summary: Create new organization
 *     description: Create a new organization with specified tier and settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *               - contactEmail
 *               - tier
 *             properties:
 *               name:
 *                 type: string
 *                 description: Organization internal name (lowercase, no spaces)
 *                 example: "acme-corp"
 *               displayName:
 *                 type: string
 *                 description: Organization display name
 *                 example: "Acme Corporation"
 *               subdomain:
 *                 type: string
 *                 description: Unique subdomain for organization
 *                 example: "acme"
 *               domain:
 *                 type: string
 *                 description: Custom domain for organization
 *                 example: "acme.com"
 *               tier:
 *                 type: string
 *                 enum: [free, starter, professional, enterprise]
 *                 description: Organization tier
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 description: Primary contact email
 *               billingEmail:
 *                 type: string
 *                 format: email
 *                 description: Billing contact email
 *               industry:
 *                 type: string
 *                 description: Organization industry
 *               size:
 *                 type: string
 *                 enum: [startup, small, medium, large, enterprise]
 *                 description: Organization size
 *               timezone:
 *                 type: string
 *                 description: Default timezone
 *                 example: "America/New_York"
 *               language:
 *                 type: string
 *                 description: Default language
 *                 example: "en"
 *               currency:
 *                 type: string
 *                 description: Default currency
 *                 example: "USD"
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *       400:
 *         description: Invalid request data
 *       409:
 *         description: Organization name or subdomain already exists
 *       500:
 *         description: Internal server error
 */
router.post('/',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_ADMIN] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        name, displayName, subdomain, domain, tier, contactEmail,
        billingEmail, industry, size, timezone, language, currency
      } = req.body;

      // Validate required fields
      if (!name || !displayName || !contactEmail || !tier) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'displayName', 'contactEmail', 'tier']
        });
      }

      // Validate tier
      const validTiers = ['free', 'starter', 'professional', 'enterprise'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({
          error: 'Invalid tier',
          validTiers
        });
      }

      const organization = await organizationService.createOrganization({
        name,
        displayName,
        subdomain,
        domain,
        tier,
        createdBy: req.user!.id,
        contactEmail,
        billingEmail,
        industry,
        size,
        timezone,
        language,
        currency
      });

      logger.info('Organization created', {
        organizationId: organization.id,
        name: organization.name,
        tier: organization.tier,
        createdBy: req.user!.id
      });

      res.status(201).json({
        success: true,
        organization
      });

    } catch (error) {
      logger.error('Failed to create organization:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return res.status(409).json({
            error: 'Organization already exists',
            message: error.message
          });
        }
      }

      res.status(500).json({
        error: 'Failed to create organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organizations:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: List organizations
 *     description: Get paginated list of organizations (super admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, pending, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [free, starter, professional, enterprise]
 *         description: Filter by tier
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, display name, or contact email
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Organization'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       403:
 *         description: Insufficient permissions (super admin required)
 */
router.get('/',
  authMiddleware.authenticate({ 
    required: true, 
    roles: [ROLES.SUPER_ADMIN] 
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const status = req.query.status as string;
      const tier = req.query.tier as string;
      const search = req.query.search as string;

      const result = await organizationService.listOrganizations({
        limit,
        offset,
        status,
        tier,
        search
      });

      const totalPages = Math.ceil(result.total / limit);

      res.json({
        organizations: result.organizations,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages
        }
      });

    } catch (error) {
      logger.error('Failed to list organizations:', error);
      res.status(500).json({
        error: 'Failed to list organizations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organizations/{id}:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get organization details
 *     description: Get detailed information about an organization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Organization not found
 *       403:
 *         description: Access denied to organization
 */
router.get('/:id',
  authMiddleware.authenticate({ required: true }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const organization = await organizationService.getOrganization(id);
      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found'
        });
      }

      res.json(organization);

    } catch (error) {
      logger.error('Failed to get organization:', error);
      res.status(500).json({
        error: 'Failed to get organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organizations/{id}:
 *   put:
 *     tags:
 *       - Organizations
 *     summary: Update organization
 *     description: Update organization details (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               billingEmail:
 *                 type: string
 *                 format: email
 *               industry:
 *                 type: string
 *               size:
 *                 type: string
 *                 enum: [startup, small, medium, large, enterprise]
 *               timezone:
 *                 type: string
 *               language:
 *                 type: string
 *               currency:
 *                 type: string
 *               logo:
 *                 type: string
 *                 format: uri
 *               website:
 *                 type: string
 *                 format: uri
 *               settings:
 *                 type: object
 *                 description: Organization settings
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       404:
 *         description: Organization not found
 *       403:
 *         description: Insufficient permissions
 */
router.put('/:id',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updates.id;
      delete updates.name;
      delete updates.createdAt;
      delete updates.createdBy;
      delete updates.tier; // Tier changes should go through billing

      const organization = await organizationService.updateOrganization(id, updates);

      logger.info('Organization updated', {
        organizationId: id,
        updatedBy: req.user!.id,
        changes: Object.keys(updates)
      });

      res.json({
        success: true,
        organization
      });

    } catch (error) {
      logger.error('Failed to update organization:', error);
      res.status(500).json({
        error: 'Failed to update organization',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organizations/{id}/usage:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get organization usage
 *     description: Get current usage statistics and limits for organization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *           example: "2023-12"
 *         description: Usage period (YYYY-MM format, defaults to current month)
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizationId:
 *                   type: string
 *                   format: uuid
 *                 period:
 *                   type: string
 *                   example: "2023-12"
 *                 usage:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: integer
 *                     projects:
 *                       type: integer
 *                     tasks:
 *                       type: integer
 *                     storageGB:
 *                       type: number
 *                     apiCalls:
 *                       type: integer
 *                     agentExecutions:
 *                       type: integer
 *                 limits:
 *                   type: object
 *                   properties:
 *                     maxUsers:
 *                       type: integer
 *                     maxProjects:
 *                       type: integer
 *                     maxTasksPerMonth:
 *                       type: integer
 *                     maxStorageGB:
 *                       type: integer
 *                     maxAPICallsPerMonth:
 *                       type: integer
 *                 costs:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     breakdown:
 *                       type: object
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/:id/usage',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const period = req.query.period as string;

      const usage = await organizationService.getOrganizationUsage(id, period);

      res.json(usage);

    } catch (error) {
      logger.error('Failed to get organization usage:', error);
      res.status(500).json({
        error: 'Failed to get organization usage',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organizations/{id}/limits:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Check organization limits
 *     description: Check if organization is within its limits and get warnings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Limit check completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 withinLimits:
 *                   type: boolean
 *                 violations:
 *                   type: array
 *                   items:
 *                     type: string
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/:id/limits',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const limits = await organizationService.checkLimits(id);

      res.json(limits);

    } catch (error) {
      logger.error('Failed to check organization limits:', error);
      res.status(500).json({
        error: 'Failed to check organization limits',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organizations/{id}/users:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: List organization users
 *     description: Get list of users in the organization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       email:
 *                         type: string
 *                         format: email
 *                       role:
 *                         type: string
 *                         enum: [owner, admin, member, viewer, billing]
 *                       status:
 *                         type: string
 *                         enum: [active, inactive, pending, suspended]
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 *                       lastLoginAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/:id/users',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.USER_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      // TODO: Implement getOrganizationUsers method
      const users: OrganizationUser[] = [];

      res.json({ users });

    } catch (error) {
      logger.error('Failed to get organization users:', error);
      res.status(500).json({
        error: 'Failed to get organization users',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;