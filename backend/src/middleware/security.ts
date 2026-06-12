/**
 * 安全中间件
 * 包含: Helmet 安全头、CORS、IP 封禁检查、速率限制
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { env } from '@/config/env.js';
import { ipBlocker } from '@/utils/ipBlocker.js';
import { logger } from '@/config/logger.js';

/**
 * 获取客户端真实 IP
 * 优先从可信代理头获取（需配合 trust proxy 使用）
 */
export function getClientIP(req: Request): string {
  // 仅在 trust proxy 启用时使用 X-Forwarded-For
  // express 的 req.ip 已内置处理 trust proxy 逻辑
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  // 规范化 IPv6-mapped IPv4 地址
  return ip.replace(/^::ffff:/, '');
}

/**
 * Helmet 安全头配置
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "blob:"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: env.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
});

/**
 * CORS 配置
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // 无 origin 的请求（如 curl、服务器间调用）允许
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = env.isDev
      ? ['http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://localhost:5173', 'http://localhost:5174']
      : (process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || []);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('来源不允许'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 小时
});

// IP 封禁数据库查询缓存（TTL 30秒）
const blockedIPCache = new Map<string, { blocked: boolean; expiresAt: Date | null; cachedAt: number }>();
const BLOCKED_IP_CACHE_TTL = 30_000;

/**
 * IP 封禁检查中间件
 * 同时检查内存中的自动封禁和数据库中的持久化封禁（带缓存）
 */
export async function ipBlockMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = getClientIP(req);
  
  // 跳过健康检查端点
  if (req.path === '/health') {
    next();
    return;
  }

  // 1. 检查内存中的自动封禁（基于失败次数）
  const blockStatus = ipBlocker.isBlocked(ip);
  
  if (blockStatus.blocked) {
    logger.warn(`被封禁的 IP 尝试访问（内存）: ${ip}, 路径: ${req.path}`);
    res.status(403).json({
      error: '访问被拒绝',
      message: `您的 IP 已被临时封禁，请 ${blockStatus.remainingTime} 秒后再试`,
      remainingTime: blockStatus.remainingTime,
    });
    return;
  }

  // 2. 检查数据库中的持久化封禁（带缓存）
  const now = Date.now();
  const cached = blockedIPCache.get(ip);
  if (cached && (now - cached.cachedAt) < BLOCKED_IP_CACHE_TTL) {
    if (cached.blocked) {
      if (cached.expiresAt && cached.expiresAt.getTime() > now) {
        const remainingSec = Math.ceil((cached.expiresAt.getTime() - now) / 1000);
        logger.warn(`被封禁的 IP 尝试访问（缓存命中）: ${ip}, 路径: ${req.path}`);
        res.status(403).json({
          error: '访问被拒绝',
          message: `您的 IP 已被封禁，请 ${remainingSec} 秒后再试`,
          remainingTime: remainingSec,
        });
        return;
      } else if (!cached.expiresAt) {
        logger.warn(`被永久封禁的 IP 尝试访问（缓存命中）: ${ip}, 路径: ${req.path}`);
        res.status(403).json({ error: '访问被拒绝', message: '您的 IP 已被永久封禁' });
        return;
      }
    }
    // 未封禁且在缓存中，直接放行
    next();
    return;
  }

  try {
    const { prisma } = await import('../config/database.js');
    const blockedIP = await prisma.blockedIP.findUnique({
      where: { ipAddress: ip },
    });

    if (blockedIP) {
      // 更新缓存
      blockedIPCache.set(ip, {
        blocked: true,
        expiresAt: blockedIP.expiresAt,
        cachedAt: now,
      });

      // 检查是否过期
      if (blockedIP.expiresAt && blockedIP.expiresAt > new Date()) {
        const remainingMs = blockedIP.expiresAt.getTime() - Date.now();
        const remainingSec = Math.ceil(remainingMs / 1000);
        logger.warn(`被封禁的 IP 尝试访问（数据库）: ${ip}, 路径: ${req.path}`);
        res.status(403).json({
          error: '访问被拒绝',
          message: `您的 IP 已被封禁，原因: ${blockedIP.reason}，请 ${remainingSec} 秒后再试`,
          remainingTime: remainingSec,
        });
        return;
      } else if (!blockedIP.expiresAt) {
        // 永久封禁
        logger.warn(`被永久封禁的 IP 尝试访问: ${ip}, 路径: ${req.path}`);
        res.status(403).json({
          error: '访问被拒绝',
          message: `您的 IP 已被永久封禁，原因: ${blockedIP.reason}`,
        });
        return;
      }
    } else {
      // 未封禁，缓存结果
      blockedIPCache.set(ip, { blocked: false, expiresAt: null, cachedAt: now });
    }
  } catch (error) {
    // 数据库连接失败时记录日志但不阻止请求
    logger.error('检查数据库封禁状态失败:', error);
  }
  
  next();
}

/**
 * 通用速率限制
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIP(req),
  handler: (req: Request, res: Response) => {
    const ip = getClientIP(req);
    logger.warn(`IP 触发速率限制: ${ip}`);
    res.status(429).json({
      error: '请求过于频繁',
      message: '请稍后再试',
    });
  },
  skip: (req: Request) => {
    // 跳过健康检查端点
    if (req.path === '/health' || req.path.startsWith('/health/')) return true;
    // 开发环境跳过本地请求
    if (env.isDev) {
      const ip = getClientIP(req);
      if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    }
    return false;
  },
});

/**
 * 登录接口严格速率限制
 */
export const loginRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getClientIP(req),
  handler: (req: Request, res: Response) => {
    const ip = getClientIP(req);
    logger.warn(`IP 触发登录速率限制: ${ip}`);
    
    // 记录到 IP 封禁器
    ipBlocker.recordFailure(ip, '登录请求过于频繁');
    
    res.status(429).json({
      error: '登录尝试次数过多',
      message: '请 15 分钟后再试，或联系管理员',
    });
  },
  skipSuccessfulRequests: true, // 成功登录不计数
  skip: (req: Request) => {
    // 开发环境跳过本地请求
    if (env.isDev) {
      const ip = getClientIP(req);
      if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    }
    return false;
  },
});

/**
 * 请求超时中间件（防 Slowloris/慢速攻击，30秒）
 */
export function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  const TIMEOUT_MS = 30_000;

  req.socket.setTimeout(TIMEOUT_MS);
  res.setTimeout(TIMEOUT_MS);

  const onTimeout = () => {
    if (!res.headersSent) {
      logger.warn(`请求超时: ${req.method} ${req.path} - IP: ${getClientIP(req)}`);
      res.status(408).json({
        error: '请求超时',
        message: '服务器等待请求超时，请重试',
      });
    }
  };

  req.socket.on('timeout', onTimeout);
  res.on('timeout', onTimeout);

  res.on('finish', () => {
    req.socket.removeListener('timeout', onTimeout);
    res.removeListener('timeout', onTimeout);
  });

  next();
}

/**
 * 用户名级别登录速率限制（防用户枚举 + 暴力破解）
 */
export const usernameRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const username = req.body?.username || 'unknown';
    return `login-user:${username}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(`用户名触发登录速率限制: ${req.body?.username}`);
    res.status(429).json({
      error: '登录尝试次数过多',
      message: '该账户登录尝试过于频繁，请15分钟后再试',
    });
  },
  skipSuccessfulRequests: true,
  skip: (req: Request) => {
    // 开发环境跳过本地请求
    if (env.isDev) {
      const ip = getClientIP(req);
      if (ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    }
    return false;
  },
});

/**
 * 安全审计中间件
 * 记录所有请求的 IP、路径、方法
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIP(req);
  const startTime = Date.now();
  
  // 记录敏感操作
  const sensitivePaths = ['/api/auth/login', '/api/auth/register', '/api/upload', '/api/admin'];
  const isSensitive = sensitivePaths.some(path => req.path.startsWith(path));
  
  if (isSensitive) {
    logger.info(`[AUDIT] ${req.method} ${req.path} - IP: ${ip}`);
  }
  
  // 响应完成后记录
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400 || isSensitive) {
      logger.info(`[REQUEST] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - IP: ${ip}`);
    }
  });
  
  next();
}

/**
 * 错误处理中间件
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const ip = getClientIP(req);
  
  logger.error(`[ERROR] ${req.method} ${req.path} - IP: ${ip}`, {
    error: err.message,
    stack: err.stack,
  });
  
  // 生产环境不暴露详细错误
  // 开发环境仅在 DEBUG_KEY 非空且请求头匹配时返回堆栈
  if (env.isProd) {
    res.status(500).json({
      error: '服务器内部错误',
      message: '请稍后再试或联系管理员',
    });
  } else {
    const DEBUG_KEY = env.DEBUG_KEY;
    const debug = DEBUG_KEY && req.headers['x-debug'] === DEBUG_KEY;
    res.status(500).json({
      error: '服务器内部错误',
      message: err.message,
      ...(debug && { stack: err.stack }),
    });
  }
}

/**
 * CSRF 保护中间件
 * 对于所有 state-changing 方法（POST/PUT/PATCH/DELETE），
 * 要求请求必须携带自定义头 X-Requested-With（浏览器同源策略下无法跨域设置此头）
 * GET/OPTIONS/HEAD 等安全方法不拦截
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }

  // 服务器间调用放行（无 origin）
  if (!req.headers.origin) {
    next();
    return;
  }

  // 非浏览器客户端放行（如 curl）
  const userAgent = req.headers['user-agent'] || '';
  if (!userAgent.toLowerCase().includes('mozilla')) {
    next();
    return;
  }

  // 检查自定义头（浏览器无法通过纯表单/链接跨域携带此头）
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    next();
    return;
  }

  const ip = getClientIP(req);
  logger.warn(`[CSRF] 缺少 X-Requested-With 头: ${req.method} ${req.path} - IP: ${ip}`);
  res.status(403).json({
    error: '请求被拒绝',
    message: '缺少必要的请求头 (CSRF 防护)',
  });
}

/**
 * 404 处理中间件
 */
export function notFoundHandler(req: Request, res: Response): void {
  const ip = getClientIP(req);
  logger.warn(`[404] ${req.method} ${req.path} - IP: ${ip}`);
  
  res.status(404).json({
    error: '接口不存在',
    message: `路径 ${req.path} 不存在`,
  });
}
