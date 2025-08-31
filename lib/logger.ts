import pino from 'pino';

// Logger configuration
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});

// Export logger instance
export default logger;

// Helper functions for different log levels
export const log = {
  info: (message: string, obj?: any) => logger.info(obj || {}, message),
  warn: (message: string, obj?: any) => logger.warn(obj || {}, message),
  error: (message: string, obj?: any) => logger.error(obj || {}, message),
  debug: (message: string, obj?: any) => logger.debug(obj || {}, message),
  fatal: (message: string, obj?: any) => logger.fatal(obj || {}, message),
};

// Request logging middleware helper
export function logRequest(req: any, res: any, next?: any) {
  logger.info({
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
      remotePort: req.socket?.remotePort,
    },
  }, 'Incoming request');

  if (next) next();
}

// Audit logging helper
export function logAudit(
  tenantId: string,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId?: string,
  ip?: string,
  userAgent?: string,
  payload?: any
) {
  logger.info({
    tenantId,
    actorUserId,
    action,
    targetType,
    targetId,
    ip,
    userAgent,
    payload,
  }, 'Audit event');
}

