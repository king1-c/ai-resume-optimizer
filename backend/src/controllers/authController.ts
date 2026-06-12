import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { logger, auditLogger } from '@/config/logger';
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/utils/password';
import { generateTokenPair, verifyRefreshToken } from '@/utils/jwt';
import { getClientIP } from '@/middleware/security';
import { ipBlocker } from '@/utils/ipBlocker';

/**
 * 用户注册
 */
export async function register(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const ip = getClientIP(req);

  try {
    // 验证必填字段
    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: '请填写所有必填字段',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    // 验证用户名格式（只允许英文、数字、下划线）
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({
        success: false,
        error: '用户名只能包含3-20位英文字母、数字和下划线',
        code: 'INVALID_USERNAME',
      });
      return;
    }

    // 检查密码强度
    const strengthCheck = checkPasswordStrength(password);
    if (!strengthCheck.isStrong) {
      res.status(400).json({
        success: false,
        error: '密码强度不足',
        feedback: strengthCheck.feedback,
        code: 'WEAK_PASSWORD',
      });
      return;
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      res.status(409).json({
        success: false,
        error: '用户名已被使用',
        code: 'USERNAME_EXISTS',
      });
      return;
    }

    // 哈希密码
    const hashedPassword = await hashPassword(password);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        lastLoginIP: ip,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    // 生成令牌
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      role: 'user',
    });

    // 保存刷新令牌到数据库
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // 记录审计日志
    auditLogger.register({
      ip,
      username,
      success: true,
    });

    logger.info('用户注册成功', { userId: user.id, username, ip });

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user,
        ...tokens,
      },
    });
  } catch (error) {
    logger.error('用户注册失败:', error);
    auditLogger.register({
      ip,
      username,
      success: false,
      reason: '服务器错误',
    });

    res.status(500).json({
      success: false,
      error: '注册失败，请稍后重试',
      code: 'REGISTER_ERROR',
    });
  }
}

/**
 * 用户登录
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const ip = getClientIP(req);

  try {
    // 验证必填字段
    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: '请填写用户名和密码',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
      },
    });

    if (!user) {
      // 记录失败尝试
      const shouldBlock = ipBlocker.recordFailure(ip, '用户名不存在');
      auditLogger.login({
        ip,
        username,
        success: false,
        reason: '用户不存在',
      });

      res.status(401).json({
        success: false,
        error: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS',
        ...(shouldBlock && { blocked: true, message: 'IP已被暂时封禁' }),
      });
      return;
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      // 记录失败尝试
      const shouldBlock = ipBlocker.recordFailure(ip, '密码错误');
      auditLogger.login({
        ip,
        username: user.username,
        success: false,
        reason: '密码错误',
      });

      res.status(401).json({
        success: false,
        error: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS',
        ...(shouldBlock && { blocked: true, message: 'IP已被暂时封禁' }),
      });
      return;
    }

    // 检查账户是否被禁用（密码验证通过后再检查，防止用户枚举）
    if (!user.isActive) {
      auditLogger.login({
        ip,
        username,
        success: false,
        reason: '账户已禁用',
      });

      res.status(403).json({
        success: false,
        error: '账户已被禁用',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    // 更新最后登录时间和 IP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIP: ip,
      },
    });

    // 生成令牌
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      role: 'user',
    });

    // 保存刷新令牌到数据库
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // 记录登录日志
    await prisma.loginLog.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || null,
        success: true,
      },
    });

    // 记录审计日志
    auditLogger.login({
      ip,
      username: user.username,
      success: true,
    });

    logger.info('用户登录成功', { userId: user.id, username: user.username, ip });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          isVerified: user.isVerified,
        },
        ...tokens,
      },
    });
  } catch (error) {
    logger.error('用户登录失败:', error);
    auditLogger.login({
      ip,
      username,
      success: false,
      reason: '服务器错误',
    });

    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试',
      code: 'LOGIN_ERROR',
    });
  }
}

/**
 * 管理员登录
 */
export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;
  const ip = getClientIP(req);

  try {
    // 验证必填字段
    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: '请填写用户名和密码',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    // 查找管理员
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      const shouldBlock = ipBlocker.recordFailure(ip, '管理员用户名不存在');
      auditLogger.login({
        ip,
        username,
        success: false,
        reason: '管理员不存在',
      });

      res.status(401).json({
        success: false,
        error: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS',
        ...(shouldBlock && { blocked: true, message: 'IP已被暂时封禁' }),
      });
      return;
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, admin.password);

    if (!isPasswordValid) {
      const shouldBlock = ipBlocker.recordFailure(ip, '管理员密码错误');
      auditLogger.login({
        ip,
        username,
        success: false,
        reason: '密码错误',
      });

      res.status(401).json({
        success: false,
        error: '用户名或密码错误',
        code: 'INVALID_CREDENTIALS',
        ...(shouldBlock && { blocked: true, message: 'IP已被暂时封禁' }),
      });
      return;
    }

    // 检查账户是否被禁用（密码验证通过后再检查，防止用户枚举）
    if (!admin.isActive) {
      auditLogger.login({
        ip,
        username,
        success: false,
        reason: '管理员账户已禁用',
      });

      res.status(403).json({
        success: false,
        error: '账户已被禁用',
        code: 'ACCOUNT_DISABLED',
      });
      return;
    }

    // 更新最后登录时间
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // 生成令牌
    const tokens = generateTokenPair({
      userId: admin.id,
      username: admin.username,
      role: 'admin',
    });

    // 保存刷新令牌到数据库
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        adminId: admin.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // 记录登录日志
    await prisma.loginLog.create({
      data: {
        adminId: admin.id,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || null,
        success: true,
      },
    });

    // 记录审计日志
    auditLogger.login({
      ip,
      username: admin.username,
      success: true,
    });

    logger.info('管理员登录成功', { adminId: admin.id, username: admin.username, ip });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role,
        },
        ...tokens,
      },
    });
  } catch (error) {
    logger.error('管理员登录失败:', error);
    auditLogger.login({
      ip,
      username,
      success: false,
      reason: '服务器错误',
    });

    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试',
      code: 'LOGIN_ERROR',
    });
  }
}

/**
 * 刷新令牌
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({
      success: false,
      error: '请提供刷新令牌',
      code: 'MISSING_REFRESH_TOKEN',
    });
    return;
  }

  try {
    // 验证刷新令牌
    const payload = verifyRefreshToken(refreshToken);

    // 检查令牌是否在数据库中存在且未撤销
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: '刷新令牌无效或已过期',
        code: 'INVALID_REFRESH_TOKEN',
      });
      return;
    }

    // 撤销旧令牌
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // 生成新令牌对
    const tokens = generateTokenPair({
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    });

    // 保存新刷新令牌
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    if (payload.role === 'user') {
      await prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: payload.userId,
          expiresAt: refreshTokenExpiry,
        },
      });
    } else {
      await prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          adminId: payload.userId,
          expiresAt: refreshTokenExpiry,
        },
      });
    }

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    logger.error('刷新令牌失败:', error);
    res.status(401).json({
      success: false,
      error: '刷新令牌无效',
      code: 'REFRESH_FAILED',
    });
  }
}

/**
 * 登出
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  const userId = req.user?.userId;
  const ip = getClientIP(req);

  try {
    // 撤销刷新令牌
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      });
    }

    // 撤销用户的所有刷新令牌
    if (req.user?.role === 'user') {
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      });
    } else if (req.user?.role === 'admin') {
      await prisma.refreshToken.updateMany({
        where: { adminId: userId },
        data: { revokedAt: new Date() },
      });
    }

    logger.info('用户登出成功', { userId, ip });

    res.json({
      success: true,
      message: '登出成功',
    });
  } catch (error) {
    logger.error('登出失败:', error);
    res.status(500).json({
      success: false,
      error: '登出失败',
      code: 'LOGOUT_ERROR',
    });
  }
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const role = req.user?.role;

  try {
    if (role === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          lastLoginAt: true,
          _count: {
            select: {
              resumes: true,
              analyses: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: '用户不存在',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } else {
      const admin = await prisma.admin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!admin) {
        res.status(404).json({
          success: false,
          error: '管理员不存在',
          code: 'ADMIN_NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: admin,
      });
    }
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败',
      code: 'GET_USER_ERROR',
    });
  }
}
