# AI Resume Optimizer - 后端服务

基于 Node.js + Express + Prisma + MySQL 的安全后端服务。

## 安全特性

- **Helmet 安全头**: CSP、HSTS、XSS 防护等
- **JWT 认证**: 访问令牌 + 刷新令牌双令牌机制
- **bcrypt 密码哈希**: 12轮盐值加密
- **速率限制**: 基于 express-rate-limit 的 IP 级别限流
- **IP 封禁**: 自动检测恶意请求并封禁 IP
- **CORS 白名单**: 只允许指定域名访问
- **审计日志**: 完整的操作记录
- **SQL 注入防护**: Prisma ORM 参数化查询
- **输入验证**: Zod 模式验证

## 项目结构

```
src/
├── config/
│   ├── database.ts    # Prisma 数据库配置
│   ├── env.ts         # 环境变量验证
│   └── logger.ts      # Winston 日志配置
├── controllers/
│   └── authController.ts  # 认证控制器
├── middleware/
│   ├── auth.ts        # JWT 认证中间件
│   └── security.ts    # 安全中间件（Helmet、CORS、速率限制、IP封禁）
├── routes/
│   ├── auth.ts        # 认证路由
│   └── index.ts       # 路由聚合
├── utils/
│   ├── jwt.ts         # JWT 工具函数
│   ├── password.ts    # 密码哈希与验证
│   └── ipBlocker.ts   # IP 封禁管理
├── prisma/
│   └── schema.prisma  # 数据库模型定义
└── index.ts           # 应用入口
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate dev --name init

# （可选）填充初始数据
npx prisma db seed
```

### 4. 启动开发服务器

```bash
npm run dev
```

### 5. 生产部署

```bash
npm run build
npm start
```

## API 文档

### 认证接口

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/v1/auth/register | 用户注册 | 否 |
| POST | /api/v1/auth/login | 用户登录 | 否 |
| POST | /api/v1/auth/admin/login | 管理员登录 | 否 |
| POST | /api/v1/auth/refresh | 刷新令牌 | 否 |
| POST | /api/v1/auth/logout | 用户登出 | 是 |
| GET | /api/v1/auth/me | 获取当前用户 | 是 |

### 请求/响应示例

#### 注册

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

响应：
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
}
```

#### 登录

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123!"
  }'
```

#### 获取当前用户

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 安全中间件说明

### IP 封禁机制

- 失败尝试阈值：10次（可配置）
- 封禁时长：1小时（可配置）
- 自动清理：每6小时清理过期封禁记录

### 速率限制

- 普通接口：每15分钟100次请求
- 登录接口：每15分钟5次请求
- 成功登录后重置计数

### CORS 配置

只允许白名单中的域名访问 API，防止 CSRF 攻击。

## 数据库模型

### 用户表 (users)
- 基础信息：id, username, email, password
- 状态：isActive, isVerified
- 时间戳：createdAt, updatedAt, lastLoginAt

### 管理员表 (admins)
- 基础信息：id, username, password
- 角色：role (SUPER_ADMIN/ADMIN/MODERATOR)
- 状态：isActive

### 简历表 (resumes)
- 文件信息：originalName, filePath, fileSize, mimeType
- 解析内容：content, parsedData
- 关联用户

### 分析表 (analyses)
- AI分析结果：score, suggestions, optimizedContent
- 状态：status (PENDING/PROCESSING/COMPLETED/FAILED)
- 元数据：aiModel, tokensUsed, processingTime

### 刷新令牌表 (refresh_tokens)
- 令牌管理：token, expiresAt, revokedAt
- 关联用户或管理员

### 登录日志表 (login_logs)
- 审计信息：ipAddress, userAgent, location
- 结果：success, failReason

### 系统日志表 (system_logs)
- 日志级别：level, category
- 详细信息：message, metadata

### IP封禁表 (blocked_ips)
- IP地址：ipAddress
- 封禁原因：reason
- 过期时间：expiresAt

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | development |
| PORT | 服务端口 | 3000 |
| DATABASE_URL | 数据库连接字符串 | - |
| JWT_SECRET | JWT 签名密钥 | - |
| JWT_REFRESH_SECRET | 刷新令牌密钥 | - |
| RATE_LIMIT_MAX_REQUESTS | 速率限制次数 | 100 |
| IP_BLOCK_THRESHOLD | IP封禁阈值 | 10 |
| CORS_ORIGIN | 允许的跨域来源 | - |
