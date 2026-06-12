# AI Resume Optimizer

AI 驱动的简历优化平台，支持简历上传、AI 分析、智能评分和多维度优化建议。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js 20 + Express + TypeScript + Prisma |
| 数据库 | MySQL 8.0 |
| 用户端 | React + Vite + TypeScript + Ant Design |
| 管理端 | React + Vite + TypeScript + Ant Design |
| AI | Agnes-2.0-Flash (OpenAI 兼容 API) |

## 项目结构

```
├── backend/              # 后端服务
│   ├── src/
│   │   ├── config/       # 配置（环境变量、日志、数据库）
│   │   ├── controllers/  # 控制器
│   │   ├── middleware/    # 中间件（认证、安全）
│   │   ├── prisma/       # 数据库模型与迁移
│   │   ├── routes/       # 路由
│   │   ├── services/     # 业务逻辑（AI 分析、简历处理）
│   │   └── utils/        # 工具函数（JWT、密码、缓存）
│   └── Dockerfile
├── frontend-user/        # 用户端
├── frontend-admin/       # 管理后台
├── docker-compose.yml    # Docker Compose 编排
├── ecosystem.config.js   # PM2 进程管理
└── .github/workflows/    # CI/CD
```

## 快速开始

### 前置要求

- Node.js >= 20
- MySQL >= 8.0
- (可选) Docker & Docker Compose

### 本地开发

**1. 克隆项目**

```bash
git clone <repo-url>
cd ai-resume-optimizer
```

**2. 配置环境变量（必须手动创建以下文件）**

| 文件路径 | 来源模板 | 说明 |
|---------|---------|------|
| `backend/.env` | `backend/.env.example` | 后端核心配置（数据库、JWT、AI 密钥、管理员账号） |
| `frontend-user/.env` | `frontend-user/.env.example` | 用户端 API 地址配置 |
| `frontend-admin/.env` | `frontend-admin/.env.example` | 管理端 API 地址配置 |
| `.env`（根目录） | `.env.example`（根目录） | Docker Compose 部署时的环境变量 |

```bash
# 后端环境变量（必须）
cp backend/.env.example backend/.env
# 编辑 backend/.env，填写：
#   - DATABASE_URL: MySQL 连接字符串
#   - JWT_SECRET / JWT_REFRESH_SECRET: 运行 `openssl rand -hex 32` 生成
#   - AI_API_KEY: AI API 密钥
#   - ADMIN_USERNAME / ADMIN_PASSWORD: 管理员账号

# 前端环境变量（必须）
cp frontend-user/.env.example frontend-user/.env
cp frontend-admin/.env.example frontend-admin/.env

# Docker 部署时根目录环境变量（可选，仅在 Docker 部署时需要）
cp .env.example .env
```

**3. 启动后端**

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

**4. 启动前端**

```bash
# 用户端 (端口 5173)
cd frontend-user
npm install
npm run dev

# 管理后台 (端口 5174)
cd frontend-admin
npm install
npm run dev
```

### Docker 部署

```bash
# 配置环境变量（确保已创建 backend/.env 和根目录 .env）
cp .env.example .env  # 根目录 Docker Compose 环境变量
cp backend/.env.example backend/.env  # 后端服务环境变量

# 启动全部服务
docker compose up -d

# 运行数据库迁移
docker compose exec backend npx prisma migrate deploy
```

### PM2 部署

```bash
cd backend
npm install && npm run build && npx prisma generate
cd ..
pm2 start ecosystem.config.js
pm2 save
```

## API 文档

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/auth/register` | POST | 用户注册 |
| `/api/v1/auth/login` | POST | 用户登录 |
| `/api/v1/auth/admin/login` | POST | 管理员登录 |
| `/api/v1/auth/refresh` | POST | 刷新令牌 |
| `/api/v1/auth/me` | GET | 当前用户信息 |
| `/api/v1/resumes/upload` | POST | 上传简历 |
| `/api/v1/resumes/history` | GET | 简历列表 |
| `/api/v1/resumes/analyze` | POST | AI 分析简历 |
| `/api/v1/resumes/analyze/stream` | POST | SSE 流式分析 |
| `/api/v1/resumes/download/:id` | GET | 下载简历 |
| `/api/v1/admin/stats` | GET | 管理后台统计 |
| `/health` | GET | 健康检查 |
| `/health/db` | GET | 数据库健康检查 |

## 安全特性

- Helmet 安全头 + CSP
- JWT 双令牌认证（Access 1h / Refresh 7d）
- IP 封禁 + 速率限制
- 请求体大小限制
- Refresh Token 存储在数据库，支持撤销
- 管理员操作审计日志
- AI 结果缓存

## 隐私与安全说明

本项目已配置 `.gitignore` 自动排除以下隐私/敏感文件，**这些文件不会提交到 GitHub**：

- `.env`、`.env.local`：所有环境变量文件
- `node_modules/`：依赖目录
- `dist/`、`build/`：构建输出
- `uploads/`：用户上传的简历文件
- `logs/`、`*.log`：日志文件
- `.vscode/`、`.idea/`：IDE 配置

**你需要手动创建的文件**：
1. `backend/.env` — 从 `backend/.env.example` 复制并填写真实值
2. `frontend-user/.env` — 从 `frontend-user/.env.example` 复制
3. `frontend-admin/.env` — 从 `frontend-admin/.env.example` 复制
4. `.env`（根目录）— 从 `.env.example` 复制（Docker 部署时需要）

## 许可证

MIT
