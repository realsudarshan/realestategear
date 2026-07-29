type LogMeta = Record<string, unknown>;

const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
} as const;

type LogLevel = keyof typeof levels;

function getLogLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured === 'debug' || configured === 'info' || configured === 'warn' || configured === 'error' || configured === 'silent') {
    return configured;
  }
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

function shouldLog(level: Exclude<LogLevel, 'silent'>) {
  return levels[level] >= levels[getLogLevel()];
}

const logger = {
  info: (message: string, meta: LogMeta = {}) => {
    if (shouldLog('info')) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta);
    }
  },

  warn: (message: string, meta: LogMeta = {}) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta);
    }
  },

  error: (message: string, meta: LogMeta = {}) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta);
    }
  },

  debug: (message: string, meta: LogMeta = {}) => {
    if (shouldLog('debug')) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta);
    }
  }
};

export default logger;
