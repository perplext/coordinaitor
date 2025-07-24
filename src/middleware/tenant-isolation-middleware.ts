import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { OrganizationService, Organization } from '../services/organization-service';

interface TenantRequest extends Request {
  tenant?: {
    organization: Organization;
    subdomain?: string;
    domain?: string;
    isMultiTenant: boolean;
  };
  user?: {
    id: string;
    email: string;
    organizationId: string;
    roles: string[];
    permissions: string[];
  };
}

export interface TenantIsolationConfig {
  enabled: boolean;
  multiTenantStrategy: 'subdomain' | 'domain' | 'header' | 'path';
  defaultOrganizationId?: string;
  allowedDomains?: string[];
  requireTenantHeader?: boolean;
  tenantHeaderName?: string;
}

export class TenantIsolationMiddleware {
  private organizationService: OrganizationService;
  private config: TenantIsolationConfig;
  private logger: winston.Logger;
  private organizationCache: Map<string, { organization: Organization; expires: number }>;

  constructor(config: TenantIsolationConfig) {
    this.config = config;
    this.organizationService = new OrganizationService();
    this.organizationCache = new Map();

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
          filename: 'logs/tenant-isolation.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Main tenant isolation middleware
   */
  isolate = () => {
    return async (req: TenantRequest, res: Response, next: NextFunction) => {
      try {
        if (!this.config.enabled) {
          // Multi-tenancy disabled, use default organization
          if (this.config.defaultOrganizationId) {
            const organization = await this.getOrganizationFromCache(this.config.defaultOrganizationId);
            if (organization) {
              req.tenant = {
                organization,
                isMultiTenant: false
              };
            }
          }
          return next();
        }

        const organization = await this.resolveOrganization(req);
        
        if (!organization) {
          return this.handleTenantNotFound(req, res);
        }

        // Check organization status
        if (organization.status !== 'active') {
          return this.handleInactiveOrganization(req, res, organization);
        }

        // Set tenant context
        req.tenant = {
          organization,
          subdomain: this.extractSubdomain(req),
          domain: this.extractDomain(req),
          isMultiTenant: true
        };

        // Add tenant-specific response headers
        res.setHeader('X-Tenant-ID', organization.id);
        res.setHeader('X-Tenant-Name', organization.name);

        this.logger.debug('Tenant resolved', {
          organizationId: organization.id,
          organizationName: organization.name,
          strategy: this.config.multiTenantStrategy,
          requestId: req.headers['x-request-id']
        });

        next();
      } catch (error) {
        this.logger.error('Tenant isolation failed:', error);
        res.status(500).json({
          error: 'Tenant resolution failed',
          message: 'Unable to determine organization context'
        });
      }
    };
  };

  /**
   * Enforce organization boundaries
   */
  enforceOrganizationBoundary = () => {
    return (req: TenantRequest, res: Response, next: NextFunction) => {
      if (!req.tenant?.organization) {
        return res.status(400).json({
          error: 'Organization context required',
          message: 'Request must include valid organization context'
        });
      }

      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User authentication required for organization access'
        });
      }

      // Check if user belongs to the organization
      if (req.user.organizationId !== req.tenant.organization.id) {
        // Allow super admins to access any organization
        if (!req.user.roles.includes('super_admin')) {
          this.logger.warn('Cross-organization access attempt', {
            userId: req.user.id,
            userOrgId: req.user.organizationId,
            requestedOrgId: req.tenant.organization.id,
            path: req.path
          });

          return res.status(403).json({
            error: 'Organization access denied',
            message: 'User does not belong to the requested organization'
          });
        }
      }

      next();
    };
  };

  /**
   * Check organization limits and quotas
   */
  checkLimits = (resource: 'users' | 'projects' | 'tasks' | 'storage' | 'api_calls') => {
    return async (req: TenantRequest, res: Response, next: NextFunction) => {
      if (!req.tenant?.organization) {
        return next();
      }

      try {
        const limits = await this.organizationService.checkLimits(req.tenant.organization.id);
        
        if (!limits.withinLimits) {
          return res.status(429).json({
            error: 'Organization limits exceeded',
            message: 'Your organization has exceeded its limits',
            violations: limits.violations,
            upgradeUrl: '/billing/upgrade'
          });
        }

        // Add warnings to response headers
        if (limits.warnings.length > 0) {
          res.setHeader('X-Tenant-Warnings', JSON.stringify(limits.warnings));
        }

        next();
      } catch (error) {
        this.logger.error('Failed to check organization limits:', error);
        next(); // Continue on error to avoid blocking requests
      }
    };
  };

  /**
   * Require specific organization features
   */
  requireFeature = (feature: string) => {
    return (req: TenantRequest, res: Response, next: NextFunction) => {
      if (!req.tenant?.organization) {
        return res.status(400).json({
          error: 'Organization context required'
        });
      }

      const hasFeature = this.checkOrganizationFeature(req.tenant.organization, feature);
      
      if (!hasFeature) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `The '${feature}' feature is not available for your organization tier`,
          currentTier: req.tenant.organization.tier,
          upgradeUrl: '/billing/upgrade'
        });
      }

      next();
    };
  };

  /**
   * Resolve organization from request
   */
  private async resolveOrganization(req: TenantRequest): Promise<Organization | null> {
    switch (this.config.multiTenantStrategy) {
      case 'subdomain':
        return this.resolveBySubdomain(req);
      case 'domain':
        return this.resolveByDomain(req);
      case 'header':
        return this.resolveByHeader(req);
      case 'path':
        return this.resolveByPath(req);
      default:
        throw new Error(`Unknown multi-tenant strategy: ${this.config.multiTenantStrategy}`);
    }
  }

  /**
   * Resolve organization by subdomain
   */
  private async resolveBySubdomain(req: TenantRequest): Promise<Organization | null> {
    const subdomain = this.extractSubdomain(req);
    if (!subdomain) {
      return null;
    }

    return this.getOrganizationBySubdomain(subdomain);
  }

  /**
   * Resolve organization by custom domain
   */
  private async resolveByDomain(req: TenantRequest): Promise<Organization | null> {
    const domain = this.extractDomain(req);
    if (!domain) {
      return null;
    }

    return this.getOrganizationByDomain(domain);
  }

  /**
   * Resolve organization by header
   */
  private async resolveByHeader(req: TenantRequest): Promise<Organization | null> {
    const headerName = this.config.tenantHeaderName || 'X-Tenant-ID';
    const tenantId = req.headers[headerName.toLowerCase()] as string;
    
    if (!tenantId) {
      if (this.config.requireTenantHeader) {
        throw new Error(`Required tenant header '${headerName}' not found`);
      }
      return null;
    }

    return this.getOrganizationFromCache(tenantId);
  }

  /**
   * Resolve organization by path prefix
   */
  private async resolveByPath(req: TenantRequest): Promise<Organization | null> {
    const pathParts = req.path.split('/').filter(Boolean);
    if (pathParts.length === 0 || pathParts[0] !== 'org') {
      return null;
    }

    const orgIdentifier = pathParts[1];
    if (!orgIdentifier) {
      return null;
    }

    // Try by ID first, then by subdomain
    let organization = await this.getOrganizationFromCache(orgIdentifier);
    if (!organization) {
      organization = await this.getOrganizationBySubdomain(orgIdentifier);
    }

    return organization;
  }

  /**
   * Extract subdomain from request
   */
  private extractSubdomain(req: TenantRequest): string | null {
    const host = req.headers.host;
    if (!host) {
      return null;
    }

    const parts = host.split('.');
    if (parts.length < 3) {
      return null; // No subdomain
    }

    const subdomain = parts[0];
    
    // Skip common non-tenant subdomains
    const skipSubdomains = ['www', 'api', 'admin', 'docs', 'status'];
    if (skipSubdomains.includes(subdomain)) {
      return null;
    }

    return subdomain;
  }

  /**
   * Extract domain from request
   */
  private extractDomain(req: TenantRequest): string | null {
    const host = req.headers.host;
    if (!host) {
      return null;
    }

    // Remove port if present
    const domain = host.split(':')[0];
    
    // Check if it's in allowed domains list
    if (this.config.allowedDomains && !this.config.allowedDomains.includes(domain)) {
      return null;
    }

    return domain;
  }

  /**
   * Get organization from cache or database
   */
  private async getOrganizationFromCache(id: string): Promise<Organization | null> {
    const cached = this.organizationCache.get(id);
    const now = Date.now();

    if (cached && cached.expires > now) {
      return cached.organization;
    }

    try {
      const organization = await this.organizationService.getOrganization(id);
      if (organization) {
        // Cache for 5 minutes
        this.organizationCache.set(id, {
          organization,
          expires: now + (5 * 60 * 1000)
        });
      }
      return organization;
    } catch (error) {
      this.logger.error('Failed to get organization:', error);
      return null;
    }
  }

  /**
   * Get organization by subdomain
   */
  private async getOrganizationBySubdomain(subdomain: string): Promise<Organization | null> {
    try {
      return await this.organizationService.getOrganizationBySubdomain(subdomain);
    } catch (error) {
      this.logger.error('Failed to get organization by subdomain:', error);
      return null;
    }
  }

  /**
   * Get organization by domain
   */
  private async getOrganizationByDomain(domain: string): Promise<Organization | null> {
    try {
      return await this.organizationService.getOrganizationByDomain(domain);
    } catch (error) {
      this.logger.error('Failed to get organization by domain:', error);
      return null;
    }
  }

  /**
   * Check if organization has specific feature
   */
  private checkOrganizationFeature(organization: Organization, feature: string): boolean {
    const features = organization.settings.features as any;
    return features[feature] === true;
  }

  /**
   * Handle tenant not found
   */
  private handleTenantNotFound(req: TenantRequest, res: Response): void {
    this.logger.warn('Tenant not found', {
      host: req.headers.host,
      path: req.path,
      strategy: this.config.multiTenantStrategy
    });

    res.status(404).json({
      error: 'Organization not found',
      message: 'The requested organization does not exist or is not accessible',
      strategy: this.config.multiTenantStrategy
    });
  }

  /**
   * Handle inactive organization
   */
  private handleInactiveOrganization(req: TenantRequest, res: Response, organization: Organization): void {
    this.logger.warn('Inactive organization access attempt', {
      organizationId: organization.id,
      status: organization.status,
      host: req.headers.host
    });

    const messages = {
      suspended: 'This organization has been suspended. Please contact support.',
      pending: 'This organization is still being set up. Please try again later.',
      cancelled: 'This organization has been cancelled and is no longer accessible.'
    };

    res.status(403).json({
      error: 'Organization not available',
      message: messages[organization.status as keyof typeof messages] || 'Organization is not active',
      status: organization.status,
      contactEmail: 'support@multi-agent-orchestrator.com'
    });
  }

  /**
   * Clear organization cache
   */
  public clearCache(organizationId?: string): void {
    if (organizationId) {
      this.organizationCache.delete(organizationId);
    } else {
      this.organizationCache.clear();
    }
  }
}

/**
 * Factory function to create tenant isolation middleware
 */
export function createTenantIsolationMiddleware(config: TenantIsolationConfig): TenantIsolationMiddleware {
  return new TenantIsolationMiddleware(config);
}

export default TenantIsolationMiddleware;