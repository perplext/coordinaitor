import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database-service';
import { OrganizationService, Organization } from './organization-service';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  billingCycleAnchor: Date;
  customerId?: string; // External billing provider customer ID
  subscriptionId?: string; // External billing provider subscription ID
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  price: {
    amount: number;
    currency: string;
    interval: 'month' | 'year';
    intervalCount: number;
  };
  features: {
    maxUsers: number;
    maxProjects: number;
    maxTasksPerMonth: number;
    maxStorageGB: number;
    maxAPICallsPerMonth: number;
    maxAgents: number;
    maxCollaborators: number;
    maxWebhooks: number;
    maxIntegrations: number;
    retentionDays: number;
    sso: boolean;
    analytics: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    webhooks: boolean;
    repositoryIntegration: boolean;
    securityScanning: boolean;
    prioritySupport: boolean;
  };
  trialDays: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string;
  invoiceNumber: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amount: number;
  currency: string;
  tax: number;
  total: number;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  paidAt?: Date;
  externalInvoiceId?: string; // External billing provider invoice ID
  paymentMethod?: string;
  lineItems: InvoiceLineItem[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'subscription' | 'usage' | 'addon' | 'discount';
  periodStart?: Date;
  periodEnd?: Date;
  metadata?: Record<string, any>;
}

export interface UsageRecord {
  id: string;
  organizationId: string;
  subscriptionId: string;
  metricName: string;
  quantity: number;
  timestamp: Date;
  period: string; // YYYY-MM format
  metadata?: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  organizationId: string;
  type: 'card' | 'bank_account' | 'paypal';
  isDefault: boolean;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  bankName?: string;
  accountType?: string;
  externalPaymentMethodId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface BillingWebhookEvent {
  id: string;
  type: string;
  data: any;
  providerId: string;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

export class BillingService extends EventEmitter {
  private db: DatabaseService;
  private organizationService: OrganizationService;
  private logger: winston.Logger;
  private config: {
    provider: 'stripe' | 'paddle' | 'chargebee' | 'internal';
    webhookSecret?: string;
    currency: string;
    taxRate: number;
  };

  constructor(config?: Partial<BillingService['config']>) {
    super();
    this.db = DatabaseService.getInstance();
    this.organizationService = new OrganizationService();
    this.config = {
      provider: 'internal',
      currency: 'USD',
      taxRate: 0.08, // 8% default tax rate
      ...config
    };

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
          filename: 'logs/billing-service.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });

    this.initializeDefaultPlans();
  }

  /**
   * Initialize default billing plans
   */
  private async initializeDefaultPlans(): Promise<void> {
    const defaultPlans: BillingPlan[] = [
      {
        id: 'free',
        name: 'Free',
        description: 'Perfect for individuals and small teams getting started',
        tier: 'free',
        price: {
          amount: 0,
          currency: 'USD',
          interval: 'month',
          intervalCount: 1
        },
        features: {
          maxUsers: 5,
          maxProjects: 2,
          maxTasksPerMonth: 100,
          maxStorageGB: 1,
          maxAPICallsPerMonth: 1000,
          maxAgents: 2,
          maxCollaborators: 3,
          maxWebhooks: 1,
          maxIntegrations: 2,
          retentionDays: 30,
          sso: false,
          analytics: true,
          apiAccess: true,
          customBranding: false,
          webhooks: false,
          repositoryIntegration: false,
          securityScanning: false,
          prioritySupport: false
        },
        trialDays: 0,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'starter',
        name: 'Starter',
        description: 'Great for growing teams that need more power',
        tier: 'starter',
        price: {
          amount: 29,
          currency: 'USD',
          interval: 'month',
          intervalCount: 1
        },
        features: {
          maxUsers: 15,
          maxProjects: 10,
          maxTasksPerMonth: 1000,
          maxStorageGB: 10,
          maxAPICallsPerMonth: 10000,
          maxAgents: 5,
          maxCollaborators: 10,
          maxWebhooks: 5,
          maxIntegrations: 5,
          retentionDays: 90,
          sso: false,
          analytics: true,
          apiAccess: true,
          customBranding: false,
          webhooks: true,
          repositoryIntegration: true,
          securityScanning: false,
          prioritySupport: false
        },
        trialDays: 14,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'Advanced features for professional teams',
        tier: 'professional',
        price: {
          amount: 99,
          currency: 'USD',
          interval: 'month',
          intervalCount: 1
        },
        features: {
          maxUsers: 50,
          maxProjects: 50,
          maxTasksPerMonth: 10000,
          maxStorageGB: 100,
          maxAPICallsPerMonth: 100000,
          maxAgents: 15,
          maxCollaborators: 25,
          maxWebhooks: 15,
          maxIntegrations: 10,
          retentionDays: 365,
          sso: true,
          analytics: true,
          apiAccess: true,
          customBranding: true,
          webhooks: true,
          repositoryIntegration: true,
          securityScanning: true,
          prioritySupport: false
        },
        trialDays: 14,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Everything you need for large organizations',
        tier: 'enterprise',
        price: {
          amount: 299,
          currency: 'USD',
          interval: 'month',
          intervalCount: 1
        },
        features: {
          maxUsers: -1, // unlimited
          maxProjects: -1,
          maxTasksPerMonth: -1,
          maxStorageGB: -1,
          maxAPICallsPerMonth: -1,
          maxAgents: -1,
          maxCollaborators: -1,
          maxWebhooks: -1,
          maxIntegrations: -1,
          retentionDays: -1,
          sso: true,
          analytics: true,
          apiAccess: true,
          customBranding: true,
          webhooks: true,
          repositoryIntegration: true,
          securityScanning: true,
          prioritySupport: true
        },
        trialDays: 30,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    try {
      for (const plan of defaultPlans) {
        await this.ensurePlanExists(plan);
      }
    } catch (error) {
      this.logger.error('Failed to initialize default plans:', error);
    }
  }

  /**
   * Ensure billing plan exists in database
   */
  private async ensurePlanExists(plan: BillingPlan): Promise<void> {
    try {
      const existing = await this.db.executeQuery(
        'SELECT id FROM billing_plans WHERE id = $1',
        [plan.id]
      );

      if (existing.rows.length === 0) {
        await this.db.executeQuery(
          `INSERT INTO billing_plans (
            id, name, description, tier, price, features, trial_days, 
            active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            plan.id, plan.name, plan.description, plan.tier,
            JSON.stringify(plan.price), JSON.stringify(plan.features),
            plan.trialDays, plan.active, plan.createdAt, plan.updatedAt
          ]
        );
      }
    } catch (error) {
      this.logger.error('Failed to ensure plan exists:', error);
    }
  }

  /**
   * Get all available billing plans
   */
  async getPlans(): Promise<BillingPlan[]> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM billing_plans WHERE active = true ORDER BY price->\'amount\' ASC'
      );

      return result.rows.map(row => this.mapRowToPlan(row));
    } catch (error) {
      this.logger.error('Failed to get plans:', error);
      throw error;
    }
  }

  /**
   * Get billing plan by ID
   */
  async getPlan(planId: string): Promise<BillingPlan | null> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM billing_plans WHERE id = $1',
        [planId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPlan(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get plan:', error);
      throw error;
    }
  }

  /**
   * Create subscription for organization
   */
  async createSubscription(organizationId: string, planId: string, paymentMethodId?: string): Promise<Subscription> {
    try {
      const plan = await this.getPlan(planId);
      if (!plan) {
        throw new Error('Billing plan not found');
      }

      const organization = await this.organizationService.getOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if organization already has an active subscription
      const existingSubscription = await this.getActiveSubscription(organizationId);
      if (existingSubscription) {
        throw new Error('Organization already has an active subscription');
      }

      const now = new Date();
      const trialEnd = plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : undefined;
      const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const subscription: Subscription = {
        id: uuidv4(),
        organizationId,
        planId,
        status: plan.trialDays > 0 ? 'trialing' : 'active',
        currentPeriodStart: now,
        currentPeriodEnd,
        trialEnd,
        cancelAtPeriodEnd: false,
        billingCycleAnchor: now,
        createdAt: now,
        updatedAt: now
      };

      // Save subscription to database
      await this.db.executeQuery(
        `INSERT INTO subscriptions (
          id, organization_id, plan_id, status, current_period_start,
          current_period_end, trial_end, cancel_at_period_end,
          billing_cycle_anchor, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          subscription.id, subscription.organizationId, subscription.planId,
          subscription.status, subscription.currentPeriodStart,
          subscription.currentPeriodEnd, subscription.trialEnd,
          subscription.cancelAtPeriodEnd, subscription.billingCycleAnchor,
          subscription.createdAt, subscription.updatedAt
        ]
      );

      // Update organization tier and limits based on plan
      await this.organizationService.updateOrganization(organizationId, {
        tier: plan.tier,
        limits: {
          maxUsers: plan.features.maxUsers,
          maxProjects: plan.features.maxProjects,
          maxTasksPerMonth: plan.features.maxTasksPerMonth,
          maxStorageGB: plan.features.maxStorageGB,
          maxAPICallsPerMonth: plan.features.maxAPICallsPerMonth,
          maxAgents: plan.features.maxAgents,
          maxCollaborators: plan.features.maxCollaborators,
          maxWebhooks: plan.features.maxWebhooks,
          maxIntegrations: plan.features.maxIntegrations,
          retentionDays: plan.features.retentionDays
        }
      });

      this.logger.info('Subscription created', {
        organizationId,
        subscriptionId: subscription.id,
        planId
      });

      this.emit('subscription:created', { subscription, organization, plan });

      return subscription;
    } catch (error) {
      this.logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  /**
   * Get active subscription for organization
   */
  async getActiveSubscription(organizationId: string): Promise<Subscription | null> {
    try {
      const result = await this.db.executeQuery(
        `SELECT * FROM subscriptions 
         WHERE organization_id = $1 AND status IN ('active', 'trialing') 
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSubscription(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get active subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Subscription> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const updates: Partial<Subscription> = {
        updatedAt: new Date()
      };

      if (immediately) {
        updates.status = 'cancelled';
        updates.currentPeriodEnd = new Date();
      } else {
        updates.cancelAtPeriodEnd = true;
      }

      await this.db.executeQuery(
        `UPDATE subscriptions SET 
          status = COALESCE($1, status),
          cancel_at_period_end = COALESCE($2, cancel_at_period_end),
          current_period_end = COALESCE($3, current_period_end),
          updated_at = $4
         WHERE id = $5`,
        [
          updates.status, updates.cancelAtPeriodEnd,
          updates.currentPeriodEnd, updates.updatedAt, subscriptionId
        ]
      );

      const updatedSubscription = { ...subscription, ...updates };

      this.logger.info('Subscription cancelled', {
        subscriptionId,
        immediately,
        organizationId: subscription.organizationId
      });

      this.emit('subscription:cancelled', { subscription: updatedSubscription });

      return updatedSubscription;
    } catch (error) {
      this.logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Record usage for billing
   */
  async recordUsage(organizationId: string, metricName: string, quantity: number, metadata?: Record<string, any>): Promise<void> {
    try {
      const subscription = await this.getActiveSubscription(organizationId);
      if (!subscription) {
        return; // No active subscription, skip usage recording
      }

      const now = new Date();
      const period = now.toISOString().substring(0, 7); // YYYY-MM

      const usageRecord: UsageRecord = {
        id: uuidv4(),
        organizationId,
        subscriptionId: subscription.id,
        metricName,
        quantity,
        timestamp: now,
        period,
        metadata
      };

      await this.db.executeQuery(
        `INSERT INTO usage_records (
          id, organization_id, subscription_id, metric_name,
          quantity, timestamp, period, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          usageRecord.id, usageRecord.organizationId, usageRecord.subscriptionId,
          usageRecord.metricName, usageRecord.quantity, usageRecord.timestamp,
          usageRecord.period, JSON.stringify(usageRecord.metadata || {})
        ]
      );

      this.emit('usage:recorded', { usageRecord, subscription });
    } catch (error) {
      this.logger.error('Failed to record usage:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Generate invoice for subscription period
   */
  async generateInvoice(subscriptionId: string, periodStart: Date, periodEnd: Date): Promise<Invoice> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const plan = await this.getPlan(subscription.planId);
      if (!plan) {
        throw new Error('Billing plan not found');
      }

      const lineItems: InvoiceLineItem[] = [];

      // Add subscription fee
      if (plan.price.amount > 0) {
        lineItems.push({
          id: uuidv4(),
          description: `${plan.name} - ${periodStart.toDateString()} to ${periodEnd.toDateString()}`,
          quantity: 1,
          unitPrice: plan.price.amount,
          amount: plan.price.amount,
          type: 'subscription',
          periodStart,
          periodEnd
        });
      }

      // Calculate usage-based charges
      const usageCharges = await this.calculateUsageCharges(subscription.organizationId, periodStart, periodEnd);
      lineItems.push(...usageCharges);

      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const tax = subtotal * this.config.taxRate;
      const total = subtotal + tax;

      const invoice: Invoice = {
        id: uuidv4(),
        organizationId: subscription.organizationId,
        subscriptionId,
        invoiceNumber: this.generateInvoiceNumber(),
        status: 'open',
        amount: subtotal,
        currency: plan.price.currency,
        tax,
        total,
        periodStart,
        periodEnd,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        lineItems,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save invoice to database
      await this.db.executeQuery(
        `INSERT INTO invoices (
          id, organization_id, subscription_id, invoice_number, status,
          amount, currency, tax, total, period_start, period_end,
          due_date, line_items, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          invoice.id, invoice.organizationId, invoice.subscriptionId,
          invoice.invoiceNumber, invoice.status, invoice.amount,
          invoice.currency, invoice.tax, invoice.total, invoice.periodStart,
          invoice.periodEnd, invoice.dueDate, JSON.stringify(invoice.lineItems),
          invoice.createdAt, invoice.updatedAt
        ]
      );

      this.logger.info('Invoice generated', {
        invoiceId: invoice.id,
        organizationId: subscription.organizationId,
        amount: invoice.total
      });

      this.emit('invoice:created', { invoice, subscription });

      return invoice;
    } catch (error) {
      this.logger.error('Failed to generate invoice:', error);
      throw error;
    }
  }

  /**
   * Calculate usage-based charges for period
   */
  private async calculateUsageCharges(organizationId: string, periodStart: Date, periodEnd: Date): Promise<InvoiceLineItem[]> {
    const charges: InvoiceLineItem[] = [];
    
    // Example usage-based pricing
    const usageRates = {
      'api_calls': { rate: 0.001, threshold: 10000 }, // $0.001 per call after 10k
      'storage': { rate: 0.50, threshold: 10 }, // $0.50 per GB after 10GB
      'agent_executions': { rate: 0.05, threshold: 1000 } // $0.05 per execution after 1k
    };

    for (const [metric, pricing] of Object.entries(usageRates)) {
      try {
        const result = await this.db.executeQuery(
          `SELECT SUM(quantity) as total_usage FROM usage_records 
           WHERE organization_id = $1 AND metric_name = $2 
           AND timestamp >= $3 AND timestamp < $4`,
          [organizationId, metric, periodStart, periodEnd]
        );

        const totalUsage = parseInt(result.rows[0]?.total_usage || '0');
        const billableUsage = Math.max(0, totalUsage - pricing.threshold);

        if (billableUsage > 0) {
          const amount = billableUsage * pricing.rate;
          charges.push({
            id: uuidv4(),
            description: `${metric.replace('_', ' ')} overage (${billableUsage} units)`,
            quantity: billableUsage,
            unitPrice: pricing.rate,
            amount,
            type: 'usage',
            periodStart,
            periodEnd,
            metadata: { metric, totalUsage, threshold: pricing.threshold }
          });
        }
      } catch (error) {
        this.logger.error(`Failed to calculate usage for ${metric}:`, error);
      }
    }

    return charges;
  }

  /**
   * Generate unique invoice number
   */
  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);
    return `INV-${year}${month}-${timestamp}`;
  }

  /**
   * Get subscription by ID
   */
  private async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM subscriptions WHERE id = $1',
        [subscriptionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSubscription(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get subscription:', error);
      throw error;
    }
  }

  /**
   * Map database row to billing plan
   */
  private mapRowToPlan(row: any): BillingPlan {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      tier: row.tier,
      price: JSON.parse(row.price),
      features: JSON.parse(row.features),
      trialDays: row.trial_days,
      active: row.active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to subscription
   */
  private mapRowToSubscription(row: any): Subscription {
    return {
      id: row.id,
      organizationId: row.organization_id,
      planId: row.plan_id,
      status: row.status,
      currentPeriodStart: new Date(row.current_period_start),
      currentPeriodEnd: new Date(row.current_period_end),
      trialEnd: row.trial_end ? new Date(row.trial_end) : undefined,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      billingCycleAnchor: new Date(row.billing_cycle_anchor),
      customerId: row.customer_id,
      subscriptionId: row.external_subscription_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export default BillingService;