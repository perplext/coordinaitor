import { Router, Request, Response } from 'express';
import { OrganizationConfigService } from '../services/organization-config-service';
import { SSOAuthMiddleware, PERMISSIONS } from '../middleware/sso-auth-middleware';
import { AgentRegistry } from '../agents/agent-registry';
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
    organization: any;
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
      filename: 'logs/organization-config-routes.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Store services (would be injected in real application)
let configService: OrganizationConfigService;
let authMiddleware: SSOAuthMiddleware;

/**
 * Initialize organization config routes with services
 */
export function initializeOrganizationConfigRoutes(
  config: OrganizationConfigService,
  middleware: SSOAuthMiddleware
) {
  configService = config;
  authMiddleware = middleware;
}

/**
 * @openapi
 * /organization-config/agents:
 *   get:
 *     tags:
 *       - Organization Configuration
 *     summary: Get organization agent configurations
 *     description: Retrieve all agent configurations for the organization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent configurations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationAgentConfig'
 */
router.get('/agents',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const agents = await configService.getOrganizationAgentConfigs(organizationId);
      res.json({ agents });
    } catch (error) {
      logger.error('Failed to get organization agent configs:', error);
      res.status(500).json({
        error: 'Failed to get agent configurations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/agents/available:
 *   get:
 *     tags:
 *       - Organization Configuration
 *     summary: Get available agents for organization
 *     description: Get list of agents available for the organization based on tier
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available agents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/agents/available',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const agents = await configService.getAvailableAgentsForOrganization(organizationId);
      res.json({ agents });
    } catch (error) {
      logger.error('Failed to get available agents:', error);
      res.status(500).json({
        error: 'Failed to get available agents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/agents/{agentId}:
 *   put:
 *     tags:
 *       - Organization Configuration
 *     summary: Configure organization agent
 *     description: Create or update configuration for a specific agent
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Whether the agent is enabled
 *               priority:
 *                 type: integer
 *                 description: Agent priority (lower = higher priority)
 *               maxConcurrentTasks:
 *                 type: integer
 *                 description: Maximum concurrent tasks for this agent
 *               config:
 *                 type: object
 *                 description: Agent-specific configuration
 *     responses:
 *       200:
 *         description: Agent configured successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agent:
 *                   $ref: '#/components/schemas/OrganizationAgentConfig'
 */
router.put('/agents/:agentId',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const { agentId } = req.params;
      const config = req.body;

      const agent = await configService.configureOrganizationAgent(organizationId, agentId, config);

      logger.info('Agent configured', {
        organizationId,
        agentId,
        enabled: agent.enabled,
        configuredBy: req.user!.id
      });

      res.json({ agent });
    } catch (error) {
      logger.error('Failed to configure agent:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Resource not found',
            message: error.message
          });
        }
        if (error.message.includes('limit exceeded')) {
          return res.status(400).json({
            error: 'Limit exceeded',
            message: error.message
          });
        }
      }

      res.status(500).json({
        error: 'Failed to configure agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/features:
 *   get:
 *     tags:
 *       - Organization Configuration
 *     summary: Get organization feature configurations
 *     description: Retrieve all feature configurations for the organization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feature configurations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 features:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationFeatureConfig'
 */
router.get('/features',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const features = await configService.getOrganizationFeatureConfigs(organizationId);
      res.json({ features });
    } catch (error) {
      logger.error('Failed to get organization feature configs:', error);
      res.status(500).json({
        error: 'Failed to get feature configurations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/features/{featureName}:
 *   put:
 *     tags:
 *       - Organization Configuration
 *     summary: Configure organization feature
 *     description: Create or update configuration for a specific feature
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureName
 *         required: true
 *         schema:
 *           type: string
 *         description: Feature name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Whether the feature is enabled
 *               config:
 *                 type: object
 *                 description: Feature-specific configuration
 *               limits:
 *                 type: object
 *                 description: Feature usage limits
 *     responses:
 *       200:
 *         description: Feature configured successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feature:
 *                   $ref: '#/components/schemas/OrganizationFeatureConfig'
 */
router.put('/features/:featureName',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const { featureName } = req.params;
      const config = req.body;

      const feature = await configService.configureOrganizationFeature(organizationId, featureName, config);

      logger.info('Feature configured', {
        organizationId,
        featureName,
        enabled: feature.enabled,
        configuredBy: req.user!.id
      });

      res.json({ feature });
    } catch (error) {
      logger.error('Failed to configure feature:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not available')) {
          return res.status(403).json({
            error: 'Feature not available',
            message: error.message
          });
        }
      }

      res.status(500).json({
        error: 'Failed to configure feature',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/workflows:
 *   get:
 *     tags:
 *       - Organization Configuration
 *     summary: Get organization workflows
 *     description: Retrieve all workflows for the organization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflows retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationWorkflowConfig'
 */
router.get('/workflows',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const workflows = await configService.getOrganizationWorkflows(organizationId);
      res.json({ workflows });
    } catch (error) {
      logger.error('Failed to get organization workflows:', error);
      res.status(500).json({
        error: 'Failed to get workflows',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/workflows:
 *   post:
 *     tags:
 *       - Organization Configuration
 *     summary: Create organization workflow
 *     description: Create a new workflow for the organization
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
 *               - triggerEvents
 *               - actions
 *             properties:
 *               name:
 *                 type: string
 *                 description: Workflow name
 *               description:
 *                 type: string
 *                 description: Workflow description
 *               enabled:
 *                 type: boolean
 *                 description: Whether the workflow is enabled
 *               triggerEvents:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Events that trigger this workflow
 *               actions:
 *                 type: array
 *                 description: Actions to execute
 *               conditions:
 *                 type: array
 *                 description: Conditions for workflow execution
 *               schedule:
 *                 type: object
 *                 description: Schedule configuration
 *     responses:
 *       201:
 *         description: Workflow created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 workflow:
 *                   $ref: '#/components/schemas/OrganizationWorkflowConfig'
 */
router.post('/workflows',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const workflowData = req.body;

      const workflow = await configService.createOrganizationWorkflow(organizationId, workflowData);

      logger.info('Workflow created', {
        organizationId,
        workflowId: workflow.id,
        name: workflow.name,
        createdBy: req.user!.id
      });

      res.status(201).json({ workflow });
    } catch (error) {
      logger.error('Failed to create workflow:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not available')) {
          return res.status(403).json({
            error: 'Feature not available',
            message: error.message
          });
        }
      }

      res.status(500).json({
        error: 'Failed to create workflow',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/integrations:
 *   get:
 *     tags:
 *       - Organization Configuration
 *     summary: Get organization integrations
 *     description: Retrieve all integrations for the organization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Integrations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 integrations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrganizationIntegrationConfig'
 */
router.get('/integrations',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const integrations = await configService.getOrganizationIntegrations(organizationId);
      
      // Remove sensitive credentials from response
      const sanitizedIntegrations = integrations.map(integration => ({
        ...integration,
        credentials: {} // Don't expose credentials
      }));

      res.json({ integrations: sanitizedIntegrations });
    } catch (error) {
      logger.error('Failed to get organization integrations:', error);
      res.status(500).json({
        error: 'Failed to get integrations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /organization-config/integrations:
 *   post:
 *     tags:
 *       - Organization Configuration
 *     summary: Create organization integration
 *     description: Create a new integration for the organization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - integrationType
 *               - name
 *             properties:
 *               integrationType:
 *                 type: string
 *                 description: Type of integration
 *               name:
 *                 type: string
 *                 description: Integration name
 *               enabled:
 *                 type: boolean
 *                 description: Whether the integration is enabled
 *               credentials:
 *                 type: object
 *                 description: Integration credentials
 *               config:
 *                 type: object
 *                 description: Integration configuration
 *               webhookUrl:
 *                 type: string
 *                 description: Webhook URL for the integration
 *     responses:
 *       201:
 *         description: Integration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 integration:
 *                   $ref: '#/components/schemas/OrganizationIntegrationConfig'
 */
router.post('/integrations',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.ORG_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const integrationData = req.body;

      const integration = await configService.createOrganizationIntegration(organizationId, integrationData);

      // Remove credentials from response
      const sanitizedIntegration = {
        ...integration,
        credentials: {} // Don't expose credentials
      };

      logger.info('Integration created', {
        organizationId,
        integrationId: integration.id,
        type: integration.integrationType,
        createdBy: req.user!.id
      });

      res.status(201).json({ integration: sanitizedIntegration });
    } catch (error) {
      logger.error('Failed to create integration:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not available')) {
          return res.status(403).json({
            error: 'Integration not available',
            message: error.message
          });
        }
      }

      res.status(500).json({
        error: 'Failed to create integration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;