import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from './env.js';

const { combine, timestamp, json, printf, colorize } = winston.format;

// 日志目录
const logDir = path.resolve(process.cwd(), env.LOG_DIR);

// 开发环境格式
const devFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

// 创建日志传输器
const transports: winston.transport[] = [
  // 控制台输出
  new winston.transports.Console({
    format: env.isDev
      ? combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), devFormat)
      : combine(timestamp(), json()),
  }),
];

// 生产环境添加文件日志
if (env.isProd) {
  // 错误日志
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(timestamp(), json()),
    })
  );

  // 所有日志
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: combine(timestamp(), json()),
    })
  );

  // 安全审计日志
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      format: combine(timestamp(), json()),
    })
  );
}

// 创建 logger 实例
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'ai-resume-optimizer' },
  transports,
  // 未捕获的异常处理
  exceptionHandlers: [
    new winston.transports.Console(),
    ...(env.isProd
      ? [
          new DailyRotateFile({
            filename: path.join(logDir, 'exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
          }),
        ]
      : []),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    ...(env.isProd
      ? [
          new DailyRotateFile({
            filename: path.join(logDir, 'rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
          }),
        ]
      : []),
  ],
});

// 安全审计日志专用方法
export const auditLogger = {
  login: (data: { ip: string; username: string; success: boolean; reason?: string }) => {
    logger.info('AUDIT_LOGIN', { type: 'audit', category: 'login', ...data });
  },
  register: (data: { ip: string; username: string; email?: string; success: boolean; reason?: string }) => {
    logger.info('AUDIT_REGISTER', { type: 'audit', category: 'register', ...data });
  },
  upload: (data: { ip: string; userId: number; filename: string; size: number }) => {
    logger.info('AUDIT_UPLOAD', { type: 'audit', category: 'upload', ...data });
  },
  ipBlocked: (data: { ip: string; reason: string; duration: number }) => {
    logger.warn('AUDIT_IP_BLOCKED', { type: 'audit', category: 'security', ...data });
  },
  adminAction: (data: { ip: string; adminId?: number; action: string; target?: string; details?: any }) => {
    logger.info('AUDIT_ADMIN', { type: 'audit', category: 'admin', ...data });
  },
};
