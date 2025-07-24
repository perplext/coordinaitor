import express, { Request, Response } from 'express';
import { AgentMarketplaceService } from '../services/agent-marketplace-service';
import { AgentRegistry } from '../agents/agent-registry';
import { NotificationService } from '../services/notification-service';
import { authMiddleware } from '../middleware/auth-middleware';
import { tenantIsolationMiddleware } from '../middleware/tenant-isolation-middleware';
import { validateRequest } from '../middleware/validation-middleware';
import { body, param, query } from 'express-validator';
import winston from 'winston';

const router = express.Router();

// Services
let marketplaceService: AgentMarketplaceService;
let logger: winston.Logger;

// Initialize services
export const initializeMarketplaceRoutes = (
  agentRegistry: AgentRegistry, 
  notificationService: NotificationService
) => {
  marketplaceService = new AgentMarketplaceService(agentRegistry, notificationService);
  
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({ format: winston.format.simple() }),
      new winston.transports.File({ filename: 'logs/marketplace-routes.log' })
    ]
  });
};

// Apply middleware
router.use(authMiddleware);
router.use(tenantIsolationMiddleware().isolate());

/**
 * @swagger
 * /api/marketplace/agents:
 *   get:
 *     summary: Search marketplace agents
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [llm, specialized, integration, workflow, utility]
 *         description: Filter by category
 *       - in: query
 *         name: pricing
 *         schema:
 *           type: string
 *           enum: [free, paid, all]
 *         description: Filter by pricing model
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *         description: Filter by verification status
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         description: Minimum rating filter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Number of results to skip
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, rating, downloads, updated, name]
 *         description: Sort criteria
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MarketplaceAgent'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 */
router.get('/agents', 
  validateRequest([
    query('query').optional().isString().trim(),
    query('category').optional().isIn(['llm', 'specialized', 'integration', 'workflow', 'utility']),
    query('pricing').optional().isIn(['free', 'paid', 'all']),
    query('verified').optional().isBoolean(),
    query('minRating').optional().isFloat({ min: 1, max: 5 }),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('sortBy').optional().isIn(['relevance', 'rating', 'downloads', 'updated', 'name']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ]),
  async (req: Request, res: Response) => {
    try {
      const searchCriteria = {
        query: req.query.query as string,
        category: req.query.category as string,
        pricing: req.query.pricing as 'free' | 'paid' | 'all',
        verified: req.query.verified === 'true',
        minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
        sortBy: req.query.sortBy as 'relevance' | 'rating' | 'downloads' | 'updated' | 'name',
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      const result = await marketplaceService.searchAgents(searchCriteria);

      res.json({
        success: true,
        agents: result.agents,
        total: result.total,
        limit: searchCriteria.limit,
        offset: searchCriteria.offset
      });
    } catch (error) {
      logger.error('Error searching agents:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search agents'
      });
    }
  }
);

/**
 * @swagger
 * /api/marketplace/agents/{agentId}:
 *   get:
 *     summary: Get agent details
 *     tags: [Marketplace]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     responses:
 *       200:
 *         description: Agent details
 *       404:
 *         description: Agent not found
 */
router.get('/agents/:agentId',
  validateRequest([
    param('agentId').isUUID().withMessage('Invalid agent ID')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const details = await marketplaceService.getAgentDetails(agentId);

      res.json({
        success: true,
        agent: details.agent,
        reviews: details.reviews,
        installations: details.installations
      });
    } catch (error) {
      logger.error('Error getting agent details:', error);
      if (error.message === 'Agent not found') {
        res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get agent details'
        });
      }
    }
  }
);

/**
 * @swagger
 * /api/marketplace/agents:
 *   post:
 *     summary: Publish agent to marketplace
 *     tags: [Marketplace]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, displayName, description, author, category, installation]
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               longDescription:
 *                 type: string
 *               version:
 *                 type: string
 *               author:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   organization:
 *                     type: string
 *                   website:
 *                     type: string
 *               category:
 *                 type: string
 *                 enum: [llm, specialized, integration, workflow, utility]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               pricing:
 *                 type: object
 *               installation:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [native, docker, api, webhook]
 *     responses:
 *       201:
 *         description: Agent published successfully
 *       400:
 *         description: Invalid agent data
 */
router.post('/agents',
  validateRequest([
    body('name').isString().trim().isLength({ min: 1, max: 255 }),
    body('displayName').isString().trim().isLength({ min: 1, max: 255 }),
    body('description').isString().trim().isLength({ min: 1, max: 1000 }),
    body('longDescription').optional().isString().trim(),
    body('version').optional().isString().trim(),
    body('author.name').isString().trim().isLength({ min: 1 }),
    body('author.email').isEmail(),
    body('author.organization').optional().isString().trim(),
    body('author.website').optional().isURL(),
    body('category').isIn(['llm', 'specialized', 'integration', 'workflow', 'utility']),
    body('tags').optional().isArray(),
    body('capabilities').optional().isArray(),
    body('installation.type').isIn(['native', 'docker', 'api', 'webhook'])
  ]),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const agent = await marketplaceService.publishAgent(req.body, userId);

      res.status(201).json({
        success: true,
        agent
      });
    } catch (error) {
      logger.error('Error publishing agent:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to publish agent'
      });
    }
  }
);

/**
 * @swagger
 * /api/marketplace/agents/{agentId}/install:
 *   post:
 *     summary: Install agent for organization
 *     tags: [Marketplace]
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
 *               configuration:
 *                 type: object
 *               secrets:
 *                 type: object
 *     responses:
 *       200:
 *         description: Installation initiated
 *       400:
 *         description: Installation failed
 *       409:
 *         description: Agent already installed
 */
router.post('/agents/:agentId/install',
  validateRequest([
    param('agentId').isUUID().withMessage('Invalid agent ID'),
    body('configuration').optional().isObject(),
    body('secrets').optional().isObject()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { configuration = {}, secrets = {} } = req.body;
      const organizationId = req.tenant?.organization.id;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Organization or user context missing'
        });
      }

      const installation = await marketplaceService.installAgent(
        agentId,
        organizationId,
        userId,
        configuration,
        secrets
      );

      res.json({
        success: true,
        installation
      });
    } catch (error) {
      logger.error('Error installing agent:', error);
      const status = error.message.includes('already installed') ? 409 : 400;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to install agent'
      });
    }
  }
);

/**
 * @swagger
 * /api/marketplace/installations/{installationId}:
 *   delete:
 *     summary: Uninstall agent
 *     tags: [Marketplace]
 *     parameters:
 *       - in: path
 *         name: installationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Installation ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agent uninstalled
 *       404:
 *         description: Installation not found
 */
router.delete('/installations/:installationId',
  validateRequest([
    param('installationId').isUUID().withMessage('Invalid installation ID'),
    body('reason').optional().isString().trim()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { installationId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      await marketplaceService.uninstallAgent(installationId, userId, reason);

      res.json({
        success: true,
        message: 'Agent uninstalled successfully'
      });
    } catch (error) {
      logger.error('Error uninstalling agent:', error);
      const status = error.message === 'Installation not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to uninstall agent'
      });
    }
  }
);

/**
 * @swagger
 * /api/marketplace/installed:
 *   get:
 *     summary: Get organization's installed agents
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: List of installed agents
 */
router.get('/installed', async (req: Request, res: Response) => {
  try {
    const organizationId = req.tenant?.organization.id;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization context missing'
      });
    }

    const result = await marketplaceService.getInstalledAgents(organizationId);

    res.json({
      success: true,
      installations: result.installations,
      agents: result.agents
    });
  } catch (error) {
    logger.error('Error getting installed agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get installed agents'
    });
  }
});

/**
 * @swagger
 * /api/marketplace/agents/{agentId}/reviews:
 *   post:
 *     summary: Submit agent review
 *     tags: [Marketplace]
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
 *             required: [rating, title, review]
 *             properties:
 *               version:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               review:
 *                 type: string
 *               pros:
 *                 type: array
 *                 items:
 *                   type: string
 *               cons:
 *                 type: array
 *                 items:
 *                   type: string
 *               useCase:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review submitted
 *       400:
 *         description: Invalid review data
 *       409:
 *         description: User already reviewed this agent
 */
router.post('/agents/:agentId/reviews',
  validateRequest([
    param('agentId').isUUID().withMessage('Invalid agent ID'),
    body('version').optional().isString().trim(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('title').isString().trim().isLength({ min: 1, max: 255 }),
    body('review').isString().trim().isLength({ min: 1, max: 2000 }),
    body('pros').optional().isArray(),
    body('cons').optional().isArray(),
    body('useCase').optional().isString().trim()
  ]),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const organizationId = req.tenant?.organization.id;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Organization or user context missing'
        });
      }

      const reviewData = {
        marketplaceAgentId: agentId,
        organizationId,
        userId,
        version: req.body.version || '1.0.0',
        rating: req.body.rating,
        title: req.body.title,
        review: req.body.review,
        pros: req.body.pros,
        cons: req.body.cons,
        useCase: req.body.useCase
      };

      const review = await marketplaceService.reviewAgent(reviewData);

      res.status(201).json({
        success: true,
        review
      });
    } catch (error) {
      logger.error('Error submitting review:', error);
      const status = error.message.includes('already reviewed') ? 409 : 400;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to submit review'
      });
    }
  }
);

/**
 * @swagger
 * /api/marketplace/categories:
 *   get:
 *     summary: Get marketplace categories
 *     tags: [Marketplace]
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    // This would typically fetch from database
    const categories = [
      {
        id: 'llm',
        name: 'llm',
        displayName: 'Large Language Models',
        description: 'AI models for text generation, analysis, and conversation',
        icon: 'brain'
      },
      {
        id: 'specialized',
        name: 'specialized',
        displayName: 'Specialized AI',
        description: 'Domain-specific AI agents for particular use cases',
        icon: 'target'
      },
      {
        id: 'integration',
        name: 'integration',
        displayName: 'Integrations',
        description: 'Agents that connect to external services and APIs',
        icon: 'link'
      },
      {
        id: 'workflow',
        name: 'workflow',
        displayName: 'Workflow Automation',
        description: 'Agents for automating complex workflows and processes',
        icon: 'flow'
      },
      {
        id: 'utility',
        name: 'utility',
        displayName: 'Utilities',
        description: 'Helper agents for common tasks and operations',
        icon: 'tool'
      }
    ];

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories'
    });
  }
});

/**
 * @swagger
 * /api/marketplace/popular:
 *   get:
 *     summary: Get popular agents
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Number of agents to return
 *     responses:
 *       200:
 *         description: List of popular agents
 */
router.get('/popular', 
  validateRequest([
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
  ]),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const result = await marketplaceService.searchAgents({
        sortBy: 'downloads',
        sortOrder: 'desc',
        limit
      });

      res.json({
        success: true,
        agents: result.agents
      });
    } catch (error) {
      logger.error('Error getting popular agents:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get popular agents'
      });
    }
  }
);

/**
 * @swagger
 * /api/marketplace/trending:
 *   get:
 *     summary: Get trending agents
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Number of agents to return
 *     responses:
 *       200:
 *         description: List of trending agents
 */
router.get('/trending',
  validateRequest([
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
  ]),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // For now, return recent agents with good ratings
      const result = await marketplaceService.searchAgents({
        sortBy: 'updated',
        sortOrder: 'desc',
        minRating: 4,
        limit
      });

      res.json({
        success: true,
        agents: result.agents
      });
    } catch (error) {
      logger.error('Error getting trending agents:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trending agents'
      });
    }
  }
);

export default router;