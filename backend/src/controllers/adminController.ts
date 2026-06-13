import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { logger, auditLogger } from '@/config/logger';
import { getClientIP } from '@/middleware/security';
import { hashPassword, checkPasswordStrength } from '@/utils/password';
import { ipBlocker } from '@/utils/ipBlocker';
import fs from 'fs';

/**
 * 获取仪表盘统计数据
 */
export async function getDashboardStats(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const [
      totalUsers,
      totalResumes,
      totalAnalyses,
      todayUsers,
      todayResumes,
      todayAnalyses,
      yesterdayUsers,
      yesterdayResumes,
      yesterdayAnalyses,
      yesterdayCompletedAnalyses,
      todayCompletedAnalyses,
      recentLogins,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.resume.count(),
      prisma.analysis.count(),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.resume.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.analysis.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.resume.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.analysis.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.analysis.count({
        where: { status: 'COMPLETED', createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.analysis.count({
        where: { status: 'COMPLETED', createdAt: { gte: todayStart } },
      }),
      prisma.loginLog.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { username: true } },
          admin: { select: { username: true } },
        },
      }),
    ]);

    // 分析成功率（总）
    const completedAnalyses = await prisma.analysis.count({ where: { status: 'COMPLETED' } });
    const successRate = totalAnalyses > 0 ? Math.round((completedAnalyses / totalAnalyses) * 100) : 0;
    // 昨日分析成功率
    const yesterdaySuccessRate = yesterdayAnalyses > 0 ? Math.round((yesterdayCompletedAnalyses / yesterdayAnalyses) * 100) : 0;
    // 今日分析成功率
    const todaySuccessRate = todayAnalyses > 0 ? Math.round((todayCompletedAnalyses / todayAnalyses) * 100) : 0;

    // 环比昨日计算
    const userGrowth = yesterdayUsers > 0 ? Math.round(((todayUsers - yesterdayUsers) / yesterdayUsers) * 100) : todayUsers > 0 ? 100 : 0;
    const resumeGrowth = yesterdayResumes > 0 ? Math.round(((todayResumes - yesterdayResumes) / yesterdayResumes) * 100) : todayResumes > 0 ? 100 : 0;
    const todayCompareYesterday = yesterdayAnalyses > 0 ? todayAnalyses - yesterdayAnalyses : todayAnalyses;
    const successRateTrend = todaySuccessRate - yesterdaySuccessRate;

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalResumes,
          totalAnalyses,
          todayUsers,
          todayAnalyses,
          successRate,
          userGrowth,
          resumeGrowth,
          todayCompareYesterday,
          successRateTrend,
        },
        recentLogins: recentLogins.map((log) => ({
          id: log.id,
          username: log.user?.username || log.admin?.username || 'Unknown',
          ipAddress: log.ipAddress,
          success: log.success,
          createdAt: log.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('获取仪表盘数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取数据失败',
      code: 'GET_STATS_ERROR',
    });
  }
}

/**
 * 获取用户列表
 */
export async function getUsers(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 10, 100);
  const search = req.query.search as string;

  try {
    const where = search
      ? {
          OR: [
            { username: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          lastLoginIP: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              resumes: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const list = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      isActive: u.isActive,
      lastLoginIP: u.lastLoginIP,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      resumeCount: u._count.resumes,
    }));

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户列表失败',
      code: 'GET_USERS_ERROR',
    });
  }
}

/**
 * 获取用户详情
 */
export async function getUserDetail(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        resumes: {
          orderBy: { createdAt: 'desc' },
          include: {
            analyses: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
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
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: user.isActive,
        lastLoginIP: user.lastLoginIP,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        resumes: user.resumes.map((r) => ({
          id: r.id,
          originalFilename: r.originalName,
          fileType: r.mimeType,
          createdAt: r.createdAt,
          analysis: r.analyses[0]
            ? {
                totalScore: r.analyses[0].score != null ? Math.round((r.analyses[0].score / 100) * 10 * 10) / 10 : null,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    logger.error('获取用户详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户详情失败',
      code: 'GET_USER_DETAIL_ERROR',
    });
  }
}

/**
 * 解封用户
 */
export async function unblockUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.userId;
  const ip = getClientIP(req);

  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: { isActive: true },
    });

    // 移除关联的封禁IP
    if (user.lastLoginIP) {
      await prisma.blockedIP.deleteMany({
        where: {
          ipAddress: user.lastLoginIP,
          reason: {
            contains: `用户 ${user.username} 被封禁`,
          },
        },
      });
    }

    auditLogger.adminAction({
      ip,
      adminId,
      action: '解封用户',
      target: `user:${id}`,
      details: { username: user.username, unblockedIP: user.lastLoginIP },
    });

    logger.info('用户解封成功', { userId: id, adminId, ip });

    res.json({
      success: true,
      message: '用户已解封',
      data: { id: user.id, username: user.username, isActive: true },
    });
  } catch (error) {
    logger.error('解封用户失败:', error);
    res.status(500).json({
      success: false,
      message: '解封失败',
      code: 'UNBLOCK_USER_ERROR',
    });
  }
}

/**
 * 封禁用户
 */
export async function blockUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.userId;
  const ip = getClientIP(req);

  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data: { isActive: false },
    });

    // 如果用户有登录IP，也封禁该IP（跳过本地回环地址的所有变体）
    const localhostPatterns = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1', '0.0.0.0'];
    const isLocalhost = localhostPatterns.some(p => user.lastLoginIP?.includes(p));
    if (user.lastLoginIP && !isLocalhost) {
      await prisma.blockedIP.create({
        data: {
          ipAddress: user.lastLoginIP,
          reason: `用户 ${user.username} 被封禁，关联IP自动封禁`,
          blockedBy: req.user?.username,
        },
      });
    }

    auditLogger.adminAction({
      ip,
      adminId,
      action: '封禁用户',
      target: `user:${id}`,
      details: { username: user.username, blockedIP: user.lastLoginIP },
    });

    logger.info('用户封禁成功', { userId: id, adminId, ip });

    res.json({
      success: true,
      message: '用户已封禁',
      data: { id: user.id, username: user.username, isActive: false },
    });
  } catch (error) {
    logger.error('封禁用户失败:', error);
    res.status(500).json({
      success: false,
      error: '封禁失败',
      code: 'BLOCK_USER_ERROR',
    });
  }
}

/**
 * 删除用户（级联删除关联数据）
 */
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.userId;
  const ip = getClientIP(req);

  try {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      res.status(400).json({
        success: false,
        error: '无效的用户ID',
        code: 'INVALID_USER_ID',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, id: true },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: '用户不存在',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // 先获取用户的所有简历文件路径
    const userResumes = await prisma.resume.findMany({
      where: { userId },
      select: { filePath: true },
    });

    // 级联删除关联数据
    await prisma.$transaction([
      // 1. 删除所有分析记录
      prisma.analysis.deleteMany({ where: { userId } }),
      // 2. 删除所有token
      prisma.refreshToken.deleteMany({ where: { userId } }),
      // 3. 删除所有登录日志
      prisma.loginLog.deleteMany({ where: { userId } }),
      // 4. 删除所有封禁IP记录（原因包含该用户名的）
      prisma.blockedIP.deleteMany({ where: { reason: { contains: `用户 ${user.username}` } } }),
      // 5. 删除所有简历
      prisma.resume.deleteMany({ where: { userId } }),
      // 6. 删除用户
      prisma.user.delete({ where: { id: userId } }),
    ]);

    // 物理删除上传的文件（异步，不阻塞响应）
    setTimeout(() => {
      for (const resume of userResumes) {
        try {
          if (fs.existsSync(resume.filePath)) {
            fs.unlinkSync(resume.filePath);
          }
        } catch (err) {
          logger.warn('删除用户简历文件失败:', { filePath: resume.filePath, error: err });
        }
      }
    }, 0);

    auditLogger.adminAction({
      ip,
      adminId,
      action: '删除用户',
      target: `user:${id}`,
      details: { username: user.username },
    });

    logger.info('用户删除成功', { userId: id, username: user.username, adminId, ip });

    res.json({
      success: true,
      message: '用户已删除',
    });
  } catch (error) {
    logger.error('删除用户失败:', error);
    res.status(500).json({
      success: false,
      error: '删除失败',
      code: 'DELETE_USER_ERROR',
    });
  }
}

/**
 * 获取所有简历列表
 */
export async function getAllResumes(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 20, 100);
  const keyword = req.query.keyword as string;
  const minScore = parseFloat(req.query.minScore as string);
  const maxScore = parseFloat(req.query.maxScore as string);

  try {
    const where: any = {};

    // 关键词搜索（文件名或用户名）
    if (keyword) {
      where.OR = [
        { originalName: { contains: keyword } },
        { user: { username: { contains: keyword } } },
      ];
    }

    const [resumes, total] = await Promise.all([
      prisma.resume.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.resume.count({ where }),
    ]);

    const list = resumes.map((r) => {
      const latestAnalysis = r.analyses[0];
      const rawScore = latestAnalysis?.score;
      const score = rawScore != null ? Math.round((rawScore / 100) * 10 * 10) / 10 : null; // 0-100 转 0-10
      // 评分范围过滤
      if (score != null) {
        if (!isNaN(minScore) && score < minScore) return null;
        if (!isNaN(maxScore) && score > maxScore) return null;
      }
      return {
        id: r.id,
        originalFilename: r.originalName,
        fileType: r.mimeType,
        user: r.user,
        totalScore: score,
        targetPosition: latestAnalysis?.targetPosition || null,
        createdAt: r.createdAt,
      };
    }).filter(Boolean);

    res.json({
      success: true,
      data: {
        list,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('获取简历列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取简历列表失败',
      code: 'GET_RESUMES_ERROR',
    });
  }
}

/**
 * 获取单个简历详情
 */
export async function getResumeDetail(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const resume = await prisma.resume.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!resume) {
      res.status(404).json({
        success: false,
        error: '简历不存在',
        code: 'RESUME_NOT_FOUND',
      });
      return;
    }

    const latestAnalysis = resume.analyses[0];
    const rawScore = latestAnalysis?.score;
    const score10 = rawScore != null ? Math.round((rawScore / 100) * 10 * 10) / 10 : null;
    res.json({
      success: true,
      data: {
        id: resume.id,
        originalFilename: resume.originalName,
        fileType: resume.mimeType,
        content: resume.content,
        user: resume.user,
        totalScore: score10,
        analysis: latestAnalysis
          ? {
              totalScore: score10,
              targetPosition: latestAnalysis.targetPosition || null,
              resultJson: latestAnalysis.suggestions || {},
            }
          : null,
        createdAt: resume.createdAt,
      },
    });
  } catch (error) {
    logger.error('获取简历详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取简历详情失败',
      code: 'GET_RESUME_DETAIL_ERROR',
    });
  }
}

/**
 * 删除简历
 */
export async function deleteResume(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.userId;

  try {
    const resume = await prisma.resume.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!resume) {
      res.status(404).json({
        success: false,
        error: '简历不存在',
        code: 'RESUME_NOT_FOUND',
      });
      return;
    }

    const filePath = resume.filePath;
    await prisma.resume.delete({
      where: { id: parseInt(id, 10) },
    });

    // 物理删除上传的文件
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        logger.warn('删除简历文件失败:', { filePath, error: err });
      }
    }, 0);

    logger.info('管理员删除简历', { adminId, resumeId: resume.id, fileName: resume.originalName });

    res.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    logger.error('删除简历失败:', error);
    res.status(500).json({
      success: false,
      error: '删除失败',
      code: 'DELETE_RESUME_ERROR',
    });
  }
}

/**
 * 获取所有分析记录
 */
export async function getAllAnalyses(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 10, 100);
  const status = req.query.status as string;

  try {
    const where = status ? { status: status as any } : {};

    const [analyses, total] = await Promise.all([
      prisma.analysis.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              username: true,
              email: true,
            },
          },
          resume: {
            select: {
              originalName: true,
            },
          },
        },
      }),
      prisma.analysis.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        list: analyses,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('获取分析记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取分析记录失败',
      code: 'GET_ANALYSES_ERROR',
    });
  }
}

/**
 * 获取系统日志
 */
export async function getSystemLogs(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 10, 100);
  const level = req.query.level as string;

  try {
    const where = level ? { level: level as any } : {};

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          admin: {
            select: {
              username: true,
            },
          },
        },
      }),
      prisma.systemLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        list: logs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('获取系统日志失败:', error);
    res.status(500).json({
      success: false,
      error: '获取系统日志失败',
      code: 'GET_LOGS_ERROR',
    });
  }
}

/**
 * 创建管理员（仅超级管理员）
 */
export async function createAdmin(req: Request, res: Response): Promise<void> {
  const { username, password, role } = req.body;
  const adminId = req.user?.userId;
  const ip = getClientIP(req);

  try {
    // 检查用户名是否已存在
    const existing = await prisma.admin.findUnique({
      where: { username },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        error: '用户名已存在',
        code: 'USERNAME_EXISTS',
      });
      return;
    }

    // 检查密码强度
    const strengthCheck = checkPasswordStrength(password);
    if (!strengthCheck.isStrong) {
      res.status(400).json({
        success: false,
        error: '密码强度不足',
        code: 'WEAK_PASSWORD',
        details: strengthCheck.feedback,
      });
      return;
    }

    // 哈希密码
    const hashedPassword = await hashPassword(password);

    // 创建管理员
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        role: role || 'ADMIN',
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    auditLogger.adminAction({
      ip,
      adminId,
      action: '创建管理员',
      target: `admin:${admin.id}`,
      details: { username, role },
    });

    logger.info('管理员创建成功', { newAdminId: admin.id, createdBy: adminId, ip });

    res.status(201).json({
      success: true,
      message: '创建成功',
      data: admin,
    });
  } catch (error) {
    logger.error('创建管理员失败:', error);
    res.status(500).json({
      success: false,
      error: '创建失败',
      code: 'CREATE_ADMIN_ERROR',
    });
  }
}

/**
 * 获取管理员列表
 */
export async function getAdmins(_req: Request, res: Response): Promise<void> {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    logger.error('获取管理员列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取管理员列表失败',
      code: 'GET_ADMINS_ERROR',
    });
  }
}

/**
 * 获取被封禁的 IP 列表（包含数据库和内存封禁）
 */
export async function getBlockedIPs(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = parseInt(req.query.pageSize as string, 10) || 10;

  try {
    const [ips, total] = await Promise.all([
      prisma.blockedIP.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.blockedIP.count(),
    ]);

    // 合并内存中的封禁记录
    const memoryBlocked = ipBlocker.getBlockedIPs();
    const now = Date.now();

    res.json({
      success: true,
      data: {
        list: ips.map(ip => ({
          ...ip,
          source: 'database',
        })),
        memoryBlocked: memoryBlocked.map(ip => ({
          ipAddress: ip.ip,
          blockedUntil: new Date(ip.blockedUntil),
          remainingTime: Math.ceil((ip.blockedUntil - now) / 1000),
          failureCount: ip.count,
          source: 'memory',
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('获取封禁 IP 列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取封禁 IP 列表失败',
      code: 'GET_BLOCKED_IPS_ERROR',
    });
  }
}

/**
 * 手动解封 IP
 */
export async function unblockIP(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { source } = req.query;
  const adminId = req.user?.userId;
  const ip = getClientIP(req);

  try {
    // 如果是内存封禁，直接解封
    if (source === 'memory') {
      const ipAddress = req.body.ipAddress as string;
      if (!ipAddress) {
        res.status(400).json({
          success: false,
          error: '请提供 IP 地址',
          code: 'MISSING_IP_ADDRESS',
        });
        return;
      }
      const success = ipBlocker.unblock(ipAddress);
      if (!success) {
        res.status(404).json({
          success: false,
          error: '该 IP 未被内存封禁',
          code: 'IP_NOT_BLOCKED',
        });
        return;
      }

      auditLogger.adminAction({
        ip,
        adminId,
        action: '解封内存 IP',
        target: `memory_ip:${ipAddress}`,
      });

      logger.info('内存 IP 解封成功', { ipAddress, adminId, ip });

      res.json({
        success: true,
        message: '内存 IP 已解封',
      });
      return;
    }

    // 默认操作数据库封禁
    await prisma.blockedIP.delete({
      where: { id: parseInt(id, 10) },
    });

    auditLogger.adminAction({
      ip,
      adminId,
      action: '解封 IP',
      target: `blocked_ip:${id}`,
    });

    logger.info('IP 解封成功', { blockedIPId: id, adminId, ip });

    res.json({
      success: true,
      message: '解封成功',
    });
  } catch (error) {
    logger.error('解封 IP 失败:', error);
    res.status(500).json({
      success: false,
      error: '解封失败',
      code: 'UNBLOCK_IP_ERROR',
    });
  }
}

/**
 * 手动封禁 IP
 */
export async function blockIP(req: Request, res: Response): Promise<void> {
  const { ipAddress, reason, duration } = req.body;
  const adminId = req.user?.userId;
  const ip = getClientIP(req);

  try {
    const expiresAt = duration
      ? new Date(Date.now() + duration * 1000)
      : null;

    const blocked = await prisma.blockedIP.create({
      data: {
        ipAddress,
        reason,
        blockedBy: req.user?.username,
        expiresAt,
      },
    });

    auditLogger.adminAction({
      ip,
      adminId,
      action: '封禁 IP',
      target: `ip:${ipAddress}`,
      details: { reason, duration },
    });

    logger.info('IP 封禁成功', { ipAddress, adminId, ip });

    res.json({
      success: true,
      message: '封禁成功',
      data: blocked,
    });
  } catch (error) {
    logger.error('封禁 IP 失败:', error);
    res.status(500).json({
      success: false,
      error: '封禁失败',
      code: 'BLOCK_IP_ERROR',
    });
  }
}
