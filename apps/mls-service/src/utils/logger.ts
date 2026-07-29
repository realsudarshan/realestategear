import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ' ' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat
  }),

  // Daily rotating file for all logs
  new DailyRotateFile({
    filename: path.join(logDir, 'mls-service-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format: logFormat,
    level: 'info'
  }),

  // Daily rotating file for errors only
  new DailyRotateFile({
    filename: path.join(logDir, 'mls-service-error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format: logFormat,
    level: 'error'
  })
];

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

export default logger;
