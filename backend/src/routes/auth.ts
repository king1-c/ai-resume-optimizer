import { Router } from 'express';
import {
  register,
  login,
  adminLogin,
  refreshToken,
  logout,
  getCurrentUser,
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { loginRateLimitMiddleware, usernameRateLimitMiddleware } from '../middleware/security';

const router = Router();

// 用户注册（带 IP 速率限制）
router.post('/register', loginRateLimitMiddleware, register);

// 用户登录（带 IP + 用户名双重速率限制）
router.post('/login', loginRateLimitMiddleware, usernameRateLimitMiddleware, login);

// 管理员登录（带 IP + 用户名双重速率限制）
router.post('/admin/login', loginRateLimitMiddleware, usernameRateLimitMiddleware, adminLogin);

// 刷新令牌
router.post('/refresh', refreshToken);

// 登出（需要认证）
router.post('/logout', authenticateToken, logout);

// 获取当前用户信息（需要认证）
router.get('/me', authenticateToken, getCurrentUser);

export default router;
