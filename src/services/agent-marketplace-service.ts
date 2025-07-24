import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database-service';
import { AgentRegistry } from '../agents/agent-registry';
import { NotificationService } from './notification-service';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { AgentConfig } from '../interfaces/agent.interface';

export interface MarketplaceAgent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  version: string;
  author: {
    name: string;
    email: string;
    organization?: string;
    website?: string;
  };
  category: 'llm' | 'specialized' | 'integration' | 'workflow' | 'utility';
  tags: string[];
  capabilities: string[];
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'subscription';
    pricePerTask?: number;
    monthlyPrice?: number;
    yearlyPrice?: number;
    trialPeriod?: number; // days
  };
  compatibility: {
    minPlatformVersion: string;
    supportedLanguages: string[];
    requiredFeatures: string[];
  };
  configuration: {
    schema: any; // JSON schema for configuration
    defaults: any;
    secrets: string[]; // List of secret field names
  };
  installation: {
    type: 'native' | 'docker' | 'api' | 'webhook';
    packageUrl?: string;
    dockerImage?: string;
    apiEndpoint?: string;
    webhookUrl?: string;
    installScript?: string;
  };
  permissions: {
    requiredScopes: string[];
    dataAccess: 'none' | 'read' | 'write' | 'admin';
    networkAccess: boolean;
    fileSystemAccess: boolean;
  };
  metrics: {
    downloads: number;
    activeInstallations: number;
    averageRating: number;
    totalReviews: number;
    successRate?: number;
    averageResponseTime?: number;
  };
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'deprecated' | 'suspended';
  verification: {
    isVerified: boolean;
    verifiedBy?: string;
    verificationDate?: Date;
    securityScanPassed: boolean;
    lastSecurityScan?: Date;
  };
  documentation: {
    readme: string;
    changelog: string;
    apiReference?: string;
    examples: Array<{
      title: string;
      description: string;
      code: string;
      expectedOutput?: string;
    }>;
  };
  support: {
    website?: string;
    documentation?: string;
    issueTracker?: string;
    email?: string;
    communityForum?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface AgentInstallation {
  id: string;
  organizationId: string;
  agentId: string;
  marketplaceAgentId: string;
  version: string;
  status: 'installing' | 'installed' | 'failed' | 'updating' | 'uninstalling';
  configuration: any;
  secrets: { [key: string]: string };
  installationData: {
    installMethod: string;
    installedBy: string;
    installationLog: string[];
    errorLog?: string[];
  };
  health: {
    isHealthy: boolean;
    lastHealthCheck: Date;
    healthCheckUrl?: string;
    failureCount: number;
  };
  usage: {
    tasksExecuted: number;
    totalCost: number;
    averageResponseTime: number;
    errorRate: number;
  };
  billing: {
    subscriptionId?: string;
    paymentMethodId?: string;
    nextBillingDate?: Date;
    billingStatus: 'active' | 'suspended' | 'cancelled';
  };
  createdAt: Date;
  updatedAt: Date;
  installedAt?: Date;
  lastUsedAt?: Date;
}

export interface AgentReview {
  id: string;
  marketplaceAgentId: string;
  organizationId: string;
  userId: string;
  version: string;
  rating: number; // 1-5
  title: string;
  review: string;
  pros: string[];
  cons: string[];
  useCase: string;
  isVerifiedPurchase: boolean;
  helpful: number;
  reported: number;
  status: 'active' | 'hidden' | 'reported';
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentMarketplaceService extends EventEmitter {
  private db: DatabaseService;
  private agentRegistry: AgentRegistry;
  private notificationService: NotificationService | null;
  private logger: winston.Logger;

  constructor(agentRegistry: AgentRegistry, notificationService: NotificationService | null = null) {
    super();
    this.db = DatabaseService.getInstance();
    this.agentRegistry = agentRegistry;
    this.notificationService = notificationService;

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
          filename: 'logs/agent-marketplace.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Publish agent to marketplace
   */
  async publishAgent(agentData: Partial<MarketplaceAgent>, publisherId: string): Promise<MarketplaceAgent> {
    try {
      // Validate agent data
      this.validateAgentData(agentData);

      const agent: MarketplaceAgent = {
        id: agentData.id || uuidv4(),
        name: agentData.name!,
        displayName: agentData.displayName!,
        description: agentData.description!,
        longDescription: agentData.longDescription || agentData.description!,
        version: agentData.version || '1.0.0',
        author: agentData.author!,
        category: agentData.category!,
        tags: agentData.tags || [],
        capabilities: agentData.capabilities || [],
        pricing: agentData.pricing || { type: 'free' },
        compatibility: agentData.compatibility || {
          minPlatformVersion: '1.0.0',
          supportedLanguages: ['en'],
          requiredFeatures: []
        },
        configuration: agentData.configuration || { schema: {}, defaults: {}, secrets: [] },
        installation: agentData.installation!,
        permissions: agentData.permissions || {
          requiredScopes: [],
          dataAccess: 'none',
          networkAccess: false,
          fileSystemAccess: false
        },
        metrics: {
          downloads: 0,
          activeInstallations: 0,
          averageRating: 0,
          totalReviews: 0
        },
        status: 'pending_review',
        verification: {
          isVerified: false,
          securityScanPassed: false
        },
        documentation: agentData.documentation || {
          readme: '',
          changelog: '',
          examples: []
        },
        support: agentData.support || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.db.executeQuery(
        `INSERT INTO marketplace_agents (
          id, name, display_name, description, long_description, version, author,
          category, tags, capabilities, pricing, compatibility, configuration,
          installation, permissions, metrics, status, verification, documentation,
          support, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [
          agent.id, agent.name, agent.displayName, agent.description, agent.longDescription,
          agent.version, JSON.stringify(agent.author), agent.category, agent.tags,
          agent.capabilities, JSON.stringify(agent.pricing), JSON.stringify(agent.compatibility),
          JSON.stringify(agent.configuration), JSON.stringify(agent.installation),
          JSON.stringify(agent.permissions), JSON.stringify(agent.metrics), agent.status,
          JSON.stringify(agent.verification), JSON.stringify(agent.documentation),
          JSON.stringify(agent.support), agent.createdAt, agent.updatedAt
        ]
      );

      // Schedule security scan
      this.scheduleSecurityScan(agent.id);

      this.logger.info('Agent published to marketplace', {
        agentId: agent.id,
        name: agent.name,
        publisherId
      });

      this.emit('agent:published', { agent, publisherId });

      return agent;
    } catch (error) {
      this.logger.error('Failed to publish agent:', error);
      throw error;
    }
  }

  /**
   * Search marketplace agents
   */
  async searchAgents(criteria: {
    query?: string;
    category?: string;
    tags?: string[];
    pricing?: 'free' | 'paid' | 'all';
    verified?: boolean;
    minRating?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'rating' | 'downloads' | 'updated' | 'name';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ agents: MarketplaceAgent[]; total: number }> {
    try {
      const {
        query,
        category,
        tags,
        pricing = 'all',
        verified,
        minRating,
        limit = 20,
        offset = 0,
        sortBy = 'relevance',
        sortOrder = 'desc'
      } = criteria;

      let whereClause = 'WHERE status = $1';
      const params: any[] = ['approved'];
      let paramIndex = 2;

      // Text search
      if (query) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        params.push(`%${query}%`);
        paramIndex++;
      }

      // Category filter
      if (category) {
        whereClause += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Tags filter
      if (tags && tags.length > 0) {
        whereClause += ` AND tags && $${paramIndex}`;
        params.push(tags);
        paramIndex++;
      }

      // Pricing filter
      if (pricing !== 'all') {
        if (pricing === 'free') {
          whereClause += ` AND (pricing->>'type' = 'free')`;
        } else {
          whereClause += ` AND (pricing->>'type' != 'free')`;
        }
      }

      // Verified filter
      if (verified !== undefined) {
        whereClause += ` AND (verification->>'isVerified')::boolean = $${paramIndex}`;
        params.push(verified);
        paramIndex++;
      }

      // Rating filter
      if (minRating) {
        whereClause += ` AND (metrics->>'averageRating')::float >= $${paramIndex}`;
        params.push(minRating);
        paramIndex++;
      }

      // Sorting
      let orderClause = '';
      switch (sortBy) {
        case 'rating':
          orderClause = `ORDER BY (metrics->>'averageRating')::float ${sortOrder.toUpperCase()}`;
          break;
        case 'downloads':
          orderClause = `ORDER BY (metrics->>'downloads')::int ${sortOrder.toUpperCase()}`;
          break;
        case 'updated':
          orderClause = `ORDER BY updated_at ${sortOrder.toUpperCase()}`;
          break;
        case 'name':
          orderClause = `ORDER BY display_name ${sortOrder.toUpperCase()}`;
          break;
        default:
          // Relevance sorting (simplified)
          orderClause = 'ORDER BY (metrics->\'downloads\')::int DESC, (metrics->\'averageRating\')::float DESC';
      }

      // Get total count
      const countResult = await this.db.executeQuery(
        `SELECT COUNT(*) FROM marketplace_agents ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get agents
      const result = await this.db.executeQuery(
        `SELECT * FROM marketplace_agents ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const agents = result.rows.map(row => this.mapRowToMarketplaceAgent(row));

      return { agents, total };
    } catch (error) {
      this.logger.error('Failed to search agents:', error);
      throw error;
    }
  }

  /**
   * Install agent for organization
   */
  async installAgent(
    marketplaceAgentId: string,
    organizationId: string,
    installedBy: string,
    configuration: any = {},
    secrets: { [key: string]: string } = {}
  ): Promise<AgentInstallation> {
    try {
      // Get marketplace agent
      const marketplaceAgent = await this.getMarketplaceAgent(marketplaceAgentId);
      if (!marketplaceAgent) {
        throw new Error('Marketplace agent not found');
      }

      // Check if already installed
      const existingInstallation = await this.getAgentInstallation(organizationId, marketplaceAgentId);
      if (existingInstallation) {
        throw new Error('Agent already installed for this organization');
      }

      // Validate configuration
      this.validateAgentConfiguration(marketplaceAgent, configuration);

      // Create installation record
      const installation: AgentInstallation = {
        id: uuidv4(),
        organizationId,
        agentId: `${marketplaceAgent.name}-${organizationId}`,
        marketplaceAgentId,
        version: marketplaceAgent.version,
        status: 'installing',
        configuration,
        secrets: this.encryptSecrets(secrets),
        installationData: {
          installMethod: marketplaceAgent.installation.type,
          installedBy,
          installationLog: []
        },
        health: {
          isHealthy: false,
          lastHealthCheck: new Date(),
          failureCount: 0
        },
        usage: {
          tasksExecuted: 0,
          totalCost: 0,
          averageResponseTime: 0,
          errorRate: 0
        },
        billing: {
          billingStatus: 'active'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save installation
      await this.db.executeQuery(
        `INSERT INTO agent_installations (
          id, organization_id, agent_id, marketplace_agent_id, version, status,
          configuration, secrets, installation_data, health, usage, billing,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          installation.id, installation.organizationId, installation.agentId,
          installation.marketplaceAgentId, installation.version, installation.status,
          JSON.stringify(installation.configuration), JSON.stringify(installation.secrets),
          JSON.stringify(installation.installationData), JSON.stringify(installation.health),
          JSON.stringify(installation.usage), JSON.stringify(installation.billing),
          installation.createdAt, installation.updatedAt
        ]
      );

      // Perform actual installation
      await this.performAgentInstallation(installation, marketplaceAgent);

      // Update metrics
      await this.updateAgentMetrics(marketplaceAgentId, { downloads: 1, activeInstallations: 1 });

      this.logger.info('Agent installation initiated', {
        marketplaceAgentId,
        organizationId,
        installedBy
      });

      this.emit('agent:installation_started', { installation, marketplaceAgent });

      return installation;
    } catch (error) {
      this.logger.error('Failed to install agent:', error);
      throw error;
    }
  }

  /**
   * Uninstall agent
   */
  async uninstallAgent(installationId: string, uninstalledBy: string, reason?: string): Promise<void> {
    try {
      const installation = await this.getInstallationById(installationId);
      if (!installation) {
        throw new Error('Installation not found');
      }

      // Update status
      installation.status = 'uninstalling';
      await this.updateInstallationStatus(installationId, 'uninstalling');

      // Perform actual uninstallation
      await this.performAgentUninstallation(installation);

      // Remove from agent registry
      if (this.agentRegistry.getAgent(installation.agentId)) {
        await this.agentRegistry.unregisterAgent(installation.agentId);
      }

      // Delete installation record
      await this.db.executeQuery(
        'DELETE FROM agent_installations WHERE id = $1',
        [installationId]
      );

      // Update marketplace metrics
      await this.updateAgentMetrics(installation.marketplaceAgentId, { activeInstallations: -1 });

      this.logger.info('Agent uninstalled', {
        installationId,
        agentId: installation.agentId,
        uninstalledBy,
        reason
      });

      this.emit('agent:uninstalled', { installation, uninstalledBy, reason });
    } catch (error) {
      this.logger.error('Failed to uninstall agent:', error);
      throw error;
    }
  }

  /**
   * Review agent
   */
  async reviewAgent(reviewData: {
    marketplaceAgentId: string;
    organizationId: string;
    userId: string;
    version: string;
    rating: number;
    title: string;
    review: string;
    pros?: string[];
    cons?: string[];
    useCase?: string;
  }): Promise<AgentReview> {
    try {
      // Check if user has installed this agent
      const installation = await this.getAgentInstallation(reviewData.organizationId, reviewData.marketplaceAgentId);
      const isVerifiedPurchase = !!installation;

      // Check if user already reviewed this agent
      const existingReview = await this.getUserReview(
        reviewData.marketplaceAgentId,
        reviewData.organizationId,
        reviewData.userId
      );
      
      if (existingReview) {
        throw new Error('User has already reviewed this agent');
      }

      const review: AgentReview = {
        id: uuidv4(),
        marketplaceAgentId: reviewData.marketplaceAgentId,
        organizationId: reviewData.organizationId,
        userId: reviewData.userId,
        version: reviewData.version,
        rating: Math.max(1, Math.min(5, Math.round(reviewData.rating))),
        title: reviewData.title,
        review: reviewData.review,
        pros: reviewData.pros || [],
        cons: reviewData.cons || [],
        useCase: reviewData.useCase || '',
        isVerifiedPurchase,
        helpful: 0,
        reported: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save review
      await this.db.executeQuery(
        `INSERT INTO agent_reviews (
          id, marketplace_agent_id, organization_id, user_id, version, rating,
          title, review, pros, cons, use_case, is_verified_purchase, helpful,
          reported, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          review.id, review.marketplaceAgentId, review.organizationId, review.userId,
          review.version, review.rating, review.title, review.review,
          JSON.stringify(review.pros), JSON.stringify(review.cons), review.useCase,
          review.isVerifiedPurchase, review.helpful, review.reported, review.status,
          review.createdAt, review.updatedAt
        ]
      );

      // Update agent rating
      await this.updateAgentRating(reviewData.marketplaceAgentId);

      this.logger.info('Agent review submitted', {
        reviewId: review.id,
        marketplaceAgentId: reviewData.marketplaceAgentId,
        rating: review.rating
      });

      this.emit('agent:reviewed', { review });

      return review;
    } catch (error) {
      this.logger.error('Failed to submit review:', error);
      throw error;
    }
  }

  /**
   * Get agent details with reviews
   */
  async getAgentDetails(agentId: string): Promise<{
    agent: MarketplaceAgent;
    reviews: AgentReview[];
    installations: number;
  }> {
    try {
      const agent = await this.getMarketplaceAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const reviews = await this.getAgentReviews(agentId);
      const installations = await this.getAgentInstallationCount(agentId);

      return { agent, reviews, installations };
    } catch (error) {
      this.logger.error('Failed to get agent details:', error);
      throw error;
    }
  }

  /**
   * Get organization's installed agents
   */
  async getInstalledAgents(organizationId: string): Promise<{
    installations: AgentInstallation[];
    agents: MarketplaceAgent[];
  }> {
    try {
      const result = await this.db.executeQuery(
        `SELECT ai.*, ma.* FROM agent_installations ai
         JOIN marketplace_agents ma ON ai.marketplace_agent_id = ma.id
         WHERE ai.organization_id = $1 AND ai.status = 'installed'
         ORDER BY ai.installed_at DESC`,
        [organizationId]
      );

      const installations: AgentInstallation[] = [];
      const agents: MarketplaceAgent[] = [];

      result.rows.forEach(row => {
        installations.push(this.mapRowToInstallation(row));
        agents.push(this.mapRowToMarketplaceAgent(row));
      });

      return { installations, agents };
    } catch (error) {
      this.logger.error('Failed to get installed agents:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private validateAgentData(agentData: Partial<MarketplaceAgent>): void {
    if (!agentData.name || !agentData.displayName || !agentData.description) {
      throw new Error('Name, display name, and description are required');
    }

    if (!agentData.author || !agentData.author.name || !agentData.author.email) {
      throw new Error('Author name and email are required');
    }

    if (!agentData.category) {
      throw new Error('Category is required');
    }

    if (!agentData.installation || !agentData.installation.type) {
      throw new Error('Installation configuration is required');
    }
  }

  private validateAgentConfiguration(agent: MarketplaceAgent, configuration: any): void {
    // TODO: Implement JSON schema validation
    // This would validate the configuration against the agent's schema
  }

  private async performAgentInstallation(installation: AgentInstallation, marketplaceAgent: MarketplaceAgent): Promise<void> {
    try {
      const installationLog: string[] = [];

      switch (marketplaceAgent.installation.type) {
        case 'native':
          installationLog.push('Installing native agent...');
          await this.installNativeAgent(installation, marketplaceAgent);
          break;
        case 'docker':
          installationLog.push('Installing Docker agent...');
          await this.installDockerAgent(installation, marketplaceAgent);
          break;
        case 'api':
          installationLog.push('Configuring API agent...');
          await this.installApiAgent(installation, marketplaceAgent);
          break;
        case 'webhook':
          installationLog.push('Setting up webhook agent...');
          await this.installWebhookAgent(installation, marketplaceAgent);
          break;
        default:
          throw new Error(`Unsupported installation type: ${marketplaceAgent.installation.type}`);
      }

      // Update installation status
      installation.status = 'installed';
      installation.installedAt = new Date();
      installation.installationData.installationLog = installationLog;

      await this.updateInstallation(installation);

      this.emit('agent:installed', { installation, marketplaceAgent });
    } catch (error) {
      installation.status = 'failed';
      installation.installationData.errorLog = [error.message];
      await this.updateInstallation(installation);
      throw error;
    }
  }

  private async installNativeAgent(installation: AgentInstallation, marketplaceAgent: MarketplaceAgent): Promise<void> {
    // TODO: Implement native agent installation
    // This would download and install the agent package
  }

  private async installDockerAgent(installation: AgentInstallation, marketplaceAgent: MarketplaceAgent): Promise<void> {
    // TODO: Implement Docker agent installation
    // This would pull and run the Docker container
  }

  private async installApiAgent(installation: AgentInstallation, marketplaceAgent: MarketplaceAgent): Promise<void> {
    // Create AgentConfig for API-based agent
    const agentConfig: AgentConfig = {
      id: installation.agentId,
      name: marketplaceAgent.displayName,
      type: marketplaceAgent.category,
      provider: marketplaceAgent.author.name,
      version: marketplaceAgent.version,
      capabilities: marketplaceAgent.capabilities,
      endpoint: marketplaceAgent.installation.apiEndpoint!,
      maxConcurrentTasks: 5,
      cost: {
        inputTokenCost: marketplaceAgent.pricing.pricePerTask || 0,
        outputTokenCost: marketplaceAgent.pricing.pricePerTask || 0
      },
      ...installation.configuration
    };

    // Register with agent registry
    // TODO: Create actual agent implementation based on configuration
    // For now, we'll just register the configuration
    this.agentRegistry.registerAgentConfig(agentConfig);
  }

  private async installWebhookAgent(installation: AgentInstallation, marketplaceAgent: MarketplaceAgent): Promise<void> {
    // TODO: Implement webhook agent installation
    // This would set up webhook endpoints and routing
  }

  private async performAgentUninstallation(installation: AgentInstallation): Promise<void> {
    // TODO: Implement agent uninstallation based on installation type
    // This would clean up containers, stop services, etc.
  }

  private encryptSecrets(secrets: { [key: string]: string }): { [key: string]: string } {
    const encrypted: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(secrets)) {
      // TODO: Implement proper encryption
      encrypted[key] = Buffer.from(value).toString('base64');
    }
    return encrypted;
  }

  private decryptSecrets(secrets: { [key: string]: string }): { [key: string]: string } {
    const decrypted: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(secrets)) {
      // TODO: Implement proper decryption
      decrypted[key] = Buffer.from(value, 'base64').toString();
    }
    return decrypted;
  }

  private async scheduleSecurityScan(agentId: string): Promise<void> {
    // TODO: Implement security scanning
    // This would scan the agent for vulnerabilities, malicious code, etc.
    this.logger.info('Security scan scheduled for agent', { agentId });
  }

  private async updateAgentMetrics(agentId: string, updates: Partial<MarketplaceAgent['metrics']>): Promise<void> {
    const setClause = [];
    const params = [agentId];
    let paramIndex = 2;

    if (updates.downloads !== undefined) {
      setClause.push(`metrics = jsonb_set(metrics, '{downloads}', (COALESCE((metrics->>'downloads')::int, 0) + $${paramIndex})::text::jsonb)`);
      params.push(updates.downloads);
      paramIndex++;
    }

    if (updates.activeInstallations !== undefined) {
      setClause.push(`metrics = jsonb_set(metrics, '{activeInstallations}', (COALESCE((metrics->>'activeInstallations')::int, 0) + $${paramIndex})::text::jsonb)`);
      params.push(updates.activeInstallations);
      paramIndex++;
    }

    if (setClause.length > 0) {
      await this.db.executeQuery(
        `UPDATE marketplace_agents SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        params
      );
    }
  }

  private async updateAgentRating(agentId: string): Promise<void> {
    const result = await this.db.executeQuery(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM agent_reviews WHERE marketplace_agent_id = $1 AND status = 'active'`,
      [agentId]
    );

    const { avg_rating, total_reviews } = result.rows[0];

    await this.db.executeQuery(
      `UPDATE marketplace_agents SET 
        metrics = jsonb_set(jsonb_set(metrics, '{averageRating}', $2::text::jsonb), '{totalReviews}', $3::text::jsonb),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [agentId, parseFloat(avg_rating) || 0, parseInt(total_reviews) || 0]
    );
  }

  // Database helper methods
  private async getMarketplaceAgent(agentId: string): Promise<MarketplaceAgent | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM marketplace_agents WHERE id = $1',
      [agentId]
    );
    return result.rows.length > 0 ? this.mapRowToMarketplaceAgent(result.rows[0]) : null;
  }

  private async getAgentInstallation(organizationId: string, marketplaceAgentId: string): Promise<AgentInstallation | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM agent_installations WHERE organization_id = $1 AND marketplace_agent_id = $2',
      [organizationId, marketplaceAgentId]
    );
    return result.rows.length > 0 ? this.mapRowToInstallation(result.rows[0]) : null;
  }

  private async getInstallationById(installationId: string): Promise<AgentInstallation | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM agent_installations WHERE id = $1',
      [installationId]
    );
    return result.rows.length > 0 ? this.mapRowToInstallation(result.rows[0]) : null;
  }

  private async getUserReview(agentId: string, organizationId: string, userId: string): Promise<AgentReview | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM agent_reviews WHERE marketplace_agent_id = $1 AND organization_id = $2 AND user_id = $3',
      [agentId, organizationId, userId]
    );
    return result.rows.length > 0 ? this.mapRowToReview(result.rows[0]) : null;
  }

  private async getAgentReviews(agentId: string, limit: number = 20): Promise<AgentReview[]> {
    const result = await this.db.executeQuery(
      'SELECT * FROM agent_reviews WHERE marketplace_agent_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3',
      [agentId, 'active', limit]
    );
    return result.rows.map(row => this.mapRowToReview(row));
  }

  private async getAgentInstallationCount(agentId: string): Promise<number> {
    const result = await this.db.executeQuery(
      'SELECT COUNT(*) FROM agent_installations WHERE marketplace_agent_id = $1 AND status = $2',
      [agentId, 'installed']
    );
    return parseInt(result.rows[0].count);
  }

  private async updateInstallationStatus(installationId: string, status: AgentInstallation['status']): Promise<void> {
    await this.db.executeQuery(
      'UPDATE agent_installations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, installationId]
    );
  }

  private async updateInstallation(installation: AgentInstallation): Promise<void> {
    await this.db.executeQuery(
      `UPDATE agent_installations SET 
        status = $1, configuration = $2, secrets = $3, installation_data = $4,
        health = $5, usage = $6, billing = $7, installed_at = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        installation.status, JSON.stringify(installation.configuration),
        JSON.stringify(installation.secrets), JSON.stringify(installation.installationData),
        JSON.stringify(installation.health), JSON.stringify(installation.usage),
        JSON.stringify(installation.billing), installation.installedAt, installation.id
      ]
    );
  }

  // Row mapping methods
  private mapRowToMarketplaceAgent(row: any): MarketplaceAgent {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      longDescription: row.long_description,
      version: row.version,
      author: JSON.parse(row.author),
      category: row.category,
      tags: row.tags,
      capabilities: row.capabilities,
      pricing: JSON.parse(row.pricing),
      compatibility: JSON.parse(row.compatibility),
      configuration: JSON.parse(row.configuration),
      installation: JSON.parse(row.installation),
      permissions: JSON.parse(row.permissions),
      metrics: JSON.parse(row.metrics),
      status: row.status,
      verification: JSON.parse(row.verification),
      documentation: JSON.parse(row.documentation),
      support: JSON.parse(row.support),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined
    };
  }

  private mapRowToInstallation(row: any): AgentInstallation {
    return {
      id: row.id,
      organizationId: row.organization_id,
      agentId: row.agent_id,
      marketplaceAgentId: row.marketplace_agent_id,
      version: row.version,
      status: row.status,
      configuration: JSON.parse(row.configuration),
      secrets: JSON.parse(row.secrets),
      installationData: JSON.parse(row.installation_data),
      health: JSON.parse(row.health),
      usage: JSON.parse(row.usage),
      billing: JSON.parse(row.billing),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      installedAt: row.installed_at ? new Date(row.installed_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined
    };
  }

  private mapRowToReview(row: any): AgentReview {
    return {
      id: row.id,
      marketplaceAgentId: row.marketplace_agent_id,
      organizationId: row.organization_id,
      userId: row.user_id,
      version: row.version,
      rating: row.rating,
      title: row.title,
      review: row.review,
      pros: JSON.parse(row.pros),
      cons: JSON.parse(row.cons),
      useCase: row.use_case,
      isVerifiedPurchase: row.is_verified_purchase,
      helpful: row.helpful,
      reported: row.reported,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export default AgentMarketplaceService;