import { Router } from 'express';
import {
  getDashboardStats,
  getUsers,
  getUserDetail,
  blockUser,
  unblockUser,
  deleteUser,
  getAllResumes,
  getResumeDetail,
  deleteResume,
  getAllAnalyses,
  getSystemLogs,
  createAdmin,
  getAdmins,
  getBlockedIPs,
  unblockIP,
  blockIP,
} from '@/controllers/adminController';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '@/middleware/auth';

const router = Router();

// 所有路由都需要管理员认证
router.use(authenticateToken);
router.use(requireAdmin);

// 仪表盘
router.get('/dashboard', getDashboardStats);

// 用户管理
router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);

// 简历管理
router.get('/resumes', getAllResumes);
router.get('/resumes/:id', getResumeDetail);
router.delete('/resumes/:id', deleteResume);

// 分析记录
router.get('/analyses', getAllAnalyses);

// 系统日志
router.get('/logs', getSystemLogs);

// 封禁 IP 管理
router.get('/blocked-ips', getBlockedIPs);
router.delete('/blocked-ips/:id', unblockIP);
router.post('/blocked-ips', blockIP);

// 管理员管理（仅超级管理员）
router.get('/admins', requireSuperAdmin, getAdmins);
router.post('/admins', requireSuperAdmin, createAdmin);

export default router;
