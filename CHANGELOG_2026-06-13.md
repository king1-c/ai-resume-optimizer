# AI Resume Optimizer - 2026-06-13 修改与部署记录

**日期**: 2026-06-13
**操作人**: AI Assistant
**目的**: 修复安全漏洞、Bug修复、优化功能，并准备重新部署

---

## 一、今日操作概览

1. **安全审计**: 对全栈项目进行全面的安全审计
2. **Bug修复**: 修复用户反馈的 3 个主要问题
3. **安全加固**: 修复 Critical 和 High 级别安全问题
4. **GitHub推送**: 将修复后的代码推送到仓库
5. **AI配置调试**: 排查并修复 AI 分析失败问题

---

## 二、安全审计报告

**审计范围**: 后端(Node.js/Express) + 前端(React) + Docker部署
**发现问题**: 2 Critical + 3 High + 6 Medium + 5 Low + 4 Info
**报告文件**: [security_audit_report.md](file:///c:/Users/chenqiuhong/Desktop/AI%20Resume%20Optimizer/security_audit_report.md)

### 关键风险摘要

| 级别 | 问题 | 位置 |
|------|------|------|
| **Critical** | 前端 JWT 存储在 localStorage，XSS可导致会话劫持 | `frontend-user/src/store.ts` |
| **Critical** | 管理员创建接口未校验密码强度 | `backend/src/controllers/adminController.ts` |
| **High** | nginx 仅监听 HTTP 80 端口，无 HTTPS | `nginx-gateway.conf` |
| **High** | 文件上传原始文件名未过滤路径遍历 | `backend/src/controllers/resumeController.ts` |
| **High** | AI API 密钥以明文环境变量注入容器 | `docker-compose.yml` |

---

## 三、Bug修复详情

### 3.1 修复后台管理 IP 地址显示虚假（Critical）

**问题**: 后台显示的用户 IP 是代理内网 IP（172.x/192.168.x），非真实客户端 IP

**根因**: `getClientIP()` 仅使用 `req.ip`，在 Nginx/Docker 代理下无法获取原始 IP

**修复文件**: `backend/src/middleware/security.ts`

**修复内容**:
- 重构 `getClientIP()`，优先从 `X-Forwarded-For` 获取
- 遍历 IP 列表，跳过内网地址（10.x, 172.16-31.x, 192.168.x, 127.x）
- 新增 `isPrivateIP()` 辅助函数
- 支持 IPv6-mapped IPv4 规范化

```typescript
// 修复后代码示例
export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwardedStr.split(',').map(ip => ip.trim()).filter(ip => ip && ip !== 'unknown');
    for (const ip of ips) {
      const cleanIP = ip.replace(/^::ffff:/, '');
      if (!isPrivateIP(cleanIP)) return cleanIP;
    }
  }
  // ... 回退逻辑
}
```

---

### 3.2 优化 IP 封禁策略（High）

**问题**: 管理员正常操作后台时被频繁封禁

**修复文件**:
- `backend/src/config/env.ts`
- `backend/src/middleware/security.ts`

**修复内容**:
1. **放宽默认阈值**:
   - `IP_BLOCK_THRESHOLD`: 10 → 20（失败次数翻倍）
   - `IP_BLOCK_DURATION`: 3600000ms → 1800000ms（封禁时间减半）

2. **管理员接口跳过速率限制**:
   ```typescript
   skip: (req: Request) => {
     if (req.path.startsWith('/api/admin')) return true;
     // ...
   }
   ```

3. **登录限流不封禁管理员**:
   ```typescript
   const isAdminLogin = username.toLowerCase().startsWith('admin') || username.length < 3;
   if (!isAdminLogin) {
     ipBlocker.recordFailure(ip, '登录请求过于频繁');
   }
   ```

---

### 3.3 修复简历上传后无法分析（High）

**问题**: 部分用户上传简历后 AI 分析返回失败

**根因**:
1. PDF 文本提取失败（扫描版/图片 PDF）
2. AI 返回 JSON 格式不规范，解析器容错不足
3. 空内容直接传入 AI

**修复文件**:
- `backend/src/controllers/resumeController.ts`
- `backend/src/services/ai/analyzer.ts`
- `backend/src/services/ai/client.ts`

**修复内容**:
1. **上传时检查文本提取**:
   ```typescript
   if (!content || content.trim().length === 0) {
     fs.unlinkSync(file.path);
     res.status(400).json({
       error: '无法从文件中提取文本内容，请上传包含可识别文本的 PDF 或 TXT 文件',
       code: 'TEXT_EXTRACTION_FAILED',
     });
     return;
   }
   ```

2. **增强 AI JSON 解析**:
   - 去除 BOM 头（`\uFEFF`）
   - 验证 `overallScore` 字段存在且为数字
   - 使用 `Array.isArray()` 和 `typeof` 类型检查
   - 增加详细错误日志（记录返回内容前 200 字符）

3. **API Key 配置确认日志**:
   ```typescript
   logger.info(`AI API 已配置，Key 后缀: ...${this.apiKey.slice(-4)}`);
   ```

---

## 四、安全加固详情

### 4.1 管理员创建密码强度校验（Critical）

**修复文件**: `backend/src/controllers/adminController.ts`

**修复内容**: 创建管理员时强制检查密码强度

```typescript
import { hashPassword, checkPasswordStrength } from '@/utils/password';
// ...
const strengthCheck = checkPasswordStrength(password);
if (!strengthCheck.isStrong) {
  res.status(400).json({
    error: '密码强度不足',
    code: 'WEAK_PASSWORD',
    details: strengthCheck.feedback,
  });
  return;
}
```

---

### 4.2 简历预览权限控制（Medium）

**修复文件**:
- `backend/src/controllers/resumeController.ts`
- `backend/src/routes/resume.ts`

**修复内容**: 增加所有权校验，防止遍历他人简历

```typescript
const userId = req.user?.userId;
const userRole = req.user?.role;

if (userRole !== 'admin' && resume.userId !== userId) {
  res.status(403).json({ error: '无权访问此简历', code: 'FORBIDDEN' });
  return;
}
```

路由增加认证：
```typescript
router.get('/preview/:id', authenticateToken, previewResume);
```

---

### 4.3 文件名路径遍历防护（Medium）

**修复文件**: `backend/src/controllers/resumeController.ts`

**修复内容**: 过滤路径遍历字符

```typescript
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\x00/g, '');
}
// 使用：sanitizeFilename(safeDecodeFilename(file.originalname))
```

---

### 4.4 Content-Disposition 安全编码（Low）

**修复内容**: 使用 RFC 5987 编码格式

```typescript
// 修复前
res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resume.originalName)}"`);

// 修复后
res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(resume.originalName)}`);
```

---

## 五、AI 配置调试记录

### 问题排查过程

| 时间 | 错误 | 原因 | 修复 |
|------|------|------|------|
| 10:30 | `Invalid model name: agnes-2.0-flash` | 模型名称大小写错误 | 改为 `Agnes-2.0-Flash` |
| 10:32 | `fetch failed: ENOTFOUND api.agnes.ai` | BASE_URL 错误 | 恢复为 `apihub.agnes-ai.com` |
| 10:34 | `No available channel for model Agnes-2.0-Flash` | 服务商模型名称全小写 | 改回 `agnes-2.0-flash` |

### 最终正确配置

```env
AI_API_KEY=sk-I3lQ5rsJhxkaSxsxptTBmbq66lwJqOemTznH277saBjFEJz3
AI_MODEL=agnes-2.0-flash
AI_BASE_URL=https://apihub.agnes-ai.com/v1
```

> **注意**: `.env` 文件包含真实 API 密钥，**绝对不要提交到 GitHub**。已在 `.gitignore` 中排除。

---

## 六、GitHub 推送记录

**仓库**: https://github.com/king1-c/ai-resume-optimizer

**提交信息**: `fix(security): fix IP retrieval, IP blocking, resume analysis, and security issues`

**修改文件**（9 个）:
1. `backend/src/config/env.ts` - 放宽 IP 封禁阈值
2. `backend/src/controllers/adminController.ts` - 密码强度校验
3. `backend/src/controllers/resumeController.ts` - 文本检查 + 权限 + 文件名过滤
4. `backend/src/middleware/security.ts` - IP 获取 + 速率限制优化
5. `backend/src/routes/resume.ts` - 预览接口认证
6. `backend/src/services/ai/analyzer.ts` - JSON 解析健壮性
7. `backend/src/services/ai/client.ts` - API Key 日志
8. `FIXES_2025-01-12.md` - 修复记录文档
9. `security_audit_report.md` - 安全审计报告

**隐私检查**: 已确认 `.env` 文件未被包含在提交中

---

## 七、重新部署步骤

### 7.1 服务器准备

```bash
# 连接服务器
ssh root@你的服务器IP

# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git vim unzip

# 设置时区
timedatectl set-timezone Asia/Shanghai
```

### 7.2 安装 Docker

```bash
# 卸载旧版本
apt remove -y docker docker-engine docker.io containerd runc

# 安装依赖
apt install -y ca-certificates gnupg lsb-release

# 添加 Docker 官方 GPG 密钥和仓库
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 设置开机自启
systemctl enable docker
systemctl start docker
```

### 7.3 上传项目代码

```bash
# 创建工作目录
mkdir -p /opt/ai-resume-optimizer
cd /opt/ai-resume-optimizer

# 从 GitHub 克隆（推荐）
git clone https://github.com/king1-c/ai-resume-optimizer.git .

# 或者从本地 scp 上传
# scp -r "AI Resume Optimizer"/* root@服务器IP:/opt/ai-resume-optimizer/
```

### 7.4 配置环境变量

```bash
cd /opt/ai-resume-optimizer

# 生成 JWT 密钥
openssl rand -hex 64  # 记录输出作为 JWT_SECRET
openssl rand -hex 64  # 记录输出作为 JWT_REFRESH_SECRET

# 创建 .env 文件
nano backend/.env
```

**backend/.env 内容模板**:

```env
# 服务器配置
NODE_ENV=production
PORT=3000

# 数据库配置
DATABASE_URL="mysql://root:你的数据库密码@mysql:3306/ai_resume_optimizer?schema=public&connection_limit=10"

# JWT 配置
JWT_SECRET=上一步生成的64位十六进制字符串
JWT_REFRESH_SECRET=上一步生成的64位十六进制字符串
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# 管理员账号
ADMIN_USERNAME=你的管理员用户名
ADMIN_PASSWORD=你的强密码(12位以上)
ADMIN_EMAIL=admin@yourdomain.com

# AI API 配置
AI_API_KEY=你的AI_API密钥
AI_MODEL=agnes-2.0-flash
AI_BASE_URL=https://apihub.agnes-ai.com/v1

# 速率限制配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_LOGIN_MAX=5

# IP 封禁配置（已优化，比默认值更宽松）
IP_BLOCK_THRESHOLD=20
IP_BLOCK_DURATION=1800000

# CORS 配置
ALLOWED_ORIGINS=https://你的域名.com,https://admin.你的域名.com

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
```

**根目录 .env 内容模板**（Docker Compose 使用）:

```env
# 数据库
DB_ROOT_PASSWORD=你的数据库root密码

# 后端环境变量会自动从 backend/.env 读取
```

### 7.5 构建并启动

```bash
cd /opt/ai-resume-optimizer

# 构建镜像
docker compose build

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f
```

### 7.6 验证部署

```bash
# 容器状态
docker compose ps

# 健康检查
curl http://localhost:3000/health
curl http://localhost:3000/health/db

# 测试注册
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test@1234"}'
```

### 7.7 配置 Nginx + HTTPS（生产环境必需）

```bash
# 安装 Nginx 和 Certbot
apt install -y nginx certbot python3-certbot-nginx

# 创建站点配置
nano /etc/nginx/sites-available/ai-resume
```

**nginx 配置**:

```nginx
server {
    listen 80;
    server_name 你的域名.com www.你的域名.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 你的域名.com;

    ssl_certificate /etc/letsencrypt/live/你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name admin.你的域名.com;

    ssl_certificate /etc/letsencrypt/live/admin.你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.你的域名.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 启用站点
ln -s /etc/nginx/sites-available/ai-resume /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 申请 SSL 证书
certbot --nginx -d 你的域名.com -d www.你的域名.com -d admin.你的域名.com
```

---

## 八、部署后检查清单

- [ ] 所有容器运行正常 (`docker compose ps`)
- [ ] 后端健康检查通过 (`/health` 和 `/health/db`)
- [ ] 用户端可以正常访问和注册
- [ ] 管理后台可以正常登录
- [ ] 简历上传功能正常
- [ ] AI 分析功能正常（上传 PDF 后能得到分析结果）
- [ ] HTTPS 证书有效
- [ ] 后台管理显示正确的用户 IP 地址
- [ ] 管理员操作不会被 IP 封禁

---

## 九、重要提醒

1. **隐私文件**: `.env`、`.env.local`、`uploads/`、`logs/` 已配置在 `.gitignore` 中，不会提交到 GitHub
2. **API 密钥**: `AI_API_KEY` 是敏感信息，仅在服务器 `.env` 中配置，不要泄露
3. **数据库密码**: 使用强密码（12位以上，包含大小写字母、数字、符号）
4. **JWT 密钥**: 生产环境必须使用 `openssl rand -hex 64` 生成随机密钥
5. **防火墙**: 生产环境建议配置 UFW，仅开放 22/80/443 端口
6. **备份**: 建议配置定时任务备份数据库

---

## 十、相关文档

- [README.md](file:///c:/Users/chenqiuhong/Desktop/AI%20Resume%20Optimizer/README.md) - 项目说明
- [DEPLOY.md](file:///c:/Users/chenqiuhong/Desktop/AI%20Resume%20Optimizer/DEPLOY.md) - 完整部署手册
- [security_audit_report.md](file:///c:/Users/chenqiuhong/Desktop/AI%20Resume%20Optimizer/security_audit_report.md) - 安全审计报告
