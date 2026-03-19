/**
 * Simple structured logger utility
 * Can be upgraded to Winston/Pino for production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

class Logger {
  private level: LogLevel;
  private prefix: string;
  private levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    this.prefix = options.prefix || '';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    return `[${timestamp}] ${levelStr} ${prefix}${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({ level: this.level, prefix: childPrefix });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for creating custom loggers
export { Logger };
