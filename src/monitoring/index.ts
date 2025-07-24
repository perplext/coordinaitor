export { MonitoringService, MonitoringConfig, HealthStatus } from './monitoring-service';
export { MetricsCollector } from './metrics-collector';
export { TracingService, TracingConfig, initializeTracing } from './tracing';

// Re-export commonly used types and utilities
export interface MonitoringOptions {
  monitoring?: {
    enabled: boolean;
    metricsPort?: number;
    metricsPath?: string;
    collectInterval?: number;
    retentionPeriod?: number;
  };
  tracing?: {
    enabled: boolean;
    serviceName: string;
    serviceVersion: string;
    environment: string;
    exporters?: {
      console?: boolean;
      prometheus?: {
        port: number;
        endpoint?: string;
      };
    };
  };
}