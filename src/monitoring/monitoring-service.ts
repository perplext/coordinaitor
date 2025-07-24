import { EventEmitter } from 'events';
import winston from 'winston';
import { MetricsCollector } from './metrics-collector';
import { Task, TaskStatus } from '../interfaces/task.interface';
import { Agent } from '../interfaces/agent.interface';
import express from 'express';
import { createServer } from 'http';

export interface MonitoringConfig {
  enabled: boolean;
  metricsPort?: number;
  metricsPath?: string;
  collectInterval?: number; // milliseconds
  retentionPeriod?: number; // milliseconds
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  components: {
    [key: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      lastCheck: Date;
    };
  };
  metrics?: {
    uptime: number;
    totalTasks: number;
    activeTasks: number;
    successRate: number;
    averageResponseTime: number;
  };
}

export class MonitoringService extends EventEmitter {
  private logger: winston.Logger;
  private metricsCollector: MetricsCollector;
  private config: MonitoringConfig;
  private metricsApp?: express.Application;
  private metricsServer?: any;
  private startTime: Date;
  private taskMetrics: Map<string, { startTime: number; status?: TaskStatus }>;
  private healthChecks: Map<string, () => Promise<boolean>>;
  private collectIntervalId?: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.metricsCollector = new MetricsCollector();
    this.startTime = new Date();
    this.taskMetrics = new Map();
    this.healthChecks = new Map();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    // Start metrics server
    if (this.config.metricsPort) {
      this.startMetricsServer();
    }

    // Start collection interval
    if (this.config.collectInterval) {
      this.startCollectionInterval();
    }

    this.logger.info('Monitoring service initialized');
  }

  private startMetricsServer(): void {
    this.metricsApp = express();
    
    // Metrics endpoint
    this.metricsApp.get(this.config.metricsPath || '/metrics', async (req, res) => {
      try {
        const metrics = await this.metricsCollector.getMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        this.logger.error('Error generating metrics:', error);
        res.status(500).send('Error generating metrics');
      }
    });

    // Health check endpoint
    this.metricsApp.get('/health', async (req, res) => {
      const health = await this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 503 : 500;
      res.status(statusCode).json(health);
    });

    // Readiness check endpoint
    this.metricsApp.get('/ready', (req, res) => {
      const isReady = this.healthChecks.size > 0;
      res.status(isReady ? 200 : 503).json({ ready: isReady });
    });

    this.metricsServer = createServer(this.metricsApp);
    this.metricsServer.listen(this.config.metricsPort, () => {
      this.logger.info(`Metrics server listening on port ${this.config.metricsPort}`);
    });
  }

  private startCollectionInterval(): void {
    this.collectIntervalId = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.collectInterval);
  }

  private collectSystemMetrics(): void {
    // Collect queue sizes
    const queueSizes = new Map<string, number>();
    const priorities = ['low', 'medium', 'high', 'critical'];
    const statuses = ['pending', 'running', 'completed', 'failed'];
    
    priorities.forEach(priority => {
      statuses.forEach(status => {
        const count = Array.from(this.taskMetrics.values())
          .filter(m => m.status === status).length;
        queueSizes.set(`${priority}:${status}`, count);
      });
    });
    
    this.metricsCollector.updateTaskQueueSize(queueSizes);
  }

  // Task monitoring methods
  public recordTaskStart(task: Task): void {
    if (!this.config.enabled) return;
    
    this.taskMetrics.set(task.id, { 
      startTime: Date.now(),
      status: task.status 
    });
    this.metricsCollector.recordTaskCreated(task);
  }

  public recordTaskComplete(task: Task): void {
    if (!this.config.enabled) return;
    
    const metrics = this.taskMetrics.get(task.id);
    if (metrics) {
      const duration = Date.now() - metrics.startTime;
      this.metricsCollector.recordTaskCompleted(task, duration);
      this.taskMetrics.delete(task.id);
    }
  }

  public recordTaskError(task: Task, error: Error): void {
    if (!this.config.enabled) return;
    
    const errorType = error.name || 'UnknownError';
    this.metricsCollector.recordTaskError(task, errorType);
    this.taskMetrics.delete(task.id);
  }

  // Agent monitoring methods
  public recordAgentMetrics(agent: Agent, metrics: {
    utilization?: number;
    responseTime?: number;
    taskType?: string;
    error?: Error;
  }): void {
    if (!this.config.enabled) return;

    if (metrics.utilization !== undefined) {
      this.metricsCollector.updateAgentUtilization(agent, metrics.utilization);
    }

    if (metrics.responseTime !== undefined && metrics.taskType) {
      this.metricsCollector.recordAgentResponse(agent, metrics.taskType, metrics.responseTime);
    }

    if (metrics.error) {
      this.metricsCollector.recordAgentError(agent, metrics.error.name || 'UnknownError');
    }
  }

  public updateAgentConnections(connections: Map<string, number>): void {
    if (!this.config.enabled) return;
    this.metricsCollector.updateAgentConnections(connections);
  }

  // API monitoring methods
  public recordApiRequest(req: express.Request, res: express.Response, duration: number): void {
    if (!this.config.enabled) return;
    
    const route = req.route?.path || req.path;
    this.metricsCollector.recordApiRequest(req.method, route, res.statusCode, duration);
  }

  public recordApiError(req: express.Request, error: Error): void {
    if (!this.config.enabled) return;
    
    const route = req.route?.path || req.path;
    this.metricsCollector.recordApiError(req.method, route, error.name || 'UnknownError');
  }

  public updateWebsocketConnections(count: number): void {
    if (!this.config.enabled) return;
    this.metricsCollector.updateWebsocketConnections(count);
  }

  // Workflow monitoring methods
  public recordWorkflowExecution(workflowId: string, status: 'started' | 'completed' | 'failed'): void {
    if (!this.config.enabled) return;
    this.metricsCollector.recordWorkflowExecution(workflowId, status);
  }

  public recordWorkflowDuration(workflowId: string, status: string, duration: number): void {
    if (!this.config.enabled) return;
    this.metricsCollector.recordWorkflowDuration(workflowId, status, duration);
  }

  public recordWorkflowStepDuration(workflowId: string, stepType: string, status: string, duration: number): void {
    if (!this.config.enabled) return;
    this.metricsCollector.recordWorkflowStepDuration(workflowId, stepType, status, duration);
  }

  // Knowledge monitoring methods
  public recordKnowledgeQuery(queryType: string, success: boolean, duration?: number, resultCount?: number): void {
    if (!this.config.enabled) return;
    
    this.metricsCollector.recordKnowledgeQuery(queryType, success);
    
    if (duration !== undefined && resultCount !== undefined) {
      this.metricsCollector.recordKnowledgeRetrievalTime(queryType, resultCount, duration);
    }
  }

  public updateKnowledgeEntries(entryCounts: Map<string, number>): void {
    if (!this.config.enabled) return;
    this.metricsCollector.updateKnowledgeEntries(entryCounts);
  }

  // Health check methods
  public registerHealthCheck(name: string, check: () => Promise<boolean>): void {
    this.healthChecks.set(name, check);
  }

  public async getHealthStatus(): Promise<HealthStatus> {
    const components: HealthStatus['components'] = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    // Check each component
    for (const [name, check] of this.healthChecks) {
      try {
        const isHealthy = await check();
        components[name] = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          lastCheck: new Date()
        };
        
        if (!isHealthy && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        components[name] = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          lastCheck: new Date()
        };
        overallStatus = 'unhealthy';
      }
    }

    // Calculate metrics
    const uptime = Date.now() - this.startTime.getTime();
    const taskMetricsArray = Array.from(this.taskMetrics.values());
    const completedTasks = taskMetricsArray.filter(m => m.status === 'completed').length;
    const totalTasks = taskMetricsArray.length;
    const activeTasks = taskMetricsArray.filter(m => m.status === 'running').length;

    return {
      status: overallStatus,
      timestamp: new Date(),
      components,
      metrics: {
        uptime,
        totalTasks,
        activeTasks,
        successRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        averageResponseTime: 0 // Would need to calculate from stored metrics
      }
    };
  }

  // Cleanup
  public async shutdown(): Promise<void> {
    if (this.collectIntervalId) {
      clearInterval(this.collectIntervalId);
    }

    if (this.metricsServer) {
      return new Promise((resolve) => {
        this.metricsServer.close(() => {
          this.logger.info('Metrics server shut down');
          resolve();
        });
      });
    }
  }
}