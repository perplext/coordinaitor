import { Registry, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import * as os from 'os';

// Create a Registry
export const register = new Registry();

// Default metrics
register.setDefaultLabels({
  app: 'coordinaitor',
  env: process.env.NODE_ENV || 'development',
});

// HTTP metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestSize = new Summary({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

export const httpResponseSize = new Summary({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [register],
});

// Task metrics
export const taskTotal = new Counter({
  name: 'tasks_total',
  help: 'Total number of tasks created',
  labelNames: ['type', 'priority', 'status'],
  registers: [register],
});

export const taskDuration = new Histogram({
  name: 'task_duration_seconds',
  help: 'Duration of task execution in seconds',
  labelNames: ['type', 'agent', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600],
  registers: [register],
});

export const tasksInProgress = new Gauge({
  name: 'tasks_in_progress',
  help: 'Number of tasks currently in progress',
  labelNames: ['type', 'agent'],
  registers: [register],
});

export const taskQueueSize = new Gauge({
  name: 'task_queue_size',
  help: 'Number of tasks in queue',
  labelNames: ['priority'],
  registers: [register],
});

// Agent metrics
export const agentUtilization = new Gauge({
  name: 'agent_utilization_ratio',
  help: 'Agent utilization ratio (0-1)',
  labelNames: ['agent_id', 'provider'],
  registers: [register],
});

export const agentResponseTime = new Histogram({
  name: 'agent_response_time_seconds',
  help: 'Agent response time in seconds',
  labelNames: ['agent_id', 'provider', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

export const agentErrors = new Counter({
  name: 'agent_errors_total',
  help: 'Total number of agent errors',
  labelNames: ['agent_id', 'provider', 'error_type'],
  registers: [register],
});

export const agentTokenUsage = new Counter({
  name: 'agent_tokens_used_total',
  help: 'Total number of tokens used by agents',
  labelNames: ['agent_id', 'provider'],
  registers: [register],
});

// Database metrics
export const dbConnectionPool = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Database connection pool metrics',
  labelNames: ['state'], // active, idle, waiting
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// System metrics
export const systemMemoryUsage = new Gauge({
  name: 'system_memory_usage_bytes',
  help: 'System memory usage in bytes',
  labelNames: ['type'], // total, free, used
  registers: [register],
});

export const systemCpuUsage = new Gauge({
  name: 'system_cpu_usage_percent',
  help: 'System CPU usage percentage',
  labelNames: ['cpu'],
  registers: [register],
});

// Business metrics
export const userActivity = new Counter({
  name: 'user_activity_total',
  help: 'User activity events',
  labelNames: ['action', 'resource'],
  registers: [register],
});

export const apiUsage = new Counter({
  name: 'api_usage_total',
  help: 'API usage by endpoint and organization',
  labelNames: ['endpoint', 'organization_id', 'method'],
  registers: [register],
});

export const billingMetrics = new Gauge({
  name: 'billing_metrics',
  help: 'Billing and usage metrics',
  labelNames: ['organization_id', 'metric_type'], // tasks_used, agents_used, storage_used
  registers: [register],
});

// Middleware for HTTP metrics
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const route = req.route?.path || req.path || 'unknown';
  
  // Measure request size
  const requestSize = parseInt(req.get('content-length') || '0', 10);
  httpRequestSize.observe({ method: req.method, route }, requestSize);

  // Intercept response end
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode.toString();
    
    // Record metrics
    httpRequestDuration.observe({ method: req.method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method: req.method, route, status_code: statusCode });
    
    // Measure response size
    const responseSize = parseInt(res.get('content-length') || '0', 10);
    httpResponseSize.observe({ method: req.method, route }, responseSize);
    
    // Call original end
    return originalEnd.apply(res, args);
  };

  next();
}

// System metrics collector
export function collectSystemMetrics() {
  // Memory metrics
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  systemMemoryUsage.set({ type: 'total' }, totalMem);
  systemMemoryUsage.set({ type: 'free' }, freeMem);
  systemMemoryUsage.set({ type: 'used' }, usedMem);
  
  // CPU metrics
  const cpus = os.cpus();
  cpus.forEach((cpu, index) => {
    const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
    const usage = 100 - ~~(100 * cpu.times.idle / total);
    systemCpuUsage.set({ cpu: `cpu${index}` }, usage);
  });
}

// Performance monitoring class
export class PerformanceMonitor {
  private intervals: NodeJS.Timeout[] = [];

  start() {
    // Collect system metrics every 10 seconds
    const systemInterval = setInterval(() => {
      collectSystemMetrics();
    }, 10000);
    
    this.intervals.push(systemInterval);
    
    // Initial collection
    collectSystemMetrics();
  }

  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  // Helper methods for recording custom metrics
  recordTaskCreated(type: string, priority: string) {
    taskTotal.inc({ type, priority, status: 'created' });
  }

  recordTaskStarted(type: string, agent: string) {
    tasksInProgress.inc({ type, agent });
  }

  recordTaskCompleted(type: string, agent: string, duration: number, success: boolean) {
    tasksInProgress.dec({ type, agent });
    taskDuration.observe({ type, agent, status: success ? 'success' : 'failed' }, duration);
    taskTotal.inc({ type, priority: 'normal', status: success ? 'completed' : 'failed' });
  }

  recordAgentMetrics(agentId: string, provider: string, metrics: {
    utilization?: number;
    responseTime?: number;
    tokensUsed?: number;
    error?: string;
  }) {
    if (metrics.utilization !== undefined) {
      agentUtilization.set({ agent_id: agentId, provider }, metrics.utilization);
    }
    
    if (metrics.responseTime !== undefined) {
      agentResponseTime.observe({ agent_id: agentId, provider, operation: 'execute' }, metrics.responseTime);
    }
    
    if (metrics.tokensUsed !== undefined) {
      agentTokenUsage.inc({ agent_id: agentId, provider }, metrics.tokensUsed);
    }
    
    if (metrics.error) {
      agentErrors.inc({ agent_id: agentId, provider, error_type: metrics.error });
    }
  }

  recordDatabaseMetrics(operation: string, table: string, duration: number) {
    dbQueryDuration.observe({ operation, table }, duration);
  }

  recordUserActivity(userId: string, action: string, resource: string) {
    userActivity.inc({ action, resource });
  }

  recordApiUsage(endpoint: string, method: string, organizationId: string) {
    apiUsage.inc({ endpoint, method, organization_id: organizationId });
  }

  recordBillingMetric(organizationId: string, metricType: string, value: number) {
    billingMetrics.set({ organization_id: organizationId, metric_type: metricType }, value);
  }

  getMetrics() {
    return register.metrics();
  }

  getContentType() {
    return register.contentType;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();