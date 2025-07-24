import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database-service';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface Organization {
  id: string;
  name: string;
  displayName: string;
  domain?: string;
  subdomain?: string;
  status: 'active' | 'suspended' | 'pending' | 'cancelled';
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  settings: OrganizationSettings;
  limits: OrganizationLimits;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  contactEmail: string;
  billingEmail?: string;
  logo?: string;
  website?: string;
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  timezone: string;
  language: string;
  currency: string;
}

export interface OrganizationSettings {
  features: {
    sso: boolean;
    analytics: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    webhooks: boolean;
    aiAgents: string[];
    collaboration: boolean;
    workflowAutomation: boolean;
    repositoryIntegration: boolean;
    securityScanning: boolean;
  };
  security: {
    enforceSSO: boolean;
    allowLocalAuth: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number; // days
    };
    sessionTimeout: number; // milliseconds
    ipWhitelist?: string[];
    allowedDomains?: string[];
  };
  branding: {
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string;
    favicon?: string;
    customCss?: string;
  };
  notifications: {
    email: boolean;
    slack: boolean;
    teams: boolean;
    webhooks: string[];
  };
  integrations: {
    github: boolean;
    gitlab: boolean;
    jira: boolean;
    slack: boolean;
    teams: boolean;
    customWebhooks: boolean;
  };
}

export interface OrganizationLimits {
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
}

export interface OrganizationUser {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
  permissions: string[];
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  invitedBy?: string;
  joinedAt: Date;
  lastLoginAt?: Date;
  metadata?: Record<string, any>;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  permissions: string[];
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

export interface OrganizationUsage {
  organizationId: string;
  period: string; // YYYY-MM format
  users: number;
  projects: number;
  tasks: number;
  storageGB: number;
  apiCalls: number;
  agentExecutions: number;
  costs: {
    total: number;
    breakdown: {
      agents: number;
      storage: number;
      apiCalls: number;
      features: number;
    };
  };
  limits: OrganizationLimits;
  warnings: string[];
}

export class OrganizationService extends EventEmitter {
  private db: DatabaseService;
  private logger: winston.Logger;
  private defaultLimits: Record<string, OrganizationLimits>;

  constructor() {
    super();
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
          filename: 'logs/organization-service.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });

    this.defaultLimits = {
      free: {
        maxUsers: 5,
        maxProjects: 2,
        maxTasksPerMonth: 100,
        maxStorageGB: 1,
        maxAPICallsPerMonth: 1000,
        maxAgents: 2,
        maxCollaborators: 3,
        maxWebhooks: 1,
        maxIntegrations: 2,
        retentionDays: 30
      },
      starter: {
        maxUsers: 15,
        maxProjects: 10,
        maxTasksPerMonth: 1000,
        maxStorageGB: 10,
        maxAPICallsPerMonth: 10000,
        maxAgents: 5,
        maxCollaborators: 10,
        maxWebhooks: 5,
        maxIntegrations: 5,
        retentionDays: 90
      },
      professional: {
        maxUsers: 50,
        maxProjects: 50,
        maxTasksPerMonth: 10000,
        maxStorageGB: 100,
        maxAPICallsPerMonth: 100000,
        maxAgents: 15,
        maxCollaborators: 25,
        maxWebhooks: 15,
        maxIntegrations: 10,
        retentionDays: 365
      },
      enterprise: {
        maxUsers: -1, // unlimited
        maxProjects: -1,
        maxTasksPerMonth: -1,
        maxStorageGB: -1,
        maxAPICallsPerMonth: -1,
        maxAgents: -1,
        maxCollaborators: -1,
        maxWebhooks: -1,
        maxIntegrations: -1,
        retentionDays: -1
      }
    };
  }

  /**
   * Create a new organization
   */
  async createOrganization(data: {
    name: string;
    displayName: string;
    domain?: string;
    subdomain?: string;
    tier: 'free' | 'starter' | 'professional' | 'enterprise';
    createdBy: string;
    contactEmail: string;
    billingEmail?: string;
    industry?: string;
    size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    timezone?: string;
    language?: string;
    currency?: string;
  }): Promise<Organization> {
    try {
      // Validate subdomain uniqueness
      if (data.subdomain) {
        const existing = await this.getOrganizationBySubdomain(data.subdomain);
        if (existing) {
          throw new Error('Subdomain already exists');
        }
      }

      // Validate domain uniqueness
      if (data.domain) {
        const existing = await this.getOrganizationByDomain(data.domain);
        if (existing) {
          throw new Error('Domain already exists');
        }
      }

      const organization: Organization = {
        id: uuidv4(),
        name: data.name,
        displayName: data.displayName,
        domain: data.domain,
        subdomain: data.subdomain,
        status: 'active',
        tier: data.tier,
        settings: this.getDefaultSettings(data.tier),
        limits: this.defaultLimits[data.tier],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: data.createdBy,
        contactEmail: data.contactEmail,
        billingEmail: data.billingEmail,
        industry: data.industry,
        size: data.size,
        timezone: data.timezone || 'UTC',
        language: data.language || 'en',
        currency: data.currency || 'USD'
      };

      // Save to database
      await this.db.executeQuery(
        `INSERT INTO organizations (
          id, name, display_name, domain, subdomain, status, tier, 
          settings, limits, metadata, created_at, updated_at, 
          created_by, contact_email, billing_email, industry, 
          size, timezone, language, currency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          organization.id, organization.name, organization.displayName,
          organization.domain, organization.subdomain, organization.status,
          organization.tier, JSON.stringify(organization.settings),
          JSON.stringify(organization.limits), JSON.stringify(organization.metadata),
          organization.createdAt, organization.updatedAt, organization.createdBy,
          organization.contactEmail, organization.billingEmail, organization.industry,
          organization.size, organization.timezone, organization.language, organization.currency
        ]
      );

      // Add creator as owner
      await this.addUserToOrganization(organization.id, {
        userId: data.createdBy,
        email: data.contactEmail,
        role: 'owner',
        permissions: ['*']
      });

      this.logger.info('Organization created', {
        organizationId: organization.id,
        name: organization.name,
        tier: organization.tier,
        createdBy: data.createdBy
      });

      this.emit('organization:created', organization);

      return organization;
    } catch (error) {
      this.logger.error('Failed to create organization:', error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(id: string): Promise<Organization | null> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM organizations WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToOrganization(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get organization:', error);
      throw error;
    }
  }

  /**
   * Get organization by subdomain
   */
  async getOrganizationBySubdomain(subdomain: string): Promise<Organization | null> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM organizations WHERE subdomain = $1',
        [subdomain]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToOrganization(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get organization by subdomain:', error);
      throw error;
    }
  }

  /**
   * Get organization by domain
   */
  async getOrganizationByDomain(domain: string): Promise<Organization | null> {
    try {
      const result = await this.db.executeQuery(
        'SELECT * FROM organizations WHERE domain = $1',
        [domain]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToOrganization(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get organization by domain:', error);
      throw error;
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    try {
      const existing = await this.getOrganization(id);
      if (!existing) {
        throw new Error('Organization not found');
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      await this.db.executeQuery(
        `UPDATE organizations SET 
          display_name = $1, domain = $2, subdomain = $3, status = $4, 
          tier = $5, settings = $6, limits = $7, metadata = $8, 
          updated_at = $9, contact_email = $10, billing_email = $11, 
          industry = $12, size = $13, timezone = $14, language = $15, 
          currency = $16, logo = $17, website = $18
        WHERE id = $19`,
        [
          updated.displayName, updated.domain, updated.subdomain, updated.status,
          updated.tier, JSON.stringify(updated.settings), JSON.stringify(updated.limits),
          JSON.stringify(updated.metadata), updated.updatedAt, updated.contactEmail,
          updated.billingEmail, updated.industry, updated.size, updated.timezone,
          updated.language, updated.currency, updated.logo, updated.website, id
        ]
      );

      this.logger.info('Organization updated', { organizationId: id });
      this.emit('organization:updated', updated);

      return updated;
    } catch (error) {
      this.logger.error('Failed to update organization:', error);
      throw error;
    }
  }

  /**
   * Delete organization
   */
  async deleteOrganization(id: string): Promise<void> {
    try {
      const organization = await this.getOrganization(id);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Soft delete - mark as cancelled
      await this.updateOrganization(id, { status: 'cancelled' });

      this.logger.info('Organization deleted', { organizationId: id });
      this.emit('organization:deleted', { organizationId: id });
    } catch (error) {
      this.logger.error('Failed to delete organization:', error);
      throw error;
    }
  }

  /**
   * List organizations with pagination
   */
  async listOrganizations(options: {
    limit?: number;
    offset?: number;
    status?: string;
    tier?: string;
    search?: string;
  } = {}): Promise<{ organizations: Organization[]; total: number }> {
    try {
      const { limit = 20, offset = 0, status, tier, search } = options;
      
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (tier) {
        whereClause += ` AND tier = $${paramIndex}`;
        params.push(tier);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex} OR contact_email ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countResult = await this.db.executeQuery(
        `SELECT COUNT(*) FROM organizations ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get organizations
      const result = await this.db.executeQuery(
        `SELECT * FROM organizations ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const organizations = result.rows.map(row => this.mapRowToOrganization(row));

      return { organizations, total };
    } catch (error) {
      this.logger.error('Failed to list organizations:', error);
      throw error;
    }
  }

  /**
   * Add user to organization
   */
  async addUserToOrganization(organizationId: string, userData: {
    userId: string;
    email: string;
    role: string;
    permissions: string[];
  }): Promise<OrganizationUser> {
    try {
      const orgUser: OrganizationUser = {
        id: uuidv4(),
        organizationId,
        userId: userData.userId,
        email: userData.email,
        role: userData.role as any,
        permissions: userData.permissions,
        status: 'active',
        joinedAt: new Date()
      };

      await this.db.executeQuery(
        `INSERT INTO organization_users (
          id, organization_id, user_id, email, role, permissions, 
          status, joined_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orgUser.id, orgUser.organizationId, orgUser.userId,
          orgUser.email, orgUser.role, JSON.stringify(orgUser.permissions),
          orgUser.status, orgUser.joinedAt
        ]
      );

      this.logger.info('User added to organization', {
        organizationId,
        userId: userData.userId,
        role: userData.role
      });

      this.emit('organization:user:added', orgUser);

      return orgUser;
    } catch (error) {
      this.logger.error('Failed to add user to organization:', error);
      throw error;
    }
  }

  /**
   * Get organization usage for current period
   */
  async getOrganizationUsage(organizationId: string, period?: string): Promise<OrganizationUsage> {
    try {
      const currentPeriod = period || new Date().toISOString().substring(0, 7); // YYYY-MM
      
      // Get usage stats from database
      const result = await this.db.executeQuery(
        'SELECT * FROM organization_usage WHERE organization_id = $1 AND period = $2',
        [organizationId, currentPeriod]
      );

      if (result.rows.length === 0) {
        // Return default usage if no data exists
        const organization = await this.getOrganization(organizationId);
        if (!organization) {
          throw new Error('Organization not found');
        }

        return {
          organizationId,
          period: currentPeriod,
          users: 0,
          projects: 0,
          tasks: 0,
          storageGB: 0,
          apiCalls: 0,
          agentExecutions: 0,
          costs: {
            total: 0,
            breakdown: {
              agents: 0,
              storage: 0,
              apiCalls: 0,
              features: 0
            }
          },
          limits: organization.limits,
          warnings: []
        };
      }

      const row = result.rows[0];
      return {
        organizationId: row.organization_id,
        period: row.period,
        users: row.users,
        projects: row.projects,
        tasks: row.tasks,
        storageGB: row.storage_gb,
        apiCalls: row.api_calls,
        agentExecutions: row.agent_executions,
        costs: JSON.parse(row.costs),
        limits: JSON.parse(row.limits),
        warnings: JSON.parse(row.warnings || '[]')
      };
    } catch (error) {
      this.logger.error('Failed to get organization usage:', error);
      throw error;
    }
  }

  /**
   * Check if organization has reached limits
   */
  async checkLimits(organizationId: string): Promise<{
    withinLimits: boolean;
    violations: string[];
    warnings: string[];
  }> {
    try {
      const usage = await this.getOrganizationUsage(organizationId);
      const violations: string[] = [];
      const warnings: string[] = [];

      // Check each limit (skip unlimited limits marked as -1)
      if (usage.limits.maxUsers !== -1 && usage.users > usage.limits.maxUsers) {
        violations.push(`User limit exceeded: ${usage.users}/${usage.limits.maxUsers}`);
      } else if (usage.limits.maxUsers !== -1 && usage.users > usage.limits.maxUsers * 0.8) {
        warnings.push(`Approaching user limit: ${usage.users}/${usage.limits.maxUsers}`);
      }

      if (usage.limits.maxProjects !== -1 && usage.projects > usage.limits.maxProjects) {
        violations.push(`Project limit exceeded: ${usage.projects}/${usage.limits.maxProjects}`);
      }

      if (usage.limits.maxTasksPerMonth !== -1 && usage.tasks > usage.limits.maxTasksPerMonth) {
        violations.push(`Monthly task limit exceeded: ${usage.tasks}/${usage.limits.maxTasksPerMonth}`);
      }

      if (usage.limits.maxStorageGB !== -1 && usage.storageGB > usage.limits.maxStorageGB) {
        violations.push(`Storage limit exceeded: ${usage.storageGB}GB/${usage.limits.maxStorageGB}GB`);
      }

      if (usage.limits.maxAPICallsPerMonth !== -1 && usage.apiCalls > usage.limits.maxAPICallsPerMonth) {
        violations.push(`API call limit exceeded: ${usage.apiCalls}/${usage.limits.maxAPICallsPerMonth}`);
      }

      return {
        withinLimits: violations.length === 0,
        violations,
        warnings
      };
    } catch (error) {
      this.logger.error('Failed to check organization limits:', error);
      throw error;
    }
  }

  /**
   * Get default settings for tier
   */
  private getDefaultSettings(tier: string): OrganizationSettings {
    const baseSettings: OrganizationSettings = {
      features: {
        sso: false,
        analytics: true,
        apiAccess: true,
        customBranding: false,
        webhooks: false,
        aiAgents: ['claude-001', 'gemini-001'],
        collaboration: true,
        workflowAutomation: false,
        repositoryIntegration: false,
        securityScanning: false
      },
      security: {
        enforceSSO: false,
        allowLocalAuth: true,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          maxAge: 90
        },
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      },
      branding: {},
      notifications: {
        email: true,
        slack: false,
        teams: false,
        webhooks: []
      },
      integrations: {
        github: false,
        gitlab: false,
        jira: false,
        slack: false,
        teams: false,
        customWebhooks: false
      }
    };

    // Customize based on tier
    switch (tier) {
      case 'professional':
        baseSettings.features.sso = true;
        baseSettings.features.webhooks = true;
        baseSettings.features.repositoryIntegration = true;
        baseSettings.features.workflowAutomation = true;
        baseSettings.integrations.github = true;
        baseSettings.integrations.gitlab = true;
        break;
      case 'enterprise':
        baseSettings.features.sso = true;
        baseSettings.features.customBranding = true;
        baseSettings.features.webhooks = true;
        baseSettings.features.repositoryIntegration = true;
        baseSettings.features.workflowAutomation = true;
        baseSettings.features.securityScanning = true;
        baseSettings.integrations.github = true;
        baseSettings.integrations.gitlab = true;
        baseSettings.integrations.jira = true;
        baseSettings.integrations.customWebhooks = true;
        break;
    }

    return baseSettings;
  }

  /**
   * Map database row to organization object
   */
  private mapRowToOrganization(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      domain: row.domain,
      subdomain: row.subdomain,
      status: row.status,
      tier: row.tier,
      settings: JSON.parse(row.settings || '{}'),
      limits: JSON.parse(row.limits || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      contactEmail: row.contact_email,
      billingEmail: row.billing_email,
      logo: row.logo,
      website: row.website,
      industry: row.industry,
      size: row.size,
      timezone: row.timezone,
      language: row.language,
      currency: row.currency
    };
  }
}

export default OrganizationService;