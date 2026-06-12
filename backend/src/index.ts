import express from 'express';
import compression from 'compression';
import routes from './routes';
import { env } from './config/env';
import { logger } from './config/logger';
import { testConnection, disconnectDatabase, cleanupExpiredData, prisma } from './config/database';
import {
  helmetMiddleware,
  corsMiddleware,
  ipBlockMiddleware,
  rateLimitMiddleware,
  auditMiddleware,
  csrfProtection,
  errorHandler,
  notFoundHandler,
} from './middleware/security';

const app = express();

// 信任代理（Nginx 反代后正确获取客户端真实 IP）
// 生产环境：信任第一层代理；开发环境：不信任任何代理
app.set('trust proxy', env.isProd ? 1 : false);

// 安全中间件
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(ipBlockMiddleware);

// 审计中间件
app.use(auditMiddleware);

// 解析 JSON 请求体（全局限制 1mb，大文件上传由路由级覆盖）
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 压缩响应（大于1KB才压缩）
app.use(compression({ threshold: 1024 }));

// CSRF 防护（state-changing 方法须带 X-Requested-With 头）
app.use(csrfProtection);

// 速率限制
app.use(rateLimitMiddleware);

// API 路由
app.use(routes);

// 404 处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// 未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', { reason, promise });
});

// 优雅关闭
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);
  await disconnectDatabase();
  logger.info('服务器已关闭');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 定时清理任务（每6小时运行一次）
setInterval(() => {
  cleanupExpiredData();
}, 6 * 60 * 60 * 1000);

// 启动服务器
async function startServer(): Promise<void> {
  try {
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('无法连接到数据库，服务器启动失败');
      process.exit(1);
    }

    // 预热 Prisma 连接池，消除首次查询延迟
    await prisma.$queryRaw`SELECT 1`;
    logger.info('数据库连接池已预热');

    await cleanupExpiredData();

    app.listen(env.PORT, () => {
      logger.info(`服务器已启动`);
      logger.info(`环境: ${env.NODE_ENV}`);
      logger.info(`端口: ${env.PORT}`);
      logger.info(`API 地址: http://localhost:${env.PORT}`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

export default app;
