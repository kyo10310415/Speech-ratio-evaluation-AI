import winston from 'winston';
import { config } from '../config/env.js';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${typeof message === 'string' ? message : 'Log event details omitted'}`;
  })
);

const internalLogger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (err) {
  // Directory already exists
}

// Drop SDK exceptions and arbitrary metadata before Winston can merge them into
// message/stack (including credentials in request config and response bodies).
// Callers must use fixed event text rather than interpolating exception details.
export function withPrivateErrors(target) {
  return Object.fromEntries(['error', 'warn', 'info', 'debug', 'verbose', 'silly'].map(level => [
    level,
    (message) => target[level](typeof message === 'string' ? message : 'Log event details omitted')
  ]));
}

export const logger = withPrivateErrors(internalLogger);
