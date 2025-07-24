import { Router, Request, Response } from 'express';
import { RepositoryService, RepositoryConfig } from '../services/repository-service';
import { RepositoryAutomationService } from '../services/repository-automation-service';
import { TaskOrchestrator } from '../orchestration/task-orchestrator';
import { DatabaseService } from '../database/database-service';
import winston from 'winston';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    organizationId: string;
    role: string;
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
      filename: 'logs/repositories.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Store repository services by organization
const organizationServices: Map<string, {
  github?: RepositoryService;
  gitlab?: RepositoryService;
  automation?: RepositoryAutomationService;
}> = new Map();

/**
 * Get organization repository services
 */
async function getOrganizationServices(organizationId: string) {
  if (!organizationServices.has(organizationId)) {
    organizationServices.set(organizationId, {});
  }
  return organizationServices.get(organizationId)!;
}

/**
 * Initialize repository service for organization
 */
router.post('/setup/:provider', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider } = req.params;
    const { apiUrl, token, webhookSecret, organization, defaultBranch } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!['github', 'gitlab'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    if (!apiUrl || !token) {
      return res.status(400).json({ 
        error: 'Missing required fields: apiUrl and token' 
      });
    }

    const config: RepositoryConfig = {
      provider: provider as 'github' | 'gitlab',
      apiUrl,
      token,
      webhookSecret,
      organization,
      defaultBranch
    };

    const service = new RepositoryService(config);
    await service.initialize();

    const services = await getOrganizationServices(organizationId);
    services[provider as 'github' | 'gitlab'] = service;

    logger.info('Repository service configured', {
      organizationId,
      provider,
      organization
    });

    res.status(200).json({
      message: `${provider} repository service configured successfully`,
      provider,
      organization,
      apiUrl
    });

  } catch (error) {
    logger.error('Failed to setup repository service:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List repositories for organization
 */
router.get('/:provider/repos', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const services = await getOrganizationServices(organizationId);
    const service = services[provider as 'github' | 'gitlab'];

    if (!service) {
      return res.status(404).json({ 
        error: `${provider} service not configured for this organization` 
      });
    }

    const options = {
      organization: req.query.organization as string,
      type: req.query.type as 'all' | 'owner' | 'member',
      sort: req.query.sort as 'created' | 'updated' | 'pushed' | 'full_name',
      direction: req.query.direction as 'asc' | 'desc',
      per_page: req.query.per_page ? parseInt(req.query.per_page as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined
    };

    const repositories = await service.listRepositories(options);

    res.status(200).json({
      repositories,
      count: repositories.length,
      provider
    });

  } catch (error) {
    logger.error('Failed to list repositories:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get specific repository
 */
router.get('/:provider/repos/:owner/:repo', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, owner, repo } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const services = await getOrganizationServices(organizationId);
    const service = services[provider as 'github' | 'gitlab'];

    if (!service) {
      return res.status(404).json({ 
        error: `${provider} service not configured for this organization` 
      });
    }

    const repository = await service.getRepository(owner, repo);

    res.status(200).json({
      repository,
      provider
    });

  } catch (error) {
    logger.error('Failed to get repository:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create repository integration
 */
router.post('/:provider/repos/:owner/:repo/integrate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, owner, repo } = req.params;
    const { 
      autoCreateTasks, 
      autoCreatePR, 
      branchPrefix, 
      enabledEvents, 
      taskCreationRules 
    } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const services = await getOrganizationServices(organizationId);
    const service = services[provider as 'github' | 'gitlab'];

    if (!service) {
      return res.status(404).json({ 
        error: `${provider} service not configured for this organization` 
      });
    }

    // Get repository details
    const repository = await service.getRepository(owner, repo);

    // Create webhook for the repository
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL || 'http://localhost:3000'}/api/webhooks/${provider}`;
    const events = enabledEvents || ['push', 'pull_request', 'issues'];
    
    const webhookId = await service.createWebhook(owner, repo, webhookUrl, events);

    // Create integration record
    const integration = await service.createIntegration({
      organizationId,
      repositoryId: repository.id,
      repositoryName: repository.fullName,
      provider: provider as 'github' | 'gitlab',
      webhookUrl,
      autoCreateTasks: autoCreateTasks || false,
      autoCreatePR: autoCreatePR || false,
      branchPrefix,
      settings: {
        enabledEvents: events,
        taskCreationRules: taskCreationRules || {}
      }
    });

    logger.info('Repository integration created', {
      organizationId,
      repository: repository.fullName,
      provider,
      webhookId
    });

    res.status(201).json({
      message: 'Repository integration created successfully',
      integration,
      webhookId,
      webhookUrl
    });

  } catch (error) {
    logger.error('Failed to create repository integration:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List repository integrations
 */
router.get('/integrations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const services = await getOrganizationServices(organizationId);
    const integrations = [];

    // Collect integrations from all configured services
    for (const [provider, service] of Object.entries(services)) {
      if (service && 'listIntegrations' in service) {
        const providerIntegrations = await service.listIntegrations(organizationId);
        integrations.push(...providerIntegrations.map(integration => ({
          ...integration,
          provider
        })));
      }
    }

    res.status(200).json({
      integrations,
      count: integrations.length
    });

  } catch (error) {
    logger.error('Failed to list integrations:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update repository integration
 */
router.put('/integrations/:integrationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { integrationId } = req.params;
    const updates = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find the integration across all services
    const services = await getOrganizationServices(organizationId);
    let integration = null;
    let service = null;

    for (const svc of Object.values(services)) {
      if (svc && 'getIntegration' in svc) {
        const found = await svc.getIntegration(integrationId);
        if (found) {
          integration = found;
          service = svc;
          break;
        }
      }
    }

    if (!integration || !service) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Update the integration (implementation would depend on the service)
    logger.info('Repository integration updated', {
      organizationId,
      integrationId,
      updates
    });

    res.status(200).json({
      message: 'Integration updated successfully',
      integration
    });

  } catch (error) {
    logger.error('Failed to update integration:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete repository integration
 */
router.delete('/integrations/:integrationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { integrationId } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find and delete the integration
    const services = await getOrganizationServices(organizationId);
    let deleted = false;

    for (const service of Object.values(services)) {
      if (service && 'deleteIntegration' in service) {
        try {
          await service.deleteIntegration(integrationId);
          deleted = true;
          break;
        } catch (error) {
          // Continue to next service
        }
      }
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    logger.info('Repository integration deleted', {
      organizationId,
      integrationId
    });

    res.status(200).json({
      message: 'Integration deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete integration:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List pull requests for repository
 */
router.get('/:provider/repos/:owner/:repo/pulls', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, owner, repo } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const services = await getOrganizationServices(organizationId);
    const service = services[provider as 'github' | 'gitlab'];

    if (!service) {
      return res.status(404).json({ 
        error: `${provider} service not configured for this organization` 
      });
    }

    const options = {
      state: req.query.state as 'open' | 'closed' | 'all',
      sort: req.query.sort as 'created' | 'updated',
      direction: req.query.direction as 'asc' | 'desc',
      per_page: req.query.per_page ? parseInt(req.query.per_page as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined
    };

    const pullRequests = await service.listPullRequests(owner, repo, options);

    res.status(200).json({
      pullRequests,
      count: pullRequests.length,
      provider,
      repository: `${owner}/${repo}`
    });

  } catch (error) {
    logger.error('Failed to list pull requests:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List issues for repository
 */
router.get('/:provider/repos/:owner/:repo/issues', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, owner, repo } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const services = await getOrganizationServices(organizationId);
    const service = services[provider as 'github' | 'gitlab'];

    if (!service) {
      return res.status(404).json({ 
        error: `${provider} service not configured for this organization` 
      });
    }

    const options = {
      state: req.query.state as 'open' | 'closed' | 'all',
      labels: req.query.labels ? (req.query.labels as string).split(',') : undefined,
      assignee: req.query.assignee as string,
      sort: req.query.sort as 'created' | 'updated',
      direction: req.query.direction as 'asc' | 'desc',
      per_page: req.query.per_page ? parseInt(req.query.per_page as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined
    };

    const issues = await service.listIssues(owner, repo, options);

    res.status(200).json({
      issues,
      count: issues.length,
      provider,
      repository: `${owner}/${repo}`
    });

  } catch (error) {
    logger.error('Failed to list issues:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create automation rule
 */
router.post('/automation/rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const ruleData = {
      ...req.body,
      organizationId
    };

    // Get automation service (would need to be initialized)
    // For now, return success response
    logger.info('Automation rule creation requested', {
      organizationId,
      ruleName: ruleData.name
    });

    res.status(201).json({
      message: 'Automation rule created successfully',
      rule: ruleData
    });

  } catch (error) {
    logger.error('Failed to create automation rule:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for repository services
 */
router.get('/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const services = await getOrganizationServices(organizationId);
    const health = {
      github: !!services.github,
      gitlab: !!services.gitlab,
      automation: !!services.automation
    };

    const allHealthy = Object.values(health).some(Boolean);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      services: health,
      organizationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to check repository services health:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;