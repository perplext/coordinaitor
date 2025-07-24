import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { 
  BasicTracerProvider, 
  ConsoleSpanExporter, 
  SimpleSpanProcessor,
  BatchSpanProcessor
} from '@opentelemetry/sdk-trace-base';
import { 
  PrometheusExporter 
} from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import winston from 'winston';

export interface TracingConfig {
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
    // Can be extended for Jaeger, Zipkin, etc.
  };
}

export class TracingService {
  private sdk?: NodeSDK;
  private logger: winston.Logger;
  private config: TracingConfig;

  constructor(config: TracingConfig) {
    this.config = config;
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
    try {
      // Create resource
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      });

      // Setup trace provider
      const traceProvider = new BasicTracerProvider({
        resource,
      });

      // Add exporters
      if (this.config.exporters?.console) {
        traceProvider.addSpanProcessor(
          new SimpleSpanProcessor(new ConsoleSpanExporter())
        );
      }

      // Setup metrics
      if (this.config.exporters?.prometheus) {
        const prometheusExporter = new PrometheusExporter({
          port: this.config.exporters.prometheus.port,
          endpoint: this.config.exporters.prometheus.endpoint,
        }, () => {
          this.logger.info(`Prometheus metrics server started on port ${this.config.exporters?.prometheus?.port}`);
        });

        const meterProvider = new MeterProvider({
          resource,
        });
        
        meterProvider.addMetricReader(prometheusExporter);
      }

      // Create SDK
      this.sdk = new NodeSDK({
        resource,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable fs instrumentation to reduce noise
            },
          }),
        ],
      });

      // Initialize the SDK
      this.sdk.start();
      this.logger.info('OpenTelemetry tracing initialized');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry:', error);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.info('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        this.logger.error('Error shutting down OpenTelemetry SDK:', error);
      }
    }
  }
}

// Helper function to initialize tracing early in the application
export function initializeTracing(config: TracingConfig): TracingService {
  return new TracingService(config);
}