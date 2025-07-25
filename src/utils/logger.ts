import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray',
};

winston.addColors(colors);

// Create format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }),
);

// Define transports
const transports: winston.transport[] = [];

// Console transport
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
  transports.push(
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
    })
  );
}

// File transports with rotation
if (process.env.LOG_DIR) {
  // Error log
  transports.push(
    new DailyRotateFile({
      filename: path.join(process.env.LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format,
    })
  );

  // Combined log
  transports.push(
    new DailyRotateFile({
      filename: path.join(process.env.LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format,
    })
  );

  // HTTP log
  transports.push(
    new DailyRotateFile({
      filename: path.join(process.env.LOG_DIR, 'http-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '7d',
      level: 'http',
      format,
    })
  );
}

// Elasticsearch transport for production
if (process.env.ELASTICSEARCH_HOST && process.env.NODE_ENV === 'production') {
  transports.push(
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_HOST,
      },
      index: 'orchestrator-logs',
      format,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create stream for Morgan HTTP logger
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Context-aware logging
export class ContextLogger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  private log(level: string, message: string, metadata?: Record<string, any>) {
    logger.log(level, message, { ...this.context, ...metadata });
  }

  error(message: string, error?: Error | any, metadata?: Record<string, any>) {
    const errorData = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : error ? { error } : {};
    
    this.log('error', message, { ...errorData, ...metadata });
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log('warn', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log('info', message, metadata);
  }

  http(message: string, metadata?: Record<string, any>) {
    this.log('http', message, metadata);
  }

  verbose(message: string, metadata?: Record<string, any>) {
    this.log('verbose', message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.log('debug', message, metadata);
  }

  silly(message: string, metadata?: Record<string, any>) {
    this.log('silly', message, metadata);
  }

  // Create child logger with additional context
  child(additionalContext: Record<string, any>): ContextLogger {
    return new ContextLogger({ ...this.context, ...additionalContext });
  }
}

// Performance logging utilities
export function logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
  logger.info(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata,
  });
}

export function logApiCall(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  userId?: string,
  organizationId?: string
) {
  logger.http('API Call', {
    method,
    url,
    statusCode,
    duration: `${duration}ms`,
    userId,
    organizationId,
  });
}

export function logDatabaseQuery(
  operation: string,
  table: string,
  duration: number,
  rowCount?: number
) {
  logger.debug('Database Query', {
    operation,
    table,
    duration: `${duration}ms`,
    rowCount,
  });
}

export function logAgentExecution(
  agentId: string,
  taskId: string,
  duration: number,
  success: boolean,
  metadata?: Record<string, any>
) {
  const level = success ? 'info' : 'error';
  logger.log(level, 'Agent Execution', {
    agentId,
    taskId,
    duration: `${duration}ms`,
    success,
    ...metadata,
  });
}

export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  userId?: string,
  metadata?: Record<string, any>
) {
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  logger.log(level, `Security Event: ${event}`, {
    severity,
    userId,
    ...metadata,
  });
}

export function logBusinessEvent(
  event: string,
  organizationId: string,
  userId: string,
  metadata?: Record<string, any>
) {
  logger.info(`Business Event: ${event}`, {
    organizationId,
    userId,
    ...metadata,
  });
}

// Error logging with context
export function logError(error: Error, context?: Record<string, any>) {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

// Audit logging
export function logAudit(
  action: string,
  resource: string,
  userId: string,
  organizationId: string,
  metadata?: Record<string, any>
) {
  logger.info('Audit Log', {
    action,
    resource,
    userId,
    organizationId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

// Export default logger and factory function
export default logger;

export function createLogger(context: Record<string, any> = {}): ContextLogger {
  return new ContextLogger(context);
}