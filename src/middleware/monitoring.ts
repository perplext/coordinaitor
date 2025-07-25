import { Request, Response, NextFunction } from 'express';
import { performanceMonitor, httpMetricsMiddleware } from '../monitoring/performance';
import { createLogger } from '../utils/logger';
import morgan from 'morgan';
import { httpLogStream } from '../utils/logger';

const logger = createLogger({ module: 'monitoring-middleware' });

// Request ID middleware
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Add request ID to logger context
  req.logger = createLogger({
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  
  next();
}

// Request timing middleware
export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        duration: `${duration.toFixed(2)}ms`,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      });
    }
  });
  
  next();
}

// Error tracking middleware
export function errorTrackingMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  const errorId = generateErrorId();
  
  // Log error with context
  logger.error('Request error', err, {
    errorId,
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    user: req.user?.id,
    organizationId: req.organizationId,
    statusCode: res.statusCode,
  });
  
  // Track error metrics
  performanceMonitor.recordAgentMetrics('system', 'internal', {
    error: err.name || 'UnknownError',
  });
  
  // Send error response
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      errorId,
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
  
  next(err);
}

// User activity tracking
export function activityTrackingMiddleware(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (req.user && res.statusCode < 400) {
      const resource = req.route?.path || req.path;
      const action = mapMethodToAction(req.method);
      
      performanceMonitor.recordUserActivity(req.user.id, action, resource);
      
      // Log significant activities
      if (shouldLogActivity(req.method, resource)) {
        logger.info('User activity', {
          userId: req.user.id,
          action,
          resource,
          organizationId: req.organizationId,
        });
      }
    }
  });
  
  next();
}

// API usage tracking
export function apiUsageMiddleware(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    const endpoint = req.route?.path || req.path;
    const organizationId = req.organizationId || 'anonymous';
    
    performanceMonitor.recordApiUsage(endpoint, req.method, organizationId);
  });
  
  next();
}

// Morgan HTTP logging configuration
export const httpLoggingMiddleware = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
  { stream: httpLogStream }
);

// Custom morgan tokens
morgan.token('request-id', (req: Request) => req.id || '-');
morgan.token('user-id', (req: Request) => req.user?.id || '-');
morgan.token('organization-id', (req: Request) => req.organizationId || '-');

// Enhanced HTTP logging for production
export const enhancedHttpLoggingMiddleware = morgan(
  ':request-id :remote-addr :user-id :organization-id ":method :url" :status :response-time ms :res[content-length]',
  { 
    stream: httpLogStream,
    skip: (req: Request) => req.path === '/health' || req.path === '/metrics',
  }
);

// Helper functions
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function mapMethodToAction(method: string): string {
  const methodActionMap: Record<string, string> = {
    GET: 'view',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };
  return methodActionMap[method] || 'unknown';
}

function shouldLogActivity(method: string, resource: string): boolean {
  // Log all non-GET requests and important GET requests
  if (method !== 'GET') return true;
  
  const importantResources = [
    '/api/tasks',
    '/api/agents',
    '/api/projects',
    '/api/users',
    '/api/organizations',
  ];
  
  return importantResources.some(r => resource.startsWith(r));
}

// Monitoring setup function
export function setupMonitoring(app: any) {
  // Start performance monitor
  performanceMonitor.start();
  
  // Add metrics endpoint
  app.get('/metrics', (req: Request, res: Response) => {
    res.set('Content-Type', performanceMonitor.getContentType());
    res.end(performanceMonitor.getMetrics());
  });
  
  // Add health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version,
    };
    res.json(health);
  });
  
  // Add readiness check endpoint
  app.get('/ready', async (req: Request, res: Response) => {
    try {
      // Check database connection
      // Check Redis connection
      // Check external services
      
      res.json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });
  
  logger.info('Monitoring setup completed');
}

// Graceful shutdown
export function gracefulShutdown() {
  logger.info('Shutting down monitoring...');
  performanceMonitor.stop();
}