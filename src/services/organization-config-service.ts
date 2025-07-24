import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database-service';
import { OrganizationService, Organization } from './organization-service';
import { AgentRegistry } from '../agents/agent-registry';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface OrganizationAgentConfig {
  id: string;
  organizationId: string;
  agentId: string;
  enabled: boolean;
  priority: number;
  maxConcurrentTasks: number;
  config: {
    apiKey?: string;
    endpoint?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    rateLimits?: {
      requestsPerMinute: number;
      requestsPerHour: number;
      requestsPerDay: number;
    };
    costLimits?: {
      maxCostPerTask: number;
      maxCostPerDay: number;
      maxCostPerMonth: number;
    };
    features?: {
      codeGeneration: boolean;
      dataAnalysis: boolean;
      imageGeneration: boolean;
      fileProcessing: boolean;
      webSearch: boolean;
      collaboration: boolean;
    };
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationFeatureConfig {
  id: string;
  organizationId: string;
  featureName: string;
  enabled: boolean;
  config: Record<string, any>;
  limits?: {
    maxUsage?: number;
    maxUsers?: number;
    rateLimits?: Record<string, number>;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationWorkflowConfig {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerEvents: string[];
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  schedule?: {
    type: 'cron' | 'interval' | 'event';
    value: string;
    timezone?: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowAction {
  id: string;
  type: 'agent_task' | 'notification' | 'webhook' | 'approval' | 'integration';
  config: Record<string, any>;
  order: number;
  enabled: boolean;
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface OrganizationIntegrationConfig {
  id: string;
  organizationId: string;
  integrationType: string;
  name: string;
  enabled: boolean;
  credentials: Record<string, any>; // Encrypted
  config: Record<string, any>;
  webhookUrl?: string;
  webhookSecret?: string;
  lastSyncAt?: Date;
  syncStatus?: 'success' | 'error' | 'pending';
  syncError?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class OrganizationConfigService extends EventEmitter {
  private db: DatabaseService;
  private organizationService: OrganizationService;
  private agentRegistry: AgentRegistry;
  private logger: winston.Logger;

  constructor(agentRegistry: AgentRegistry) {
    super();
    this.db = DatabaseService.getInstance();
    this.organizationService = new OrganizationService();
    this.agentRegistry = agentRegistry;

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
          filename: 'logs/organization-config-service.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Get organization agent configurations
   */
  async getOrganizationAgentConfigs(organizationId: string): Promise<OrganizationAgentConfig[]> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM organization_agent_configs WHERE organization_id = $1 ORDER BY priority ASC',
        [organizationId]
      );

      return result.rows.map(row => this.mapRowToAgentConfig(row));
    } catch (error) {
      this.logger.error('Failed to get organization agent configs:', error);
      throw error;
    }
  }

  /**
   * Create or update organization agent configuration
   */
  async configureOrganizationAgent(organizationId: string, agentId: string, config: Partial<OrganizationAgentConfig>): Promise<OrganizationAgentConfig> {
    try {
      // Validate organization exists
      const organization = await this.organizationService.getOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Validate agent exists
      const agent = this.agentRegistry.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Check if configuration already exists
      const existing = await this.db.executeQuery(
        'SELECT id FROM organization_agent_configs WHERE organization_id = $1 AND agent_id = $2',
        [organizationId, agentId]
      );

      const now = new Date();
      let agentConfig: OrganizationAgentConfig;

      if (existing.rows.length > 0) {
        // Update existing configuration
        const id = existing.rows[0].id;
        agentConfig = {
          id,
          organizationId,
          agentId,
          enabled: config.enabled ?? true,
          priority: config.priority ?? 50,
          maxConcurrentTasks: config.maxConcurrentTasks ?? agent.config.maxConcurrentTasks,
          config: config.config ?? {},
          metadata: config.metadata ?? {},
          createdAt: now, // Will be overwritten by existing value
          updatedAt: now
        };

        await this.db.executeQuery(
          `UPDATE organization_agent_configs SET 
            enabled = $1, priority = $2, max_concurrent_tasks = $3, 
            config = $4, metadata = $5, updated_at = $6
           WHERE id = $7`,
          [
            agentConfig.enabled, agentConfig.priority, agentConfig.maxConcurrentTasks,
            JSON.stringify(agentConfig.config), JSON.stringify(agentConfig.metadata),
            agentConfig.updatedAt, id
          ]
        );
      } else {
        // Create new configuration
        agentConfig = {
          id: uuidv4(),
          organizationId,
          agentId,
          enabled: config.enabled ?? true,
          priority: config.priority ?? 50,
          maxConcurrentTasks: config.maxConcurrentTasks ?? agent.config.maxConcurrentTasks,
          config: config.config ?? {},
          metadata: config.metadata ?? {},
          createdAt: now,
          updatedAt: now
        };

        await this.db.executeQuery(
          `INSERT INTO organization_agent_configs (
            id, organization_id, agent_id, enabled, priority, 
            max_concurrent_tasks, config, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            agentConfig.id, agentConfig.organizationId, agentConfig.agentId,
            agentConfig.enabled, agentConfig.priority, agentConfig.maxConcurrentTasks,
            JSON.stringify(agentConfig.config), JSON.stringify(agentConfig.metadata),
            agentConfig.createdAt, agentConfig.updatedAt
          ]
        );
      }

      this.logger.info('Organization agent configured', {
        organizationId,
        agentId,
        enabled: agentConfig.enabled
      });

      this.emit('agent:configured', { organizationId, agentId, config: agentConfig });

      return agentConfig;
    } catch (error) {
      this.logger.error('Failed to configure organization agent:', error);
      throw error;
    }
  }

  /**
   * Get organization feature configurations
   */
  async getOrganizationFeatureConfigs(organizationId: string): Promise<OrganizationFeatureConfig[]> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM organization_feature_configs WHERE organization_id = $1 ORDER BY feature_name',
        [organizationId]
      );

      return result.rows.map(row => this.mapRowToFeatureConfig(row));
    } catch (error) {
      this.logger.error('Failed to get organization feature configs:', error);
      throw error;
    }
  }

  /**
   * Configure organization feature
   */
  async configureOrganizationFeature(organizationId: string, featureName: string, config: Partial<OrganizationFeatureConfig>): Promise<OrganizationFeatureConfig> {
    try {
      // Validate organization exists
      const organization = await this.organizationService.getOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if feature is allowed for organization tier
      const isFeatureAllowed = this.isFeatureAllowedForTier(featureName, organization.tier);
      if (!isFeatureAllowed) {
        throw new Error(`Feature '${featureName}' is not available for ${organization.tier} tier`);
      }

      // Check if configuration already exists
      const existing = await this.db.executeQuery(
        'SELECT id FROM organization_feature_configs WHERE organization_id = $1 AND feature_name = $2',
        [organizationId, featureName]
      );

      const now = new Date();
      let featureConfig: OrganizationFeatureConfig;

      if (existing.rows.length > 0) {
        // Update existing configuration
        const id = existing.rows[0].id;
        featureConfig = {
          id,
          organizationId,
          featureName,
          enabled: config.enabled ?? true,
          config: config.config ?? {},
          limits: config.limits,
          metadata: config.metadata ?? {},
          createdAt: now, // Will be overwritten by existing value
          updatedAt: now
        };

        await this.db.executeQuery(
          `UPDATE organization_feature_configs SET 
            enabled = $1, config = $2, limits = $3, metadata = $4, updated_at = $5
           WHERE id = $6`,
          [
            featureConfig.enabled, JSON.stringify(featureConfig.config),
            JSON.stringify(featureConfig.limits || {}), JSON.stringify(featureConfig.metadata),
            featureConfig.updatedAt, id
          ]
        );
      } else {
        // Create new configuration
        featureConfig = {
          id: uuidv4(),
          organizationId,
          featureName,
          enabled: config.enabled ?? true,
          config: config.config ?? {},
          limits: config.limits,
          metadata: config.metadata ?? {},
          createdAt: now,
          updatedAt: now
        };

        await this.db.executeQuery(
          `INSERT INTO organization_feature_configs (
            id, organization_id, feature_name, enabled, config, limits, metadata, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            featureConfig.id, featureConfig.organizationId, featureConfig.featureName,
            featureConfig.enabled, JSON.stringify(featureConfig.config),
            JSON.stringify(featureConfig.limits || {}), JSON.stringify(featureConfig.metadata),
            featureConfig.createdAt, featureConfig.updatedAt
          ]
        );
      }

      this.logger.info('Organization feature configured', {
        organizationId,
        featureName,
        enabled: featureConfig.enabled
      });

      this.emit('feature:configured', { organizationId, featureName, config: featureConfig });

      return featureConfig;
    } catch (error) {
      this.logger.error('Failed to configure organization feature:', error);
      throw error;
    }
  }

  /**
   * Get organization workflows
   */
  async getOrganizationWorkflows(organizationId: string): Promise<OrganizationWorkflowConfig[]> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM organization_workflows WHERE organization_id = $1 ORDER BY name',
        [organizationId]
      );

      return result.rows.map(row => this.mapRowToWorkflowConfig(row));
    } catch (error) {
      this.logger.error('Failed to get organization workflows:', error);
      throw error;
    }
  }

  /**
   * Create organization workflow
   */
  async createOrganizationWorkflow(organizationId: string, workflow: Partial<OrganizationWorkflowConfig>): Promise<OrganizationWorkflowConfig> {
    try {
      // Validate organization exists
      const organization = await this.organizationService.getOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if workflow automation is allowed for organization tier
      if (!organization.settings.features.workflowAutomation) {
        throw new Error('Workflow automation is not available for your organization tier');
      }

      const now = new Date();
      const workflowConfig: OrganizationWorkflowConfig = {
        id: uuidv4(),
        organizationId,
        name: workflow.name || 'Untitled Workflow',
        description: workflow.description,
        enabled: workflow.enabled ?? true,
        triggerEvents: workflow.triggerEvents || [],
        actions: workflow.actions || [],
        conditions: workflow.conditions,
        schedule: workflow.schedule,
        metadata: workflow.metadata ?? {},
        createdAt: now,
        updatedAt: now
      };

      await this.db.executeQuery(
        `INSERT INTO organization_workflows (
          id, organization_id, name, description, enabled, trigger_events,
          actions, conditions, schedule, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          workflowConfig.id, workflowConfig.organizationId, workflowConfig.name,
          workflowConfig.description, workflowConfig.enabled, JSON.stringify(workflowConfig.triggerEvents),
          JSON.stringify(workflowConfig.actions), JSON.stringify(workflowConfig.conditions || []),
          JSON.stringify(workflowConfig.schedule || {}), JSON.stringify(workflowConfig.metadata),
          workflowConfig.createdAt, workflowConfig.updatedAt
        ]
      );

      this.logger.info('Organization workflow created', {
        organizationId,
        workflowId: workflowConfig.id,
        name: workflowConfig.name
      });

      this.emit('workflow:created', { organizationId, workflow: workflowConfig });

      return workflowConfig;
    } catch (error) {
      this.logger.error('Failed to create organization workflow:', error);
      throw error;
    }
  }

  /**
   * Get organization integrations
   */
  async getOrganizationIntegrations(organizationId: string): Promise<OrganizationIntegrationConfig[]> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM organization_integrations WHERE organization_id = $1 ORDER BY name',
        [organizationId]
      );

      return result.rows.map(row => this.mapRowToIntegrationConfig(row));
    } catch (error) {
      this.logger.error('Failed to get organization integrations:', error);
      throw error;
    }
  }

  /**
   * Create organization integration
   */
  async createOrganizationIntegration(organizationId: string, integration: Partial<OrganizationIntegrationConfig>): Promise<OrganizationIntegrationConfig> {
    try {
      // Validate organization exists
      const organization = await this.organizationService.getOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if integration type is allowed
      const isIntegrationAllowed = this.isIntegrationAllowedForTier(integration.integrationType!, organization.tier);
      if (!isIntegrationAllowed) {
        throw new Error(`Integration '${integration.integrationType}' is not available for ${organization.tier} tier`);
      }

      const now = new Date();
      const integrationConfig: OrganizationIntegrationConfig = {
        id: uuidv4(),
        organizationId,
        integrationType: integration.integrationType!,
        name: integration.name!,
        enabled: integration.enabled ?? true,
        credentials: integration.credentials || {},
        config: integration.config || {},
        webhookUrl: integration.webhookUrl,
        webhookSecret: integration.webhookSecret,
        lastSyncAt: integration.lastSyncAt,
        syncStatus: integration.syncStatus,
        syncError: integration.syncError,
        metadata: integration.metadata ?? {},
        createdAt: now,
        updatedAt: now
      };

      await this.db.executeQuery(
        `INSERT INTO organization_integrations (
          id, organization_id, integration_type, name, enabled, credentials,
          config, webhook_url, webhook_secret, last_sync_at, sync_status,
          sync_error, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          integrationConfig.id, integrationConfig.organizationId, integrationConfig.integrationType,
          integrationConfig.name, integrationConfig.enabled, JSON.stringify(integrationConfig.credentials),
          JSON.stringify(integrationConfig.config), integrationConfig.webhookUrl,
          integrationConfig.webhookSecret, integrationConfig.lastSyncAt, integrationConfig.syncStatus,
          integrationConfig.syncError, JSON.stringify(integrationConfig.metadata),
          integrationConfig.createdAt, integrationConfig.updatedAt
        ]
      );

      this.logger.info('Organization integration created', {
        organizationId,
        integrationId: integrationConfig.id,
        type: integrationConfig.integrationType
      });

      this.emit('integration:created', { organizationId, integration: integrationConfig });

      return integrationConfig;
    } catch (error) {
      this.logger.error('Failed to create organization integration:', error);
      throw error;
    }
  }

  /**
   * Check if feature is allowed for organization tier
   */
  private isFeatureAllowedForTier(featureName: string, tier: string): boolean {
    const tierFeatures = {
      free: ['analytics', 'apiAccess', 'collaboration'],
      starter: ['analytics', 'apiAccess', 'collaboration', 'webhooks', 'repositoryIntegration'],
      professional: ['analytics', 'apiAccess', 'collaboration', 'webhooks', 'repositoryIntegration', 'sso', 'customBranding', 'workflowAutomation', 'securityScanning'],
      enterprise: ['analytics', 'apiAccess', 'collaboration', 'webhooks', 'repositoryIntegration', 'sso', 'customBranding', 'workflowAutomation', 'securityScanning', 'prioritySupport', 'advancedAnalytics']
    };

    return tierFeatures[tier as keyof typeof tierFeatures]?.includes(featureName) ?? false;
  }

  /**
   * Check if integration is allowed for organization tier
   */
  private isIntegrationAllowedForTier(integrationType: string, tier: string): boolean {
    const tierIntegrations = {
      free: ['github', 'gitlab'],
      starter: ['github', 'gitlab', 'slack', 'teams'],
      professional: ['github', 'gitlab', 'slack', 'teams', 'jira', 'customWebhooks'],
      enterprise: ['github', 'gitlab', 'slack', 'teams', 'jira', 'customWebhooks', 'salesforce', 'azure-devops', 'jenkins']
    };

    return tierIntegrations[tier as keyof typeof tierIntegrations]?.includes(integrationType) ?? false;
  }

  /**
   * Get available agents for organization based on tier
   */
  async getAvailableAgentsForOrganization(organizationId: string): Promise<string[]> {
    try {
      const organization = await this.organizationService.getOrganization(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Get all registered agents
      const allAgents = this.agentRegistry.getAllAgents();
      
      // Filter based on organization settings and tier
      const availableAgents = allAgents
        .filter(agent => {
          // Check if agent is in organization's allowed agents list
          return organization.settings.features.aiAgents.includes(agent.config.id);
        })
        .map(agent => agent.config.id);

      return availableAgents;
    } catch (error) {
      this.logger.error('Failed to get available agents for organization:', error);
      throw error;
    }
  }

  /**
   * Map database row to agent config
   */
  private mapRowToAgentConfig(row: any): OrganizationAgentConfig {
    return {
      id: row.id,
      organizationId: row.organization_id,
      agentId: row.agent_id,
      enabled: row.enabled,
      priority: row.priority,
      maxConcurrentTasks: row.max_concurrent_tasks,
      config: JSON.parse(row.config || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to feature config
   */
  private mapRowToFeatureConfig(row: any): OrganizationFeatureConfig {
    return {
      id: row.id,
      organizationId: row.organization_id,
      featureName: row.feature_name,
      enabled: row.enabled,
      config: JSON.parse(row.config || '{}'),
      limits: JSON.parse(row.limits || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to workflow config
   */
  private mapRowToWorkflowConfig(row: any): OrganizationWorkflowConfig {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      triggerEvents: JSON.parse(row.trigger_events || '[]'),
      actions: JSON.parse(row.actions || '[]'),
      conditions: JSON.parse(row.conditions || '[]'),
      schedule: JSON.parse(row.schedule || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to integration config
   */
  private mapRowToIntegrationConfig(row: any): OrganizationIntegrationConfig {
    return {
      id: row.id,
      organizationId: row.organization_id,
      integrationType: row.integration_type,
      name: row.name,
      enabled: row.enabled,
      credentials: JSON.parse(row.credentials || '{}'),
      config: JSON.parse(row.config || '{}'),
      webhookUrl: row.webhook_url,
      webhookSecret: row.webhook_secret,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      syncStatus: row.sync_status,
      syncError: row.sync_error,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export default OrganizationConfigService;