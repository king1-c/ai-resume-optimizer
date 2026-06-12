import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { getClientIP } from './security';

// 用户/管理员活跃状态缓存（减少每请求的 DB 查询）
const activeStatusCache = new Map<string, { isActive: boolean; cachedAt: number }>();
const ACTIVE_CACHE_TTL = 60_000; // 60秒

function getCachedActiveStatus(key: string): boolean | null {
  const entry = activeStatusCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ACTIVE_CACHE_TTL) {
    activeStatusCache.delete(key);
    return null;
  }
  return entry.isActive;
}

function setCachedActiveStatus(key: string, isActive: boolean): void {
  if (activeStatusCache.size > 10_000) {
    const firstKey = activeStatusCache.keys().next().value;
    if (firstKey) activeStatusCache.delete(firstKey);
  }
  activeStatusCache.set(key, { isActive, cachedAt: Date.now() });
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * JWT 认证中间件
 * 验证请求中的访问令牌
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 从 Authorization header 获取 token
    const authHeader = req.headers.authorization;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: '未提供认证令牌',
        code: 'MISSING_TOKEN',
      });
      return;
    }

    // 验证令牌
    const payload = verifyAccessToken(token);

    // 检查用户是否仍然存在且活跃（优先使用缓存）
    if (payload.role === 'user') {
      const cacheKey = `user:${payload.userId}`;
      let isActive = getCachedActiveStatus(cacheKey);
      
      if (isActive === null) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { isActive: true },
        });

        if (!user) {
          res.status(401).json({
            success: false,
            error: '用户不存在',
            code: 'USER_NOT_FOUND',
          });
          return;
        }
        isActive = user.isActive;
        setCachedActiveStatus(cacheKey, isActive);
      }

      if (!isActive) {
        res.status(403).json({
          success: false,
          error: '账户已被禁用',
          code: 'ACCOUNT_DISABLED',
        });
        return;
      }
    } else if (payload.role === 'admin') {
      const cacheKey = `admin:${payload.userId}`;
      let isActive = getCachedActiveStatus(cacheKey);
      
      if (isActive === null) {
        const admin = await prisma.admin.findUnique({
          where: { id: payload.userId },
          select: { isActive: true },
        });

        if (!admin) {
          res.status(401).json({
            success: false,
            error: '管理员不存在',
            code: 'ADMIN_NOT_FOUND',
          });
          return;
        }
        isActive = admin.isActive;
        setCachedActiveStatus(cacheKey, isActive);
      }

      if (!isActive) {
        res.status(403).json({
          success: false,
          error: '管理员账户已被禁用',
          code: 'ADMIN_DISABLED',
        });
        return;
      }
    }

    // 将用户信息附加到请求对象
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          success: false,
          error: '令牌已过期',
          code: 'TOKEN_EXPIRED',
        });
        return;
      }
      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({
          success: false,
          error: '令牌无效',
          code: 'INVALID_TOKEN',
        });
        return;
      }
    }

    logger.error('认证中间件错误:', error);
    res.status(500).json({
      success: false,
      error: '认证失败',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * 可选认证中间件
 * 验证令牌但不强制要求，用于需要识别用户但允许匿名访问的端点
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    // 验证失败也继续，只是没有用户信息
    next();
  }
}

/**
 * 管理员权限检查中间件
 * 确保用户是管理员
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: '未认证',
      code: 'UNAUTHENTICATED',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    // 记录未授权访问尝试
    logger.warn('未授权的管理员访问尝试', {
      userId: req.user.userId,
      username: req.user.username,
      ip: getClientIP(req),
      path: req.path,
    });

    res.status(403).json({
      success: false,
      error: '需要管理员权限',
      code: 'ADMIN_REQUIRED',
    });
    return;
  }

  next();
}

/**
 * 超级管理员权限检查中间件
 * 确保用户是超级管理员
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: '需要超级管理员权限',
      code: 'SUPER_ADMIN_REQUIRED',
    });
    return;
  }

  // 查询管理员角色
  const admin = await prisma.admin.findUnique({
    where: { id: req.user.userId },
    select: { role: true },
  });

  if (!admin || admin.role !== 'SUPER_ADMIN') {
    logger.warn('未授权的超级管理员访问尝试', {
      userId: req.user.userId,
      username: req.user.username,
      ip: getClientIP(req),
      path: req.path,
    });

    res.status(403).json({
      success: false,
      error: '需要超级管理员权限',
      code: 'SUPER_ADMIN_REQUIRED',
    });
    return;
  }

  next();
}

/**
 * 用户所有权检查中间件
 * 确保用户只能访问自己的资源（管理员除外）
 */
export function requireOwnership(
  paramName: string = 'userId'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: '未认证',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    // 管理员可以访问所有资源
    if (req.user.role === 'admin') {
      next();
      return;
    }

    const resourceUserId = parseInt(req.params[paramName], 10);

    if (isNaN(resourceUserId)) {
      res.status(400).json({
        success: false,
        error: '无效的用户ID',
        code: 'INVALID_USER_ID',
      });
      return;
    }

    if (req.user.userId !== resourceUserId) {
      logger.warn('未授权的资源访问尝试', {
        userId: req.user.userId,
        targetUserId: resourceUserId,
        ip: getClientIP(req),
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: '无权访问此资源',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
