import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { performanceMonitor } from '../monitoring/performance';
import { errorRecovery } from './error-recovery';

const logger = createLogger({ module: 'health-monitor' });

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthStatus>;
  critical?: boolean;
  interval?: number;
  timeout?: number;
  retries?: number;
}

export interface HealthStatus {
  healthy: boolean;
  message?: string;
  latency?: number;
  details?: any;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthStatus & { lastCheck: Date }>;
  uptime: number;
  version: string;
  timestamp: Date;
}

export class HealthMonitor extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private checkResults: Map<string, HealthStatus & { lastCheck: Date }> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  constructor() {
    super();
    this.setupDefaultChecks();
  }

  private setupDefaultChecks() {
    // Database health check
    this.addCheck({
      name: 'database',
      critical: true,
      interval: 30000,
      timeout: 5000,
      check: async () => {
        const start = Date.now();
        try {
          // Check database connection
          await this.checkDatabase();
          const latency = Date.now() - start;
          
          return {
            healthy: true,
            latency,
            message: 'Database connection is healthy',
          };
        } catch (error) {
          return {
            healthy: false,
            message: `Database error: ${error.message}`,
            details: { error: error.message },
          };
        }
      },
    });

    // Redis health check
    this.addCheck({
      name: 'redis',
      critical: true,
      interval: 30000,
      timeout: 3000,
      check: async () => {
        const start = Date.now();
        try {
          await this.checkRedis();
          const latency = Date.now() - start;
          
          return {
            healthy: true,
            latency,
            message: 'Redis connection is healthy',
          };
        } catch (error) {
          return {
            healthy: false,
            message: `Redis error: ${error.message}`,
          };
        }
      },
    });

    // Memory health check
    this.addCheck({
      name: 'memory',
      interval: 60000,
      check: async () => {
        const usage = process.memoryUsage();
        const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
        
        if (heapUsedPercent > 90) {
          return {
            healthy: false,
            message: `High memory usage: ${heapUsedPercent.toFixed(2)}%`,
            details: usage,
          };
        }
        
        return {
          healthy: true,
          message: `Memory usage: ${heapUsedPercent.toFixed(2)}%`,
          details: usage,
        };
      },
    });

    // CPU health check
    this.addCheck({
      name: 'cpu',
      interval: 60000,
      check: async () => {
        const cpuUsage = process.cpuUsage();
        const totalCpu = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
        
        if (totalCpu > 80) {
          return {
            healthy: false,
            message: `High CPU usage: ${totalCpu.toFixed(2)}s`,
            details: cpuUsage,
          };
        }
        
        return {
          healthy: true,
          message: `CPU usage: ${totalCpu.toFixed(2)}s`,
          details: cpuUsage,
        };
      },
    });

    // Disk space check
    this.addCheck({
      name: 'disk',
      interval: 300000, // 5 minutes
      check: async () => {
        try {
          const diskSpace = await this.checkDiskSpace();
          
          if (diskSpace.availablePercent < 10) {
            return {
              healthy: false,
              message: `Low disk space: ${diskSpace.availablePercent.toFixed(2)}% available`,
              details: diskSpace,
            };
          }
          
          return {
            healthy: true,
            message: `Disk space: ${diskSpace.availablePercent.toFixed(2)}% available`,
            details: diskSpace,
          };
        } catch (error) {
          return {
            healthy: false,
            message: `Disk check error: ${error.message}`,
          };
        }
      },
    });

    // API response time check
    this.addCheck({
      name: 'api-latency',
      interval: 60000,
      check: async () => {
        const avgLatency = await this.getAverageApiLatency();
        
        if (avgLatency > 1000) {
          return {
            healthy: false,
            message: `High API latency: ${avgLatency.toFixed(2)}ms`,
            latency: avgLatency,
          };
        }
        
        return {
          healthy: true,
          message: `API latency: ${avgLatency.toFixed(2)}ms`,
          latency: avgLatency,
        };
      },
    });
  }

  addCheck(check: HealthCheck) {
    this.checks.set(check.name, check);
    
    // Start periodic check if interval is specified
    if (check.interval) {
      this.startPeriodicCheck(check);
    }
    
    logger.info('Added health check', { name: check.name });
  }

  private startPeriodicCheck(check: HealthCheck) {
    // Clear existing interval if any
    const existingInterval = this.checkIntervals.get(check.name);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Run check immediately
    this.runCheck(check);

    // Set up periodic check
    const interval = setInterval(() => {
      this.runCheck(check);
    }, check.interval!);

    this.checkIntervals.set(check.name, interval);
  }

  private async runCheck(check: HealthCheck) {
    try {
      const timeout = check.timeout || 10000;
      const result = await Promise.race([
        check.check(),
        new Promise<HealthStatus>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), timeout)
        ),
      ]);

      this.checkResults.set(check.name, {
        ...result,
        lastCheck: new Date(),
      });

      // Handle unhealthy critical services
      if (check.critical && !result.healthy) {
        this.handleUnhealthyService(check.name, result);
      }

      // Update system status
      this.updateSystemStatus();

      this.emit('check:complete', { name: check.name, result });
    } catch (error) {
      const errorResult: HealthStatus = {
        healthy: false,
        message: `Check failed: ${error.message}`,
      };

      this.checkResults.set(check.name, {
        ...errorResult,
        lastCheck: new Date(),
      });

      if (check.critical) {
        this.handleUnhealthyService(check.name, errorResult);
      }

      this.updateSystemStatus();
      this.emit('check:error', { name: check.name, error });
    }
  }

  private async handleUnhealthyService(name: string, status: HealthStatus) {
    logger.error('Critical service unhealthy', { name, status });

    // Attempt recovery
    try {
      await errorRecovery.handleError(
        new Error(status.message || 'Service unhealthy'),
        {
          service: 'health-monitor',
          operation: `health-check-${name}`,
          metadata: { checkName: name, status },
        }
      );

      // Re-run check after recovery attempt
      const check = this.checks.get(name);
      if (check) {
        await this.runCheck(check);
      }
    } catch (error) {
      logger.error('Recovery failed for unhealthy service', error, { name });
    }
  }

  private updateSystemStatus() {
    const results = Array.from(this.checkResults.values());
    const criticalChecks = Array.from(this.checks.entries())
      .filter(([_, check]) => check.critical)
      .map(([name]) => this.checkResults.get(name))
      .filter(Boolean);

    if (criticalChecks.some(check => !check?.healthy)) {
      this.systemStatus = 'unhealthy';
    } else if (results.some(check => !check.healthy)) {
      this.systemStatus = 'degraded';
    } else {
      this.systemStatus = 'healthy';
    }

    // Record metrics
    performanceMonitor.setGauge('system_health_status', 
      this.systemStatus === 'healthy' ? 1 : this.systemStatus === 'degraded' ? 0.5 : 0
    );

    this.emit('status:change', this.systemStatus);
  }

  async checkHealth(): Promise<SystemHealth> {
    // Run all checks concurrently
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      if (!check.interval) {
        // Run checks that don't have periodic intervals
        await this.runCheck(check);
      }
    });

    await Promise.allSettled(checkPromises);

    return {
      status: this.systemStatus,
      checks: Object.fromEntries(this.checkResults),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.0.0',
      timestamp: new Date(),
    };
  }

  getStatus(): SystemHealth {
    return {
      status: this.systemStatus,
      checks: Object.fromEntries(this.checkResults),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.0.0',
      timestamp: new Date(),
    };
  }

  stop() {
    // Clear all intervals
    this.checkIntervals.forEach(interval => clearInterval(interval));
    this.checkIntervals.clear();
    
    logger.info('Health monitor stopped');
  }

  // Implementation methods (would connect to actual services)
  private async checkDatabase(): Promise<void> {
    // Implementation would check actual database connection
    return Promise.resolve();
  }

  private async checkRedis(): Promise<void> {
    // Implementation would check actual Redis connection
    return Promise.resolve();
  }

  private async checkDiskSpace(): Promise<{ availablePercent: number; total: number; free: number }> {
    // Implementation would check actual disk space
    return {
      availablePercent: 75,
      total: 100 * 1024 * 1024 * 1024,
      free: 75 * 1024 * 1024 * 1024,
    };
  }

  private async getAverageApiLatency(): Promise<number> {
    // Implementation would get actual API latency metrics
    return 150;
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

// Express middleware for health checks
export function healthCheckMiddleware(app: any) {
  app.get('/health', async (req: any, res: any) => {
    const health = await healthMonitor.checkHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  });

  app.get('/health/live', (req: any, res: any) => {
    res.status(200).json({ status: 'alive' });
  });

  app.get('/health/ready', async (req: any, res: any) => {
    const health = healthMonitor.getStatus();
    const isReady = health.status !== 'unhealthy';
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      status: health.status,
      checks: Object.entries(health.checks).map(([name, result]) => ({
        name,
        healthy: result.healthy,
        message: result.message,
      })),
    });
  });
}