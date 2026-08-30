/**
 * Structured logger for RevenueRescue AI
 * Outputs JSON-structured logs for production observability
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  caseId?: string;
  simulationId?: string;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LEVEL];
}

function log(level: LogLevel, message: string, context?: Omit<LogEntry, 'timestamp' | 'level' | 'message'>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, context?: Omit<LogEntry, 'timestamp' | 'level' | 'message'>) =>
    log('debug', message, context),
  info: (message: string, context?: Omit<LogEntry, 'timestamp' | 'level' | 'message'>) =>
    log('info', message, context),
  warn: (message: string, context?: Omit<LogEntry, 'timestamp' | 'level' | 'message'>) =>
    log('warn', message, context),
  error: (message: string, context?: Omit<LogEntry, 'timestamp' | 'level' | 'message'>) =>
    log('error', message, context),

  // Convenience method to time an async operation
  async timed<T>(
    component: string,
    message: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      log('info', message, { component, durationMs: Date.now() - start, metadata: context });
      return result;
    } catch (err) {
      log('error', `${message} FAILED`, {
        component,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        metadata: context,
      });
      throw err;
    }
  },
};
