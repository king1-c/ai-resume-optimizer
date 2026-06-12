import { Router } from 'express';
import authRoutes from './auth';
import resumeRoutes from './resume';
import adminRoutes from './admin';

const router = Router();

// API 版本前缀
const API_VERSION = '/api/v1';

// 认证路由
router.use(`${API_VERSION}/auth`, authRoutes);

// 简历路由
router.use(`${API_VERSION}/resumes`, resumeRoutes);

// 管理员路由
router.use(`${API_VERSION}/admin`, adminRoutes);

// 健康检查（不暴露内部信息）
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 数据库健康检查
router.get('/health/db', async (_req, res) => {
  try {
    const { healthCheck } = await import('@/config/database');
    const result = await healthCheck();
    res.json({
      status: 'ok',
      database: result.healthy ? 'connected' : 'disconnected',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

// 404 处理
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    code: 'NOT_FOUND',
    path: req.path,
  });
});

export default router;
