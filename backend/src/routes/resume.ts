import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import {
  uploadResume,
  getHistory,
  downloadResume,
  previewResume,
  analyzeResumeHandler,
  analyzeResumeStreamHandler,
  getResumeAnalyses,
} from '@/controllers/resumeController';
import { authenticateToken } from '@/middleware/auth';

const router = Router();

// 确保上传目录存在
const uploadDir = env.UPLOAD_DIR;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 磁盘存储
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'text/plain',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(new Error('不支持的文件类型'));
      return;
    }
    cb(null, true);
  },
});

// 所有路由都需要认证
router.use(authenticateToken);

// SSE 流式端点限速：单 IP 每分钟最多 10 次请求，防止连接耗尽
const streamLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'STREAM_RATE_LIMIT' },
});

// 上传简历
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        logger.warn('Multer 上传错误', { code: err.code, message: err.message, field: err.field });
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ success: false, error: '文件大小不能超过 10MB', code: 'FILE_TOO_LARGE' });
          return;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          res.status(400).json({ success: false, error: '上传字段名不匹配，请使用 file 字段', code: 'INVALID_FIELD' });
          return;
        }
        res.status(400).json({ success: false, error: `上传错误: ${err.message}`, code: 'UPLOAD_ERROR' });
        return;
      }
      if (err) {
        res.status(400).json({ success: false, error: err.message, code: 'UPLOAD_ERROR' });
        return;
      }
    }
    next();
  });
}, uploadResume);

// 获取简历历史
router.get('/history', getHistory);

// 兼容前端旧版列表接口
router.get('/list', getHistory);

// 获取简历的所有分析记录
router.get('/:resumeId/analyses', getResumeAnalyses);

// 预览原始文件（用于在线查看）- 需要认证
router.get('/preview/:id', authenticateToken, previewResume);

// 分析简历（同步）
router.post('/analyze', analyzeResumeHandler);

// 流式分析简历（SSE）
router.post('/analyze/stream', streamLimiter, analyzeResumeStreamHandler);

// 下载优化后的简历
router.get('/download/:id', downloadResume);

// 导出优化后的简历（别名）
router.get('/export/:id', downloadResume);

export default router;
