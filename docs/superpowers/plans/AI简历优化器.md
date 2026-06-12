# AI 简历优化器 — 实施总计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个支持 PDF/Word 简历解析、五维 AI 评分与修改建议的全栈 SaaS 平台，含用户端、管理端、Docker 一键部署、Cloudflare CDN。

**Architecture:** React + TypeScript + Vite 前端 SPA，Express + Prisma + MySQL 后端 RESTful API + SSE 流式 AI 分析，JWT + 邮箱验证码认证，Nginx 反代，Docker Compose 编排，Cloudflare 边缘加速。

**Tech Stack:** React 18, TypeScript, Vite, Ant Design 5, ECharts, Axios, EventSource, Node.js 20, Express, Prisma, MySQL 8, JWT, bcrypt, multer, pdf-parse, mammoth, nodemailer, DeepSeek API (SSE), express-rate-limit, helmet, zod, Docker, Docker Compose, Nginx, Cloudflare.

**前置环境（开发者本地）：**
- Node.js 20+ (`node -v`)
- npm 10+ (`npm -v`)
- Docker Desktop
- Git
- 一个 DeepSeek API Key (`https://platform.deepseek.com`)
- 一个 QQ/Gmail 邮箱授权码（用于发验证码）

---

## 阶段总览与子计划

| Phase | 内容 | 子计划文件 |
|-------|------|------------|
| Phase 0 | 仓库脚手架 + 文档（README / API / 部署 / 安全） | 本文件 |
| Phase 1 | 数据库（5 张表）+ Prisma | 本文件 |
| Phase 2 | 安全机制（JWT + 邮箱验证码 + bcrypt + 限流 + Helmet + CORS + Zod） | 本文件 |
| Phase 3 | 后端核心：简历上传/解析 + AI 分析 SSE + 采纳 + 导出 + 历史 | [AI简历优化器-后端.md](AI简历优化器-后端.md) |
| Phase 4 | 后端管理端：统计 + 用户管理 + 简历管理 | [AI简历优化器-后端.md](AI简历优化器-后端.md) |
| Phase 5 | 前端用户端：登录/注册/上传/分析结果/历史 | [AI简历优化器-前端.md](AI简历优化器-前端.md) |
| Phase 6 | 前端管理端：仪表盘 + 用户列表 + 简历列表 | [AI简历优化器-前端.md](AI简历优化器-前端.md) |
| Phase 7 | 部署：Dockerfile + Compose + Nginx + Cloudflare + ECS | [AI简历优化器-部署.md](AI简历优化器-部署.md) |

**共计 66 个任务，约 300+ 步骤。每个步骤 2-5 分钟。**

---

## 命名与目录约定

- 项目根：`c:\Users\chenqiuhong\Desktop\AI Resume Optimizer\`（开发机）/ `/opt/resume-optimizer/`（服务器）
- 端口：MySQL `3306`、后端 `3000`、Nginx `80`/`443`
- 数据库名：`resume_optimizer`
- JWT 有效期：7 天
- 验证码有效期：10 分钟，6 位数字
- 文件上传限制：10MB，仅允许 `pdf` / `docx` / `txt`

---

## 目录结构（最终态）

```
AI Resume Optimizer/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Prisma 数据模型
│   │   └── init.sql               # 纯 SQL 初始化（与 schema 同步）
│   ├── scripts/
│   │   ├── promote-admin.sql      # 管理员提升
│   │   └── check-env.js           # 启动前环境变量自检
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── authRequired.js    # JWT 校验
│   │   │   ├── adminOnly.js       # 角色校验
│   │   │   └── upload.js          # multer 文件上传
│   │   ├── routes/
│   │   │   ├── auth.js            # 验证码/注册/登录
│   │   │   ├── resume.js          # 简历 + AI
│   │   │   └── admin.js           # 管理端
│   │   ├── services/
│   │   │   ├── parser.js          # PDF/Word/TXT
│   │   │   ├── ai.js              # DeepSeek
│   │   │   ├── mailer.js          # nodemailer
│   │   │   └── verification.js    # 验证码
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   ├── password.js
│   │   │   └── prisma.js
│   │   └── app.js
│   ├── uploads/                   # 简历文件
│   ├── package.json
│   ├── Dockerfile
│   └── README.md
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/                   # auth.ts / resume.ts / admin.ts / client.ts
│   │   ├── components/
│   │   │   ├── common/            # AuthRoute / AdminRoute / AppLayout
│   │   │   ├── user/              # ScoreRadar / AdviceCard
│   │   │   └── admin/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── user/              # Upload / Result / History
│   │   │   └── admin/             # Dashboard / UserList / ResumeList
│   │   ├── router.tsx
│   │   ├── store.ts
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile                 # v2
│   ├── nginx-spa-fallback.conf
│   └── README.md
│
├── nginx/
│   └── default.conf
│
├── docs/
│   ├── API.md
│   ├── DEPLOY.md
│   ├── SECURITY.md
│   ├── CLOUDFLARE.md
│   └── DEPLOY-CHECKLIST.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Phase 0：仓库脚手架 + 文档

### Task 0.1：初始化 Git 仓库 + 目录结构

**Files:**
- Create: `.gitignore`

- [ ] **Step 1：创建项目根目录的子目录骨架**

PowerShell：
```powershell
$root = "c:\Users\chenqiuhong\Desktop\AI Resume Optimizer"
New-Item -ItemType Directory -Force -Path "$root\backend\src\middleware","$root\backend\src\routes","$root\backend\src\services","$root\backend\src\utils","$root\backend\prisma","$root\backend\uploads","$root\backend\scripts","$root\frontend\src\api","$root\frontend\src\components\common","$root\frontend\src\components\admin","$root\frontend\src\components\user","$root\frontend\src\pages\user","$root\frontend\src\pages\admin","$root\nginx","$root\frontend_dist","$root\docs"
```

- [ ] **Step 2：写 `.gitignore`**

Create `.gitignore`:
```gitignore
# Node
node_modules/
dist/
build/
*.log

# Env
.env
.env.local
.env.production

# Backend
backend/uploads/*
!backend/uploads/.gitkeep
backend/prisma/migrations/dev.db*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# 参考资料不入版本
react-bits-main/
```

- [ ] **Step 3：占位 + 首次提交**

```bash
cd "c:\Users\chenqiuhong\Desktop\AI Resume Optimizer"
echo "" > backend/uploads/.gitkeep
git init
git config user.name "你的名字"
git config user.email "你的邮箱"
git add .gitignore backend/uploads/.gitkeep
git commit -m "chore: 初始化仓库与目录结构"
```

---

### Task 0.2：环境变量模板

**Files:**
- Create: `.env.example`
- Create: `backend/.env.example`

- [ ] **Step 1：根 `.env.example`**

```bash
# === MySQL ===
DB_PASSWORD=change_me_strong_password

# === JWT ===
JWT_SECRET=change_me_random_at_least_32_chars_xxxxxxxxxxxx

# === DeepSeek AI ===
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# === SMTP 邮箱验证码 ===
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your_account@qq.com
SMTP_PASS=your_authorization_code
SMTP_FROM_NAME=AI简历优化器

# === 前端 ===
CORS_ORIGIN=https://yourdomain.com
```

- [ ] **Step 2：后端独立 `.env.example`**

```bash
DATABASE_URL=mysql://root:change_me@localhost:3306/resume_optimizer
JWT_SECRET=change_me_random_at_least_32_chars_xxxxxxxxxxxx
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
PORT=3000

SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=your_account@qq.com
SMTP_PASS=your_authorization_code
SMTP_FROM_NAME=AI简历优化器

UPLOAD_MAX_MB=10
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 3：提交**

```bash
git add .env.example backend/.env.example
git commit -m "docs: 添加 .env.example 模板"
```

---

### Task 0.3：项目 README

**Files:**
- Create: `README.md`

- [ ] **Step 1：写完整 README**

```markdown
# AI 简历优化器

> 基于 DeepSeek API 的五维简历分析平台，含用户端、管理端、Docker 一键部署。

## 功能特性
- PDF / Word / TXT 简历解析
- 五维 AI 评分：结构排版 / 内容完整性 / 关键词密度 / 量化成果 / 语言表达
- SSE 流式输出分析过程
- 逐条建议采纳/忽略 + 优化版简历导出
- 历史记录查看
- 管理端：数据面板 / 用户管理 / 简历管理
- **邮箱验证码注册** + JWT 登录 + 角色权限
- Cloudflare CDN + HTTPS
- 完整安全机制（限流、Helmet、bcrypt、CORS）

## 技术栈
- 前端：React 18 + TypeScript + Vite + Ant Design 5 + ECharts
- 后端：Node.js 20 + Express + Prisma + MySQL 8
- AI：DeepSeek API（流式）
- 部署：Docker + Docker Compose + Nginx + Cloudflare

## 快速开始（本地开发）

### 1. 克隆
\`\`\`bash
git clone <你的仓库地址>
cd resume-optimizer
\`\`\`

### 2. 启动 MySQL
\`\`\`bash
docker run -d --name resume-mysql -e MYSQL_ROOT_PASSWORD=root123 -e MYSQL_DATABASE=resume_optimizer -p 3306:3306 mysql:8.0
\`\`\`

### 3. 启动后端
\`\`\`bash
cd backend
cp .env.example .env       # 填入真实环境变量
npm install
npx prisma db push
npm run dev                # http://localhost:3000
\`\`\`

### 4. 启动前端
\`\`\`bash
cd frontend
npm install
npm run dev                # http://localhost:5173
\`\`\`

### 5. 注册 + 手动设为管理员
注册普通用户后，MySQL 改 role：
\`\`\`sql
UPDATE users SET role = 'admin' WHERE username = '你的用户名';
\`\`\`

## 文档
- [API 接口](docs/API.md)
- [部署指南](docs/DEPLOY.md)
- [安全机制](docs/SECURITY.md)
- [Cloudflare 配置](docs/CLOUDFLARE.md)
- [部署检查清单](docs/DEPLOY-CHECKLIST.md)

## License
MIT
```

- [ ] **Step 2：提交**

```bash
git add README.md
git commit -m "docs: 添加 README"
```

---

### Task 0.4：API 文档

**Files:**
- Create: `docs/API.md`

- [ ] **Step 1：写 API 文档**

```markdown
# API 文档

> 基础 URL：`/api`
> 除 `/api/auth/*` 外，所有接口需在 Header 携带 `Authorization: Bearer <token>`

## 1. 认证

### POST /api/auth/send-code
发送邮箱验证码
- Body: `{ "email": "user@example.com" }`
- 限流：60s/次，10次/小时
- 返回: `{ "success": true }`

### POST /api/auth/register
注册（需先 send-code）
- Body: `{ "username", "email", "password", "code" }`
- 返回: `{ "token", "user" }`

### POST /api/auth/login
登录
- Body: `{ "username", "password" }`（username 可填邮箱）
- 限流：5次/15min
- 返回: `{ "token", "user" }`

## 2. 简历

### POST /api/upload
上传简历（multipart/form-data，字段 `file`）
- 限制：pdf/docx/txt，10MB
- 返回: `{ "resumeId", "rawText" }`

### POST /api/analyze/:resumeId
AI 分析（SSE）
- 事件流：`{"chunk":"..."}` → `{"done":true,"analysisId":1,"totalScore":7.5}` / `{"error":"..."}`

### GET /api/analysis/:resumeId
获取分析结果
- 返回: `{ "id", "resumeId", "totalScore", "resultJson", "createdAt" }`

### POST /api/adopt
采纳建议
- Body: `{ "analysisId", "dimensionName", "originalText", "suggestionText" }`

### GET /api/history?page=1&pageSize=10
历史记录
- 返回: `{ "list": [...], "total", "page", "pageSize" }`

### GET /api/export/:resumeId
导出优化版简历（纯文本 txt）

## 3. 管理端（需 admin）

### GET /api/admin/stats
返回: `{ "totalUsers", "totalResumes", "todayUploads", "avgScore", "scoreDistribution", "dailyUploads" }`

### GET /api/admin/users?keyword=&page=
用户列表

### GET /api/admin/users/:id
用户详情 + 简历列表

### GET /api/admin/resumes?keyword=&minScore=&maxScore=&page=
简历列表

### GET /api/admin/resumes/:id
简历详情 + AI 分析

### DELETE /api/admin/resumes/:id
删除简历
```

- [ ] **Step 2：提交**

```bash
git add docs/API.md
git commit -m "docs: API 接口文档"
```

---

### Task 0.5：部署文档

**Files:**
- Create: `docs/DEPLOY.md`

- [ ] **Step 1：写部署文档**

```markdown
# 部署文档

## 0. 前置
- 阿里云 ECS（Ubuntu 22.04，2 核 2G）
- 一个域名（万网）
- Cloudflare 账号
- DeepSeek API Key
- QQ 邮箱授权码（SMTP）

## 1. 服务器初始化
\`\`\`bash
ssh root@你的公网IP
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
docker --version
\`\`\`

## 2. 安全组
阿里云 ECS 控制台 → 安全组 → 开放 22/80/443。

## 3. 部署代码
\`\`\`bash
cd /opt
git clone <仓库地址> resume-optimizer
cd resume-optimizer
cp .env.example .env
nano .env   # 填入真实值
\`\`\`

## 4. 启动后端 + MySQL + Nginx
\`\`\`bash
docker compose up -d
docker compose ps
docker compose logs -f backend
\`\`\`

## 5. 部署前端（v1 简化方案）
\`\`\`bash
cd /opt/resume-optimizer/frontend
npm install
npm run build
docker cp dist/. resume-nginx:/usr/share/nginx/html/
docker compose restart nginx
\`\`\`

## 6. 验证
浏览器访问 `http://你的公网IP`，应看到登录页。

## 7. Cloudflare
参见 [CLOUDFLARE.md](CLOUDFLARE.md)

## 8. 提升管理员
\`\`\`bash
docker compose exec mysql mysql -uroot -p
> USE resume_optimizer;
> UPDATE users SET role = 'admin' WHERE username = '你的用户名';
\`\`\`

## 9. 常用运维
\`\`\`bash
docker compose ps
docker compose logs -f [service]
docker compose restart backend
docker compose down
docker compose up -d --build
\`\`\`

## 10. 备份
\`\`\`bash
docker compose exec mysql mysqldump -uroot -p resume_optimizer > backup_\$(date +%F).sql
# 恢复
docker compose exec -T mysql mysql -uroot -p resume_optimizer < backup_2026-06-09.sql
\`\`\`
```

- [ ] **Step 2：提交**

```bash
git add docs/DEPLOY.md
git commit -m "docs: 部署文档"
```

---

### Task 0.6：安全机制文档

**Files:**
- Create: `docs/SECURITY.md`

- [ ] **Step 1：写安全文档**

```markdown
# 安全机制

## 1. 密码安全
- bcrypt cost=10
- 最低 8 位，强制字母+数字

## 2. 邮箱验证码
- 6 位数字，**10 分钟**有效
- 同邮箱 **60s 冷却**
- 单 IP **10 次/小时**
- 验证后立即失效

## 3. JWT
- HS256，7 天有效
- Payload: `{ id, username, role, iat, exp }`
- 401 → 前端自动跳登录

## 4. 角色
- `user` / `admin`
- 后端 `adminOnly` 中间件
- 前端 `AdminRoute` 双重校验

## 5. 限流
- 全局：100 req / 15min / IP
- 登录：5 次 / 15min / IP
- 验证码：1 次 / 60s，10 次 / hour

## 6. 文件上传
- 仅 pdf/docx/txt
- ≤ 10MB
- 文件名重命名 `时间戳-随机.后缀`
- 不暴露原文件名

## 7. SQL 注入
- 全部走 Prisma（参数化）
- 统计接口用 `$queryRaw` 硬编码 SQL，**不接用户输入**

## 8. XSS
- React 默认转义
- 简历原文只用于 AI，不回显到 HTML
- AI 建议只渲染文本

## 9. CORS
- 通过 `CORS_ORIGIN` 配置白名单
- 生产只允许自己的域名

## 10. HTTP 头
- `helmet()` 中间件

## 11. HTTPS
- Cloudflare 终止 TLS
- 源站不强制 redirect→https（Nginx 处理）

## 12. 错误脱敏
- 生产不返回堆栈
- 统一 `{ "error": "友好提示" }`

## 13. 依赖
- `npm audit`
- 锁定版本

## 14. 自检清单
| 场景 | 期望 |
|------|------|
| 无 token 访问 `/api/upload` | 401 |
| 错 token 访问 | 401 |
| 普通用户访问 `/api/admin/ping` | 403 |
| 错密码 6 次 | 第 6 次 429 |
| 60s 内发 2 次验证码 | 429 |
| 错误验证码注册 | 400 |
| 密码 < 8 位 | 400 |
| 跨域 evil.com | CORS 拒绝 |
```

- [ ] **Step 2：提交**

```bash
git add docs/SECURITY.md
git commit -m "docs: 安全机制"
```

---

### Task 0.7：docker-compose 骨架

**Files:**
- Create: `docker-compose.yml`
- Create: `nginx/default.conf`
- Create: `frontend_dist/.gitkeep`

- [ ] **Step 1：docker-compose.yml**

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: resume-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: resume_optimizer
      TZ: Asia/Shanghai
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - resume-net

  backend:
    build: ./backend
    container_name: resume-backend
    restart: always
    environment:
      DATABASE_URL: mysql://root:${DB_PASSWORD}@mysql:3306/resume_optimizer
      JWT_SECRET: ${JWT_SECRET}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      SMTP_FROM_NAME: ${SMTP_FROM_NAME}
      PORT: 3000
      CORS_ORIGIN: ${CORS_ORIGIN}
    depends_on:
      mysql:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
    networks:
      - resume-net

  nginx:
    image: nginx:alpine
    container_name: resume-nginx
    restart: always
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
      - frontend_dist:/usr/share/nginx/html
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - resume-net

volumes:
  mysql_data:
  uploads:
  frontend_dist:

networks:
  resume-net:
    driver: bridge
```

- [ ] **Step 2：Nginx 配置**

Create `nginx/default.conf`:
```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 12M;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 必须
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
    }
}
```

Create `frontend_dist/.gitkeep` (空文件)。

- [ ] **Step 3：提交**

```bash
git add docker-compose.yml nginx/default.conf frontend_dist/.gitkeep
git commit -m "feat: docker-compose 骨架 + Nginx"
```

---

### Task 0.8：后端 Dockerfile（占位）

**Files:**
- Create: `backend/Dockerfile`

- [ ] **Step 1：Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app

# pdf-parse 需要编译工具
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/app.js"]
```

- [ ] **Step 2：提交**

```bash
git add backend/Dockerfile
git commit -m "build: 后端 Dockerfile 初始版"
```

---

## Phase 1：数据库 + Prisma

### Task 1.1：后端项目初始化 + 依赖

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/app.js`

- [ ] **Step 1：初始化 + 装依赖**

```bash
cd backend
npm init -y
npm pkg set type=module
npm install express cors helmet morgan multer pdf-parse mammoth jsonwebtoken bcrypt dotenv prisma @prisma/client nodemailer express-rate-limit zod
npm install -D nodemon
```

- [ ] **Step 2：完善 scripts**

修改 `backend/package.json`:
```json
"scripts": {
  "dev": "nodemon src/app.js",
  "start": "node src/app.js",
  "prisma:generate": "prisma generate",
  "prisma:push": "prisma db push"
}
```

- [ ] **Step 3：占位 app.js**

Create `backend/src/app.js`:
```javascript
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000, () => console.log('Server started'));
```

- [ ] **Step 4：测试**

```bash
npm run dev
curl http://localhost:3000/health
```

预期: `{"ok":true}`

- [ ] **Step 5：提交**

```bash
git add backend/package.json backend/package-lock.json backend/src/app.js
git commit -m "feat(backend): 初始化 Express + 依赖"
```

---

### Task 1.2：Prisma schema（5 张表）

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1：写 schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  user
  admin
}

enum FileType {
  pdf
  docx
  txt
}

model User {
  id             Int       @id @default(autoincrement())
  username       String    @unique @db.VarChar(50)
  email          String    @unique @db.VarChar(100)
  passwordHash   String    @map("password_hash") @db.VarChar(255)
  role           Role      @default(user)
  createdAt      DateTime  @default(now()) @map("created_at")
  lastActiveAt   DateTime  @default(now()) @map("last_active_at")
  resumes        Resume[]
  @@map("users")
}

model Resume {
  id               Int       @id @default(autoincrement())
  userId           Int       @map("user_id")
  originalFilename String    @map("original_filename") @db.VarChar(255)
  rawText          String    @map("raw_text") @db.LongText
  filePath         String?   @map("file_path") @db.VarChar(500)
  fileType         FileType  @map("file_type")
  createdAt        DateTime  @default(now()) @map("created_at")
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  analysis         Analysis?
  @@index([userId])
  @@index([createdAt])
  @@map("resumes")
}

model Analysis {
  id          Int       @id @default(autoincrement())
  resumeId    Int       @unique @map("resume_id")
  totalScore  Decimal   @map("total_score") @db.Decimal(3, 1)
  resultJson  Json      @map("result_json")
  createdAt   DateTime  @default(now()) @map("created_at")
  resume      Resume    @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  adoptions   Adoption[]
  @@index([createdAt])
  @@map("analyses")
}

model Adoption {
  id              Int       @id @default(autoincrement())
  analysisId      Int       @map("analysis_id")
  dimensionName   String    @map("dimension_name") @db.VarChar(20)
  originalText    String    @map("original_text") @db.Text
  suggestionText  String    @map("suggestion_text") @db.Text
  createdAt       DateTime  @default(now()) @map("created_at")
  analysis        Analysis  @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  @@index([analysisId])
  @@map("adoptions")
}

model EmailVerification {
  id        Int       @id @default(autoincrement())
  email     String    @db.VarChar(100)
  code      String    @db.VarChar(6)
  used      Boolean   @default(false)
  expiresAt DateTime  @map("expires_at")
  createdAt DateTime  @default(now()) @map("created_at")
  @@index([email, code])
  @@map("email_verifications")
}
```

- [ ] **Step 2：推送到 MySQL**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 3：提交**

```bash
git add backend/prisma/schema.prisma backend/package.json
git commit -m "feat(db): Prisma schema + 5 张表"
```

---

### Task 1.3：Prisma Client 单例 + 管理员 SQL

**Files:**
- Create: `backend/src/utils/prisma.js`
- Create: `backend/scripts/promote-admin.sql`
- Create: `backend/prisma/init.sql`

- [ ] **Step 1：单例**

Create `backend/src/utils/prisma.js`:
```javascript
import { PrismaClient } from '@prisma/client';

const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma;
```

- [ ] **Step 2：管理员提升 SQL**

Create `backend/scripts/promote-admin.sql`:
```sql
USE resume_optimizer;
UPDATE users SET role = 'admin' WHERE username = '你的用户名';
SELECT id, username, role FROM users;
```

- [ ] **Step 3：纯 SQL 初始化（与 Prisma 等价，便于不熟 Prisma 的人）**

Create `backend/prisma/init.sql`:
```sql
CREATE DATABASE IF NOT EXISTS resume_optimizer DEFAULT CHARACTER SET utf8mb4;
USE resume_optimizer;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resumes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    raw_text LONGTEXT,
    file_path VARCHAR(500),
    file_type ENUM('pdf', 'docx', 'txt'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS analyses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resume_id INT NOT NULL UNIQUE,
    total_score DECIMAL(3,1),
    result_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS adoptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    analysis_id INT NOT NULL,
    dimension_name VARCHAR(20),
    original_text TEXT,
    suggestion_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE,
    INDEX idx_analysis (analysis_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_verifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100),
    code VARCHAR(6),
    used BOOLEAN DEFAULT FALSE,
    expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_code (email, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 4：测试连接 + 提交**

修改 `app.js` 加测试路由（用完删除）：
```javascript
import prisma from './utils/prisma.js';
app.get('/db-check', async (req, res) => res.json({ users: await prisma.user.count() }));
```

```bash
curl http://localhost:3000/db-check
# 删除 /db-check 后
git add backend/src/utils/prisma.js backend/scripts backend/prisma/init.sql
git commit -m "feat(db): Prisma Client + 管理员 SQL + 纯 SQL 脚本"
```

---

## Phase 2：安全机制

### Task 2.1：bcrypt 密码工具

**Files:**
- Create: `backend/src/utils/password.js`

- [ ] **Step 1：实现**

```javascript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(plain) {
  if (!plain || plain.length < 8) throw new Error('密码至少 8 位');
  if (!/[a-zA-Z]/.test(plain) || !/[0-9]/.test(plain)) {
    throw new Error('密码必须包含字母和数字');
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 2：手测**

```bash
node -e "import('./src/utils/password.js').then(async m => { const h = await m.hashPassword('test1234'); console.log(h, await m.verifyPassword('test1234', h)); })"
```

预期: 60 位 hash + `true`

- [ ] **Step 3：提交**

```bash
git add backend/src/utils/password.js
git commit -m "feat(security): bcrypt 密码哈希与强度校验"
```

---

### Task 2.2：JWT 工具

**Files:**
- Create: `backend/src/utils/jwt.js`

- [ ] **Step 1：实现**

```javascript
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const EXPIRES_IN = '7d';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
```

- [ ] **Step 2：手测 + 提交**

```bash
node -e "import('./src/utils/jwt.js').then(m => { const t = m.signToken({id:1,role:'user'}); console.log(t, m.verifyToken(t)); })"
git add backend/src/utils/jwt.js
git commit -m "feat(security): JWT 签发/验证"
```

---

### Task 2.3：authRequired 中间件（含活跃时间刷新）

**Files:**
- Create: `backend/src/middleware/authRequired.js`

- [ ] **Step 1：实现**

```javascript
import { verifyToken } from '../utils/jwt.js';
import prisma from '../utils/prisma.js';

export default async function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }
  try {
    req.user = verifyToken(auth.slice(7));
    prisma.user.update({
      where: { id: req.user.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}
```

- [ ] **Step 2：测试 + 提交**

在 `app.js` 加 `app.get('/me', authRequired, (req, res) => res.json(req.user))`，测 401 / 200 后删除。

```bash
git add backend/src/middleware/authRequired.js backend/src/app.js
git commit -m "feat(security): authRequired 中间件"
```

---

### Task 2.4：adminOnly 中间件

**Files:**
- Create: `backend/src/middleware/adminOnly.js`

- [ ] **Step 1**

```javascript
export default function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}
```

- [ ] **Step 2：测试 + 提交**

测试 admin / 非 admin 两种 token，预期 200 / 403。

```bash
git add backend/src/middleware/adminOnly.js
git commit -m "feat(security): adminOnly 中间件"
```

---

### Task 2.5：邮件服务（nodemailer）

**Files:**
- Create: `backend/src/services/mailer.js`

- [ ] **Step 1：实现**

```javascript
import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendVerificationCode(email, code) {
  const t = getTransporter();
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1677ff;">${process.env.SMTP_FROM_NAME || 'AI 简历优化器'}</h2>
      <p>您的注册验证码：</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1677ff; padding: 16px; background: #f5f5f5; text-align: center;">${code}</div>
      <p style="color: #888; font-size: 13px;">10 分钟内有效，请勿泄露给他人。</p>
    </div>
  `;
  await t.sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '【注册验证码】AI 简历优化器',
    html,
  });
}
```

- [ ] **Step 2：手测（填 .env 后）**

在 `app.js` 临时加 `/test-mail`，真实邮箱收到 123456 后**删除路由**。

- [ ] **Step 3：提交**

```bash
git add backend/src/services/mailer.js
git commit -m "feat(security): nodemailer 邮件服务"
```

---

### Task 2.6：验证码服务

**Files:**
- Create: `backend/src/services/verification.js`

- [ ] **Step 1：实现（60s 冷却 + 消费即失效）**

```javascript
import prisma from '../utils/prisma.js';
import { sendVerificationCode } from './mailer.js';

const COOLDOWN_SEC = 60;
const EXPIRE_MIN = 10;

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createAndSendCode(email) {
  const last = await prisma.emailVerification.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });
  if (last && (Date.now() - last.createdAt.getTime()) < COOLDOWN_SEC * 1000) {
    const wait = Math.ceil((COOLDOWN_SEC * 1000 - (Date.now() - last.createdAt.getTime())) / 1000);
    throw new Error(`请 ${wait} 秒后再试`);
  }

  const code = genCode();
  await prisma.emailVerification.create({
    data: {
      email,
      code,
      expiresAt: new Date(Date.now() + EXPIRE_MIN * 60 * 1000),
      used: false,
    },
  });
  await sendVerificationCode(email, code);
  return true;
}

export async function consumeCode(email, code) {
  const record = await prisma.emailVerification.findFirst({
    where: { email, code, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return false;
  await prisma.emailVerification.update({
    where: { id: record.id },
    data: { used: true },
  });
  return true;
}
```

- [ ] **Step 2：提交**

```bash
git add backend/src/services/verification.js
git commit -m "feat(security): 验证码服务（生成+消费+冷却）"
```

---

### Task 2.7：auth 路由（send-code / register / login）

**Files:**
- Create: `backend/src/routes/auth.js`

- [ ] **Step 1：完整实现**

```javascript
import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { createAndSendCode, consumeCode } from '../services/verification.js';
import prisma from '../utils/prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';

const router = express.Router();

// 验证码：1 次/60s/邮箱 + 10 次/hour/IP
const sendCodePerEmail = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  keyGenerator: (req) => `${req.ip}:${req.body.email || ''}`,
  message: { error: '请求过于频繁，请 1 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
const sendCodePerIP = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: '单 IP 1 小时内最多发送 10 次' },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailSchema = z.string().email('邮箱格式不正确');

router.post('/send-code', sendCodePerIP, sendCodePerEmail, async (req, res) => {
  const parse = emailSchema.safeParse(req.body.email);
  if (!parse.success) return res.status(400).json({ error: '邮箱格式不正确' });

  const exists = await prisma.user.findUnique({ where: { email: parse.data } });
  if (exists) return res.status(400).json({ error: '该邮箱已注册' });

  try {
    await createAndSendCode(parse.data);
    res.json({ success: true, message: '验证码已发送' });
  } catch (e) {
    res.status(429).json({ error: e.message });
  }
});

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, '用户名只能含字母数字下划线'),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  code: z.string().length(6),
});

router.post('/register', async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.issues[0].message });
  const { username, email, password, code } = parse.data;

  if (!await consumeCode(email, code)) {
    return res.status(400).json({ error: '验证码错误或已过期' });
  }
  const dup = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (dup) return res.status(400).json({ error: '用户名或邮箱已被注册' });

  let hash;
  try {
    hash = await hashPassword(password);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const user = await prisma.user.create({
    data: { username, email, passwordHash: hash, role: 'user' },
    select: { id: true, username: true, email: true, role: true },
  });
  const token = signToken({ id: user.id, username: user.username, role: user.role });
  res.json({ token, user });
});

// 登录：5 次/15min/IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '尝试次数过多，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', loginLimiter, async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: '参数错误' });
  const { username, password } = parse.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
  });
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = signToken({ id: user.id, username: user.username, role: user.role });
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});

export default router;
```

- [ ] **Step 2：挂载 + 测试**

修改 `backend/src/app.js`:
```javascript
import authRouter from './routes/auth.js';
app.use('/api/auth', authRouter);
```

```bash
# 1. 发送
curl -X POST http://localhost:3000/api/auth/send-code -H "Content-Type: application/json" -d '{"email":"alice@example.com"}'
# 2. 注册（替换 CODE）
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"alice","email":"alice@example.com","password":"abc12345","code":"CODE"}'
# 3. 登录
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"alice","password":"abc12345"}'
```

预期: 三个都返回 `{ token, user }`。

- [ ] **Step 3：提交**

```bash
git add backend/src/routes/auth.js backend/src/app.js
git commit -m "feat(security): 认证三件套（send-code/register/login）+ 限流"
```

---

### Task 2.8：全局 Helmet + CORS + 限流 + 错误处理

**Files:**
- Modify: `backend/src/app.js`

- [ ] **Step 1：完整 app.js**

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import prisma from './utils/prisma.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();

app.use(helmet());

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin.split(',').map(s => s.trim()),
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan('dev'));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁' },
}));

app.use('/api/auth', authRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error('[ERR]', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(process.env.PORT || 3000, () => console.log('Server started'));
```

- [ ] **Step 2：测试响应头**

```bash
curl -i http://localhost:3000/health | grep -i "x-content-type"
# 应有 X-Content-Type-Options: nosniff
```

- [ ] **Step 3：提交**

```bash
git add backend/src/app.js
git commit -m "feat(security): Helmet + CORS + 全局限流 + 统一错误处理"
```

---

### Task 2.9：安全自检

- [ ] **Step 1：手测 9 个场景（见 SECURITY.md 自检清单）**

| 场景 | 命令 | 期望 |
|------|------|------|
| 无 token | `curl /api/upload` | 401 |
| 错 token | `curl -H "Authorization: Bearer bad" /api/upload` | 401 |
| 普通用户访问 admin | `curl -H "Authorization: Bearer <user_token>" /api/admin/ping` | 403 |
| 错密码 5 次 | 6th: 429 | |
| 60s 内 2 次 send-code | 2nd: 429 | |
| 错误验证码注册 | 400 | |
| 密码 < 8 位 | 400 | |
| 跨域 Origin: evil.com | CORS 拒绝 | |
| 未配置 .env 启动 | check-env 报错 | |

- [ ] **Step 2：完成所有勾选，无需代码提交**

---

**Phase 0-2 完结。下一步：[后端子计划](AI简历优化器-后端.md)**


