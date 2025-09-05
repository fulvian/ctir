import fs from 'fs';

// Tipo per i livelli di log
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private logLevel: number;
  private logFilePath: string | null = null;

  constructor() {
    const level = process.env.LOG_LEVEL as LogLevel | undefined;
    this.logLevel = LOG_LEVELS[level || 'info'];

    // Opzionale: se si vuole loggare anche su file
    if (process.env.LOG_FILE) {
      this.logFilePath = process.env.LOG_FILE;
    }
  }

  private log(level: LogLevel, message: string, context: Record<string, any> = {}): void {
    if (LOG_LEVELS[level] < this.logLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    const logString = JSON.stringify(logEntry);

    // Scrive su console
    if (level === 'error') {
      console.error(logString);
    } else if (level === 'warn') {
      console.warn(logString);
    } else {
      console.log(logString);
    }

    // Scrive su file se configurato
    if (this.logFilePath) {
      fs.appendFile(this.logFilePath, logString + '\n', (err) => {
        if (err) {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(), 
            level: 'error', 
            message: 'Failed to write to log file',
            error: err.message 
          }));
        }
      });
    }
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  public error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }
}

// Esporta un'istanza globale singleton
export const logger = new Logger();