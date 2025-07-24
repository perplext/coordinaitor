/**
 * Frontend logging utility to replace console.log statements
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
  includeStackTrace: boolean;
}

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: process.env.NODE_ENV === 'development',
      enableRemote: process.env.NODE_ENV === 'production',
      bufferSize: 100,
      flushInterval: 30000, // 30 seconds
      includeStackTrace: false,
      ...config
    };

    this.sessionId = this.generateSessionId();
    
    if (this.config.enableRemote) {
      this.startFlushTimer();
    }

    // Handle page unload to flush remaining logs
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      sessionId: this.sessionId
    };

    if (context) {
      entry.context = context;
    }

    if (error) {
      entry.error = error;
    }

    // Add user ID if available (from auth context)
    const userId = this.getUserId();
    if (userId) {
      entry.userId = userId;
    }

    return entry;
  }

  private getUserId(): string | undefined {
    // Try to get user ID from localStorage or session storage
    if (typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          return user.id || user.username;
        }
      } catch {
        // Ignore parsing errors
      }
    }
    return undefined;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    const levelName = levelNames[entry.level];
    const timestamp = entry.timestamp.toISOString();
    
    const prefix = `[${timestamp}] ${levelName}:`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        if (entry.error) {
          console.error(message, entry.context || '', entry.error);
        } else {
          console.error(message, entry.context || '');
        }
        break;
      case LogLevel.WARN:
        console.warn(message, entry.context || '');
        break;
      case LogLevel.DEBUG:
        console.debug(message, entry.context || '');
        break;
      case LogLevel.TRACE:
        console.trace(message, entry.context || '');
        break;
      default:
        console.info(message, entry.context || '');
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (!this.config.enableRemote || this.buffer.length === 0 || !this.config.remoteEndpoint) {
      return;
    }

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs: logsToSend })
      });
    } catch (error) {
      // If remote logging fails, add logs back to buffer and log to console
      this.buffer.unshift(...logsToSend);
      if (this.config.enableConsole) {
        console.error('Failed to send logs to remote endpoint:', error);
      }
    }
  }

  public error(message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  public warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  public info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  public debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  public trace(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;

    const entry = this.createLogEntry(LogLevel.TRACE, message, context);
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  public setUserId(userId: string): void {
    // Store in session for future log entries
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('logger_user_id', userId);
    }
  }

  public clearUserId(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('logger_user_id');
    }
  }

  public async forceFlush(): Promise<void> {
    await this.flush();
  }

  public getBufferSize(): number {
    return this.buffer.length;
  }

  public clearBuffer(): void {
    this.buffer = [];
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

// Create singleton logger instance
const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsole: true,
  enableRemote: process.env.NODE_ENV === 'production',
  remoteEndpoint: '/api/logs'
});

export default logger;

// Convenience exports
export const error = logger.error.bind(logger);
export const warn = logger.warn.bind(logger);
export const info = logger.info.bind(logger);
export const debug = logger.debug.bind(logger);
export const trace = logger.trace.bind(logger);

// Performance logging utilities
export function measurePerformance<T>(
  operation: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = performance.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.then(
      (value) => {
        const duration = performance.now() - start;
        logger.debug(`Performance: ${operation} completed`, { duration: `${duration.toFixed(2)}ms` });
        return value;
      },
      (error) => {
        const duration = performance.now() - start;
        logger.error(`Performance: ${operation} failed`, { duration: `${duration.toFixed(2)}ms` }, error);
        throw error;
      }
    );
  } else {
    const duration = performance.now() - start;
    logger.debug(`Performance: ${operation} completed`, { duration: `${duration.toFixed(2)}ms` });
    return Promise.resolve(result);
  }
}

// Error boundary logging
export function logErrorBoundary(error: Error, errorInfo: { componentStack: string }): void {
  logger.error('React Error Boundary caught an error', {
    componentStack: errorInfo.componentStack,
    stack: error.stack
  }, error);
}

// API call logging
export function logApiCall(method: string, url: string, status?: number, duration?: number): void {
  const context: Record<string, any> = { method, url };
  
  if (status !== undefined) {
    context.status = status;
  }
  
  if (duration !== undefined) {
    context.duration = `${duration.toFixed(2)}ms`;
  }

  if (status && status >= 400) {
    logger.warn(`API call failed: ${method} ${url}`, context);
  } else {
    logger.debug(`API call: ${method} ${url}`, context);
  }
}

// User action logging
export function logUserAction(action: string, context?: Record<string, any>): void {
  logger.info(`User action: ${action}`, { type: 'user_action', ...context });
}

// Feature usage logging
export function logFeatureUsage(feature: string, context?: Record<string, any>): void {
  logger.info(`Feature used: ${feature}`, { type: 'feature_usage', ...context });
}