import { Router, Request, Response } from 'express';
import { BillingService } from '../services/billing-service';
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
      filename: 'logs/billing-routes.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Store services (would be injected in real application)
let billingService: BillingService;
let authMiddleware: SSOAuthMiddleware;

/**
 * Initialize billing routes with services
 */
export function initializeBillingRoutes(
  billing: BillingService,
  middleware: SSOAuthMiddleware
) {
  billingService = billing;
  authMiddleware = middleware;
}

/**
 * @openapi
 * /billing/plans:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get available billing plans
 *     description: Retrieve all available billing plans with pricing and features
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BillingPlan'
 */
router.get('/plans',
  authMiddleware.authenticate({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plans = await billingService.getPlans();
      res.json({ plans });
    } catch (error) {
      logger.error('Failed to get billing plans:', error);
      res.status(500).json({
        error: 'Failed to get billing plans',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /billing/plans/{id}:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get billing plan details
 *     description: Get detailed information about a specific billing plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Plan details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BillingPlan'
 *       404:
 *         description: Plan not found
 */
router.get('/plans/:id',
  authMiddleware.authenticate({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plan = await billingService.getPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      res.json(plan);
    } catch (error) {
      logger.error('Failed to get billing plan:', error);
      res.status(500).json({
        error: 'Failed to get billing plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /billing/subscription:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get organization subscription
 *     description: Get the current subscription for the organization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscription:
 *                   $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: No active subscription found
 */
router.get('/subscription',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.BILLING_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const subscription = await billingService.getActiveSubscription(organizationId);
      
      if (!subscription) {
        return res.status(404).json({ error: 'No active subscription found' });
      }
      
      res.json({ subscription });
    } catch (error) {
      logger.error('Failed to get subscription:', error);
      res.status(500).json({
        error: 'Failed to get subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /billing/subscription:
 *   post:
 *     tags:
 *       - Billing
 *     summary: Create subscription
 *     description: Create a new subscription for the organization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 description: ID of the billing plan
 *               paymentMethodId:
 *                 type: string
 *                 description: ID of the payment method
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscription:
 *                   $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Invalid request or organization already has subscription
 *       404:
 *         description: Plan not found
 */
router.post('/subscription',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.BILLING_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { planId, paymentMethodId } = req.body;
      const organizationId = req.user!.organizationId;

      if (!planId) {
        return res.status(400).json({ error: 'Plan ID is required' });
      }

      const subscription = await billingService.createSubscription(
        organizationId,
        planId,
        paymentMethodId
      );

      logger.info('Subscription created', {
        organizationId,
        subscriptionId: subscription.id,
        planId,
        createdBy: req.user!.id
      });

      res.status(201).json({ subscription });
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already has an active subscription')) {
          return res.status(400).json({
            error: 'Subscription already exists',
            message: error.message
          });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Resource not found',
            message: error.message
          });
        }
      }

      res.status(500).json({
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /billing/subscription/cancel:
 *   post:
 *     tags:
 *       - Billing
 *     summary: Cancel subscription
 *     description: Cancel the organization's subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               immediately:
 *                 type: boolean
 *                 default: false
 *                 description: Cancel immediately or at period end
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscription:
 *                   $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: No active subscription found
 */
router.post('/subscription/cancel',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.BILLING_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { immediately = false, reason } = req.body;
      const organizationId = req.user!.organizationId;

      const activeSubscription = await billingService.getActiveSubscription(organizationId);
      if (!activeSubscription) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      const subscription = await billingService.cancelSubscription(
        activeSubscription.id,
        immediately
      );

      logger.info('Subscription cancelled', {
        organizationId,
        subscriptionId: subscription.id,
        immediately,
        reason,
        cancelledBy: req.user!.id
      });

      res.json({ subscription });
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      res.status(500).json({
        error: 'Failed to cancel subscription',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /billing/usage:
 *   post:
 *     tags:
 *       - Billing
 *     summary: Record usage
 *     description: Record usage metrics for billing (internal API)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metricName
 *               - quantity
 *             properties:
 *               metricName:
 *                 type: string
 *                 description: Name of the usage metric
 *                 example: "api_calls"
 *               quantity:
 *                 type: number
 *                 description: Usage quantity
 *                 example: 100
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       200:
 *         description: Usage recorded successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/usage',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.BILLING_ADMIN] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { metricName, quantity, metadata } = req.body;
      const organizationId = req.user!.organizationId;

      if (!metricName || typeof quantity !== 'number') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'metricName and quantity are required'
        });
      }

      await billingService.recordUsage(organizationId, metricName, quantity, metadata);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to record usage:', error);
      res.status(500).json({
        error: 'Failed to record usage',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /billing/invoices:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get organization invoices
 *     description: Get all invoices for the organization
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, open, paid, void, uncollectible]
 *         description: Filter by invoice status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of invoices to return
 *     responses:
 *       200:
 *         description: Invoices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invoices:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Invoice'
 */
router.get('/invoices',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.BILLING_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const { status, limit = '20' } = req.query;

      let whereClause = 'WHERE organization_id = $1';
      const params: any[] = [organizationId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      const result = await billingService['db'].executeQuery(
        `SELECT * FROM invoices ${whereClause} 
         ORDER BY created_at DESC LIMIT $${paramIndex}`,
        [...params, parseInt(limit as string)]
      );

      const invoices = result.rows.map(row => ({
        id: row.id,
        organizationId: row.organization_id,
        subscriptionId: row.subscription_id,
        invoiceNumber: row.invoice_number,
        status: row.status,
        amount: row.amount,
        currency: row.currency,
        tax: row.tax,
        total: row.total,
        periodStart: new Date(row.period_start),
        periodEnd: new Date(row.period_end),
        dueDate: new Date(row.due_date),
        paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
        lineItems: JSON.parse(row.line_items || '[]'),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));

      res.json({ invoices });
    } catch (error) {
      logger.error('Failed to get invoices:', error);
      res.status(500).json({
        error: 'Failed to get invoices',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @openapi
 * /billing/invoices/{id}:
 *   get:
 *     tags:
 *       - Billing
 *     summary: Get invoice details
 *     description: Get detailed information about a specific invoice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       404:
 *         description: Invoice not found
 */
router.get('/invoices/:id',
  authMiddleware.authenticate({ 
    required: true, 
    permissions: [PERMISSIONS.BILLING_READ] 
  }),
  authMiddleware.authenticateOrganization({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const invoiceId = req.params.id;

      const result = await billingService['db'].executeQuery(
        'SELECT * FROM invoices WHERE id = $1 AND organization_id = $2',
        [invoiceId, organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const row = result.rows[0];
      const invoice = {
        id: row.id,
        organizationId: row.organization_id,
        subscriptionId: row.subscription_id,
        invoiceNumber: row.invoice_number,
        status: row.status,
        amount: row.amount,
        currency: row.currency,
        tax: row.tax,
        total: row.total,
        periodStart: new Date(row.period_start),
        periodEnd: new Date(row.period_end),
        dueDate: new Date(row.due_date),
        paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
        lineItems: JSON.parse(row.line_items || '[]'),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };

      res.json(invoice);
    } catch (error) {
      logger.error('Failed to get invoice:', error);
      res.status(500).json({
        error: 'Failed to get invoice',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;