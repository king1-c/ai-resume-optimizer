import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件（双路径兜底：import.meta.url 解析 + cwd 回退）
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  // 回退：从 process.cwd() 加载
  const fallbackPath = path.resolve(process.cwd(), '.env');
  const fallbackResult = dotenv.config({ path: fallbackPath });
  if (fallbackResult.error) {
    console.error('⚠️ .env 文件加载失败:', envPath, fallbackPath);
  } else {
    console.log('✅ .env 从 cwd 加载:', fallbackPath);
  }
} else {
  console.log('✅ .env 加载成功:', envPath);
}

// 环境变量校验 schema
const envSchema = z.object({
  // 服务器
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('127.0.0.1'),

  // 数据库
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // 管理员账号
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  ADMIN_EMAIL: z.string().default('admin@localhost'),

  // AI API (Agnes-2.0-Flash)
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().default('https://api.agnes.ai/v1'),
  AI_MODEL: z.string().default('Agnes-2.0-Flash'),

  // 邮件
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@ai-resume.local'),

  // 安全配置
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  RATE_LIMIT_LOGIN_MAX: z.string().default('5'),
  IP_BLOCK_THRESHOLD: z.string().default('10'),
  IP_BLOCK_DURATION: z.string().default('3600000'),

  // 文件上传
  MAX_FILE_SIZE: z.string().default('10485760'),
  UPLOAD_DIR: z.string().default('./uploads'),
  ALLOWED_FILE_TYPES: z.string().default('pdf,txt'),

  // 日志
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('./logs'),

  // 调试密钥（生产环境应留空）
  DEBUG_KEY: z.string().default(''),
});

// 解析并校验环境变量
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ 环境变量配置错误:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

// 导出配置对象
export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT, 10),
  SMTP_PORT: parseInt(parsed.data.SMTP_PORT, 10),
  RATE_LIMIT_WINDOW_MS: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(parsed.data.RATE_LIMIT_MAX_REQUESTS, 10),
  RATE_LIMIT_LOGIN_MAX: parseInt(parsed.data.RATE_LIMIT_LOGIN_MAX, 10),
  IP_BLOCK_THRESHOLD: parseInt(parsed.data.IP_BLOCK_THRESHOLD, 10),
  IP_BLOCK_DURATION: parseInt(parsed.data.IP_BLOCK_DURATION, 10),
  MAX_FILE_SIZE: parseInt(parsed.data.MAX_FILE_SIZE, 10),
  ALLOWED_FILE_TYPES: parsed.data.ALLOWED_FILE_TYPES.split(','),
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
} as const;

export type Env = typeof env;

// 运行时安全检查：生产环境禁止使用 MySQL root 账号
if (parsed.data.NODE_ENV === 'production' && /\bmysql:\/\/root:/i.test(parsed.data.DATABASE_URL)) {
  console.error(
    '\n========================================\n' +
    '  ⛔ 严重安全警告: DATABASE_URL 使用了 MySQL root 账号！\n' +
    '  请创建专用应用账号并更新 DATABASE_URL。\n' +
    '  应用将继续运行，但强烈建议立即修复。\n' +
    '========================================\n'
  );
}
