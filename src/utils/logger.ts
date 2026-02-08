import { APP_CONFIG, LOG_CONFIG, LOG_LEVELS } from '../constants/config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    // Use configured log level from constants
    const configLevel = LOG_CONFIG.LEVEL as keyof typeof LOG_LEVELS;
    switch (configLevel) {
      case 'error':
        this.logLevel = LogLevel.ERROR;
        break;
      case 'warn':
        this.logLevel = LogLevel.WARN;
        break;
      case 'info':
        this.logLevel = LogLevel.INFO;
        break;
      case 'debug':
      default:
        this.logLevel = LogLevel.DEBUG;
        break;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return data ? `${prefix} ${message}` : `${prefix} ${message}`;
  }

  public error(message: string, error?: any): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message), error || '');
    }
  }

  public warn(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), data || '');
    }
  }

  public info(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message), data || '');
    }
  }

  public debug(message: string, data?: any): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message), data || '');
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

export const logger = Logger.getInstance();