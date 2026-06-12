import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { env } from './env';
import fs from 'fs';
import path from 'path';

// Prisma Client 单例实例
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],  // 不记录 query/info 日志，防止密码/Token等敏感数据泄露
});

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 数据库连接测试
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    logger.info('数据库连接成功');
    return true;
  } catch (error) {
    logger.error('数据库连接失败:', error);
    return false;
  }
}

// 优雅关闭数据库连接
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('数据库连接已关闭');
  } catch (error) {
    logger.error('关闭数据库连接时出错:', error);
    process.exit(1);
  }
}

// 数据库健康检查
export async function healthCheck(): Promise<{ healthy: boolean; latency: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
    };
  }
}

// 清理过期数据（定时任务调用）
export async function cleanupExpiredData(): Promise<void> {
  const now = new Date();
  
  try {
    // 清理过期的刷新令牌
    const deletedTokens = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { not: null } },
        ],
      },
    });

    // 清理过期的 IP 封禁
    const deletedIPs = await prisma.blockedIP.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    // 清理旧的登录日志（保留90天）
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedLogs = await prisma.loginLog.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
      },
    });

    // 清理孤儿上传文件（DB中不存在的文件引用）
    const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
    if (fs.existsSync(uploadDir)) {
      const dbPaths = (await prisma.resume.findMany({ select: { filePath: true } }))
        .map(r => path.resolve(r.filePath));

      const diskFiles = fs.readdirSync(uploadDir).map(f => path.resolve(uploadDir, f));
      let deletedFiles = 0;
      let freedBytes = 0;

      for (const diskFile of diskFiles) {
        if (!dbPaths.includes(diskFile)) {
          try {
            const stat = fs.statSync(diskFile);
            // 跳过超过 30 天的新文件（避免误删刚上传但 DB 事务未提交的文件）
            if (now.getTime() - stat.mtimeMs > 30 * 24 * 60 * 60 * 1000) {
              fs.unlinkSync(diskFile);
              freedBytes += stat.size;
              deletedFiles++;
            }
          } catch (err) {
            logger.warn('清理孤儿文件失败:', { file: diskFile, error: err });
          }
        }
      }

      if (deletedFiles > 0) {
        logger.info('孤儿上传文件清理完成', {
          deletedFiles,
          freedMB: Math.round(freedBytes / 1024 / 1024 * 100) / 100,
        });
      }
    }

    logger.info('过期数据清理完成', {
      deletedTokens: deletedTokens.count,
      deletedIPs: deletedIPs.count,
      deletedLogs: deletedLogs.count,
    });
  } catch (error) {
    logger.error('清理过期数据时出错:', error);
  }
}
