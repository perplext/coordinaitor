import { Router } from 'express';
import { asyncHandler } from '../middleware/error-recovery';
import { createLogger } from '../utils/logger';
import { performanceMonitor } from '../monitoring/performance';
import { z } from 'zod';

const router = Router();
const logger = createLogger({ module: 'error-routes' });

// Error report schema
const ErrorReportSchema = z.object({
  errorId: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  userAgent: z.string(),
  url: z.string().url(),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Frontend error tracking
router.post('/frontend', asyncHandler(async (req, res) => {
  const errorReport = ErrorReportSchema.parse(req.body);
  
  logger.error('Frontend error reported', {
    ...errorReport,
    ip: req.ip,
    user: req.user?.id,
  });

  // Track error metrics
  performanceMonitor.incrementCounter('frontend_errors_total', {
    url: new URL(errorReport.url).pathname,
    userAgent: errorReport.userAgent,
  });

  // Store error for analysis
  await storeErrorReport({
    ...errorReport,
    source: 'frontend',
    userId: req.user?.id || errorReport.userId,
    organizationId: req.organizationId,
  });

  res.status(201).json({
    message: 'Error report received',
    errorId: errorReport.errorId,
  });
}));

// Get error statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const { from, to, source } = req.query;
  
  const stats = await getErrorStatistics({
    from: from ? new Date(from as string) : new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: to ? new Date(to as string) : new Date(),
    source: source as string,
    organizationId: req.organizationId,
  });

  res.json(stats);
}));

// Get error details
router.get('/:errorId', asyncHandler(async (req, res) => {
  const error = await getErrorDetails(req.params.errorId, req.organizationId);
  
  if (!error) {
    return res.status(404).json({ error: 'Error report not found' });
  }

  res.json(error);
}));

// Get recovery status
router.get('/recovery/status', asyncHandler(async (req, res) => {
  const { errorRecovery } = require('../services/error-recovery');
  const status = errorRecovery.getStatus();
  
  res.json(status);
}));

// Trigger manual recovery
router.post('/recovery/trigger', asyncHandler(async (req, res) => {
  const { service, operation } = req.body;
  
  logger.info('Manual recovery triggered', {
    service,
    operation,
    userId: req.user?.id,
  });

  // Implement manual recovery logic
  const result = await triggerManualRecovery(service, operation);
  
  res.json({
    message: 'Recovery initiated',
    result,
  });
}));

// Helper functions
async function storeErrorReport(report: any) {
  // In a real implementation, this would store in a database
  logger.info('Storing error report', { errorId: report.errorId });
}

async function getErrorStatistics(filters: any) {
  // In a real implementation, this would query the database
  return {
    total: 150,
    bySource: {
      frontend: 80,
      backend: 70,
    },
    byType: {
      TypeError: 45,
      NetworkError: 30,
      ValidationError: 25,
      Other: 50,
    },
    byHour: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: Math.floor(Math.random() * 10),
    })),
    topPages: [
      { url: '/dashboard', count: 25 },
      { url: '/tasks', count: 20 },
      { url: '/agents', count: 15 },
    ],
    recoveryRate: 0.75,
  };
}

async function getErrorDetails(errorId: string, organizationId?: string) {
  // In a real implementation, this would query the database
  return {
    errorId,
    message: 'Sample error message',
    stack: 'Error stack trace...',
    timestamp: new Date().toISOString(),
    source: 'frontend',
    url: '/dashboard',
    userId: 'user123',
    metadata: {
      browser: 'Chrome',
      os: 'macOS',
    },
    recovery: {
      attempted: true,
      successful: true,
      strategy: 'retry',
    },
  };
}

async function triggerManualRecovery(service: string, operation: string) {
  // In a real implementation, this would trigger recovery procedures
  return {
    service,
    operation,
    status: 'initiated',
    estimatedTime: '30 seconds',
  };
}

export default router;