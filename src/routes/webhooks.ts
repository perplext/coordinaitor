import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { RepositoryService } from '../services/repository-service';
import { TaskOrchestrator } from '../orchestration/task-orchestrator';
import winston from 'winston';

const router = Router();

interface WebhookRequest extends Request {
  rawBody?: Buffer;
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
      filename: 'logs/webhooks.log',
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Store repository services by provider
const repositoryServices: Map<string, RepositoryService> = new Map();
let taskOrchestrator: TaskOrchestrator;

export function initializeWebhookRoutes(
  githubService?: RepositoryService,
  gitlabService?: RepositoryService,
  orchestrator?: TaskOrchestrator
) {
  if (githubService) {
    repositoryServices.set('github', githubService);
  }
  if (gitlabService) {
    repositoryServices.set('gitlab', gitlabService);
  }
  if (orchestrator) {
    taskOrchestrator = orchestrator;
  }
}

// Middleware to capture raw body for signature verification
function captureRawBody(req: WebhookRequest, res: Response, next: Function) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = Buffer.from(data, 'utf8');
    req.body = data ? JSON.parse(data) : {};
    next();
  });
}

/**
 * GitHub Webhook Endpoint
 */
router.post('/github', captureRawBody, async (req: WebhookRequest, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const eventType = req.headers['x-github-event'] as string;
    const deliveryId = req.headers['x-github-delivery'] as string;

    logger.info('Received GitHub webhook', {
      eventType,
      deliveryId,
      repository: req.body.repository?.full_name
    });

    const githubService = repositoryServices.get('github');
    if (!githubService) {
      logger.error('GitHub service not configured');
      return res.status(500).json({ error: 'GitHub service not configured' });
    }

    // Verify webhook signature
    if (signature && req.rawBody) {
      const isValid = githubService.verifyWebhookSignature(
        req.rawBody.toString(),
        signature
      );
      
      if (!isValid) {
        logger.warn('Invalid GitHub webhook signature', { deliveryId });
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Process the webhook event
    await githubService.processWebhookEvent(eventType, req.body);

    // Send immediate response
    res.status(200).json({ 
      message: 'Webhook processed successfully',
      deliveryId,
      eventType
    });

  } catch (error) {
    logger.error('Failed to process GitHub webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GitLab Webhook Endpoint
 */
router.post('/gitlab', captureRawBody, async (req: WebhookRequest, res: Response) => {
  try {
    const token = req.headers['x-gitlab-token'] as string;
    const eventType = req.headers['x-gitlab-event'] as string;

    logger.info('Received GitLab webhook', {
      eventType,
      project: req.body.project?.path_with_namespace
    });

    const gitlabService = repositoryServices.get('gitlab');
    if (!gitlabService) {
      logger.error('GitLab service not configured');
      return res.status(500).json({ error: 'GitLab service not configured' });
    }

    // Verify webhook token (GitLab uses a simple token instead of HMAC)
    if (token && req.rawBody) {
      // GitLab webhook verification would be implemented here
      // For now, we'll assume the token verification is handled in the service
    }

    // Normalize GitLab event type to match GitHub format
    const normalizedEventType = normalizeGitLabEventType(eventType);
    
    // Process the webhook event
    await gitlabService.processWebhookEvent(normalizedEventType, req.body);

    // Send immediate response
    res.status(200).json({ 
      message: 'Webhook processed successfully',
      eventType: normalizedEventType
    });

  } catch (error) {
    logger.error('Failed to process GitLab webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generic webhook endpoint for testing
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    logger.info('Received test webhook', {
      headers: req.headers,
      body: req.body
    });

    res.status(200).json({ 
      message: 'Test webhook received successfully',
      timestamp: new Date().toISOString(),
      body: req.body
    });

  } catch (error) {
    logger.error('Failed to process test webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Webhook health check
 */
router.get('/health', (req: Request, res: Response) => {
  const services = {
    github: repositoryServices.has('github'),
    gitlab: repositoryServices.has('gitlab'),
    taskOrchestrator: !!taskOrchestrator
  };

  const allHealthy = Object.values(services).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    services,
    timestamp: new Date().toISOString()
  });
});

/**
 * List active webhooks for a repository
 */
router.get('/:provider/:owner/:repo', async (req: Request, res: Response) => {
  try {
    const { provider, owner, repo } = req.params;
    
    if (!['github', 'gitlab'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    const service = repositoryServices.get(provider);
    if (!service) {
      return res.status(404).json({ error: `${provider} service not configured` });
    }

    // This would list webhooks for the repository
    // Implementation depends on the provider's API
    res.status(200).json({ 
      message: 'Webhook list endpoint',
      provider,
      repository: `${owner}/${repo}`
    });

  } catch (error) {
    logger.error('Failed to list webhooks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new webhook for a repository
 */
router.post('/:provider/:owner/:repo/hooks', async (req: Request, res: Response) => {
  try {
    const { provider, owner, repo } = req.params;
    const { events, url } = req.body;

    if (!['github', 'gitlab'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    const service = repositoryServices.get(provider);
    if (!service) {
      return res.status(404).json({ error: `${provider} service not configured` });
    }

    if (!events || !Array.isArray(events) || !url) {
      return res.status(400).json({ 
        error: 'Missing required fields: events (array) and url (string)' 
      });
    }

    const webhookId = await service.createWebhook(owner, repo, url, events);

    logger.info('Webhook created via API', {
      provider,
      repository: `${owner}/${repo}`,
      webhookId,
      events,
      url
    });

    res.status(201).json({
      message: 'Webhook created successfully',
      webhookId,
      provider,
      repository: `${owner}/${repo}`,
      events,
      url
    });

  } catch (error) {
    logger.error('Failed to create webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a webhook
 */
router.delete('/:provider/:owner/:repo/hooks/:hookId', async (req: Request, res: Response) => {
  try {
    const { provider, owner, repo, hookId } = req.params;

    if (!['github', 'gitlab'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    const service = repositoryServices.get(provider);
    if (!service) {
      return res.status(404).json({ error: `${provider} service not configured` });
    }

    await service.deleteWebhook(owner, repo, hookId);

    logger.info('Webhook deleted via API', {
      provider,
      repository: `${owner}/${repo}`,
      webhookId: hookId
    });

    res.status(200).json({
      message: 'Webhook deleted successfully',
      webhookId: hookId,
      provider,
      repository: `${owner}/${repo}`
    });

  } catch (error) {
    logger.error('Failed to delete webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to normalize GitLab event types to match GitHub
function normalizeGitLabEventType(gitlabEventType: string): string {
  const eventMap: Record<string, string> = {
    'Push Hook': 'push',
    'Merge Request Hook': 'pull_request',
    'Issue Hook': 'issues',
    'Tag Push Hook': 'tag_push',
    'Release Hook': 'release',
    'Wiki Page Hook': 'wiki',
    'Pipeline Hook': 'pipeline',
    'Job Hook': 'job',
    'Deployment Hook': 'deployment'
  };

  return eventMap[gitlabEventType] || gitlabEventType.toLowerCase().replace(/\s+/g, '_');
}

// Error handling middleware
router.use((error: Error, req: Request, res: Response, next: Function) => {
  logger.error('Webhook route error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    message: 'An error occurred while processing the webhook'
  });
});

export default router;