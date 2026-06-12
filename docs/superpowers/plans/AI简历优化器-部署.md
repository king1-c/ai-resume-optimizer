# AI 简历优化器 — 部署子计划（Phase 7）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 部署到阿里云 ECS + Cloudflare，包含 Docker Compose 编排、Nginx 反代、Cloudflare CDN、运维脚本。

**前置:**
- [主计划 Phase 0-2](AI简历优化器.md) 完成
- [后端 Phase 3-4](AI简历优化器-后端.md) 完成
- [前端 Phase 5-6](AI简历优化器-前端.md) 完成
- 已有阿里云 ECS（Ubuntu 22.04）+ 一个域名 + Cloudflare 账号

---

## Task 7.1：确认/修正后端 Dockerfile

**Files:**
- Modify: `backend/Dockerfile`

- [ ] **Step 1：确认 Dockerfile 内容**

应已在主计划 Task 0.8 中创建。内容：

```dockerfile
FROM node:20-alpine
WORKDIR /app

# pdf-parse 编译依赖
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 3000

# 启动时 push schema（首次/无迁移场景），再启服务
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/app.js"]
```

> **生产建议**：v1.1 改用 `prisma migrate deploy` 替代 `db push`，避免误改。

- [ ] **Step 2：本地 build 验证**

```bash
cd backend
docker build -t resume-backend:test .
# 验证镜像可启动（需要 MySQL）
```

- [ ] **Step 3：提交（如有修改）**

```bash
git add backend/Dockerfile
git commit -m "build: 确认后端 Dockerfile" --allow-empty
```

---

## Task 7.2：前端 Dockerfile（v2 多阶段构建）

> **v1 简化决策**：服务器上 `npm run build` + `docker cp` 到 nginx 容器即可。
> **v2 改进**：用多阶段构建把前端也容器化。

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx-spa-fallback.conf`

- [ ] **Step 1：Dockerfile**

```dockerfile
# 构建阶段
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/nginx-spa-fallback.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 2：SPA fallback 配置**

Create `frontend/nginx-spa-fallback.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3：docker-compose.yml 增加 frontend 服务（v2 启用时）**

> v1 不接入 compose，v2 时把下面的 yaml 片段并入 `docker-compose.yml`：

```yaml
  frontend:
    build: ./frontend
    container_name: resume-frontend
    restart: always
    networks:
      - resume-net
    # 不暴露端口，由外部 nginx 统一入口
```

> 接入后需要把主 `nginx` 服务改为只做反代，前端独立服务；同时 `frontend_dist` 卷删除。

- [ ] **Step 4：本地 build 验证（v1 暂不必要）**

```bash
cd frontend
docker build -t resume-frontend:test .
docker run -d -p 8080:80 resume-frontend:test
curl http://localhost:8080
```

- [ ] **Step 5：提交**

```bash
git add frontend/Dockerfile frontend/nginx-spa-fallback.conf
git commit -m "build(frontend): 多阶段 Docker 构建（v2）"
```

---

## Task 7.3：补充 Cloudflare 文档

**Files:**
- Create: `docs/CLOUDFLARE.md`

- [ ] **Step 1：写**

```markdown
# Cloudflare 配置

## 1. 添加站点
1. 登录 https://dash.cloudflare.com
2. "Add a Site" → 输入 `yourdomain.com`
3. 选 **Free** 计划

## 2. 修改 NS 记录
1. Cloudflare 会分配两个 NS（如 `xxx.ns.cloudflare.com`）
2. 去万网域名控制台 → DNS 修改 → 把 NS 改为 Cloudflare 给的
3. 等 1-24 小时生效（一般 30 分钟内）

## 3. 添加 A 记录
| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A    | @    | 你的 ECS 公网 IP | Proxied（橙色云朵） |
| A    | www  | 你的 ECS 公网 IP | Proxied |

## 4. SSL/TLS
- 模式：**Full**（不用 Full Strict，因为源站无证书）
- Edge Certificates → Always Use HTTPS: **ON**
- 启用 HSTS（推荐）

## 5. 性能优化
- Auto Minify: HTML / CSS / JS 全开
- Brotli: ON
- 缓存：默认即可

## 6. 防火墙
- Security → WAF：保持默认
- 可加 Rate Limiting Rules 限流

## 7. 验证
1. 浏览器访问 `https://yourdomain.com`
2. 地址栏显示锁 + 证书有效
3. Network 面板：响应头有 `cf-cache-status`、`server: cloudflare`

## 8. 故障排查
- **525/526 错误**：SSL 模式问题，源站无证书时必须用 **Full** 而非 **Full Strict**
- **521 错误**：源站不通，检查安全组 80/443 是否开放
- **DNS 污染**：换 DNS 1.1.1.1 测试
```

- [ ] **Step 2：提交**

```bash
git add docs/CLOUDFLARE.md
git commit -m "docs: Cloudflare 配置指南"
```

---

## Task 7.4：阿里云 ECS 部署文档

**Files:**
- Create: `docs/ALIYUN.md`

- [ ] **Step 1：写**

```markdown
# 阿里云 ECS 部署

## 1. 购买
- 规格：2 核 2G / 40G 系统盘 / 1M 带宽（学生机或活动机约 99 元/年）
- 镜像：Ubuntu 22.04 LTS
- 区域：选离你最近的

## 2. 安全组
进 ECS 控制台 → 实例 → 安全组 → 配置规则：

| 端口 | 协议 | 用途 | 来源 |
|------|------|------|------|
| 22   | TCP  | SSH  | 你的 IP / 0.0.0.0/0 |
| 80   | TCP  | HTTP | 0.0.0.0/0 |
| 443  | TCP  | HTTPS| 0.0.0.0/0 |

> **不要**开放 3306（MySQL 只在 docker 内网）

## 3. 初始化服务器
\`\`\`bash
ssh root@你的公网IP

# 更新
apt update && apt upgrade -y

# 创建非 root 用户（推荐）
adduser deploy
usermod -aG sudo deploy
# 复制 SSH 公钥到 deploy 家目录
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 装 Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 让 deploy 能用 docker
usermod -aG docker deploy

# 测试
su - deploy
docker --version
docker compose version
\`\`\`

## 4. 部署代码
\`\`\`bash
cd /opt
sudo git clone <仓库地址> resume-optimizer
sudo chown -R deploy:deploy resume-optimizer
cd resume-optimizer

# 复制环境变量
cp .env.example .env
nano .env
# 填入：
#   DB_PASSWORD = 强密码
#   JWT_SECRET  = 至少 32 位随机串（openssl rand -hex 32）
#   DEEPSEEK_API_KEY = sk-xxx
#   SMTP_*     = 真实邮箱
#   CORS_ORIGIN = https://yourdomain.com

chmod 600 .env
\`\`\`

## 5. 启动
\`\`\`bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
# 看到 "Server started" 表示成功
\`\`\`

## 6. 部署前端（v1 简化）
\`\`\`bash
cd /opt/resume-optimizer/frontend
npm install
npm run build
docker cp dist/. resume-nginx:/usr/share/nginx/html/
docker compose restart nginx
\`\`\`

## 7. 提升管理员
\`\`\`bash
docker compose exec mysql mysql -uroot -p
> USE resume_optimizer;
> UPDATE users SET role = 'admin' WHERE username = '你的用户名';
> exit
\`\`\`
重新登录该账号，侧边栏应出现管理菜单。

## 8. 配置 Cloudflare
参见 [CLOUDFLARE.md](CLOUDFLARE.md)，配置完访问 `https://yourdomain.com`。

## 9. 备份（强烈推荐）
\`\`\`bash
# 创建备份脚本
sudo nano /opt/backup.sh
\`\`\`

写入：
\`\`\`bash
#!/bin/bash
BACKUP_DIR=/backup
mkdir -p \$BACKUP_DIR
cd /opt/resume-optimizer
docker compose exec -T mysql mysqldump -uroot -p\${DB_PASSWORD} resume_optimizer \
  > \$BACKUP_DIR/resume_\$(date +\%F).sql
# 保留最近 7 天
find \$BACKUP_DIR -name "resume_*.sql" -mtime +7 -delete
\`\`\`

\`\`\`bash
chmod +x /opt/backup.sh
# 每天凌晨 3 点备份
(crontab -l 2>/dev/null; echo "0 3 * * * DB_PASSWORD=<your_pwd> /opt/backup.sh") | crontab -
\`\`\`

## 10. 监控（可选 v2）
- UptimeRobot 免费监控 `https://yourdomain.com/health`
- Sentry 错误上报（前端 + 后端）
```

- [ ] **Step 2：提交**

```bash
git add docs/ALIYUN.md
git commit -m "docs: 阿里云 ECS 部署详细步骤"
```

---

## Task 7.5：部署检查清单

**Files:**
- Create: `docs/DEPLOY-CHECKLIST.md`

- [ ] **Step 1：写**

```markdown
# 部署检查清单

## 代码 & 配置
- [ ] `.env` 已填真实值（`grep change_me .env` 无输出）
- [ ] `JWT_SECRET` ≥ 32 位（用 `openssl rand -hex 32` 生成）
- [ ] `DEEPSEEK_API_KEY` 有效
- [ ] SMTP 真实授权码
- [ ] `CORS_ORIGIN` = 生产域名
- [ ] `.env` 权限 `chmod 600`

## 服务器安全
- [ ] SSH 改密钥登录（禁用密码）
- [ ] fail2ban 已装（可选）
- [ ] 系统自动更新开启
- [ ] MySQL 3306 不对外

## 部署
- [ ] `docker compose up -d --build` 三个服务都 Up
- [ ] `docker compose logs backend | grep -i error` 无 ERROR
- [ ] `curl http://127.0.0.1:3000/health` → `{"ok":true}`
- [ ] 浏览器访问公网 IP → 看到登录页
- [ ] 前端 dist 已同步到 nginx 容器

## 功能冒烟
- [ ] 注册新账号 → 收到验证码 → 注册成功
- [ ] 上传 PDF → 看到 SSE 流式输出
- [ ] 雷达图 + 5 维度建议正确显示
- [ ] 采纳建议 + 导出文件
- [ ] 历史记录列表正常
- [ ] SQL 改 role='admin' 后侧边栏多 3 项
- [ ] 数据面板 4 卡片数字正确
- [ ] 简历管理评分筛选 + 删除

## Cloudflare
- [ ] DNS 已切到 Cloudflare NS
- [ ] A 记录 Proxied
- [ ] SSL/TLS = Full
- [ ] Always Use HTTPS = ON
- [ ] `https://yourdomain.com` 锁图标正常
- [ ] 响应头有 `cf-cache-status`

## 备份
- [ ] crontab 已设每日 MySQL dump
- [ ] 测试手动恢复一次（`docker compose exec -T mysql mysql ... < backup.sql`）

## 监控
- [ ] UptimeRobot 监控 `/health`（可选）
- [ ] Sentry 接入（可选）
```

- [ ] **Step 2：提交**

```bash
git add docs/DEPLOY-CHECKLIST.md
git commit -m "docs: 部署检查清单"
```

---

## Task 7.6：健康检查端点（确认存在）

- [ ] **Step 1：确认 `/health`**

`backend/src/app.js` 中应已有：
```javascript
app.get('/health', (req, res) => res.json({ ok: true }));
```

如缺失则在 app.js 中加入（在路由挂载之后、错误处理之前）。

- [ ] **Step 2：测试**

```bash
curl http://localhost:3000/health
# {"ok":true}
```

- [ ] **Step 3：提交（如有改动）**

```bash
git add backend/src/app.js
git commit -m "feat(ops): 确认 /health 端点" --allow-empty
```

---

## Task 7.7：CI 脚本（可选 v2）

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1：GitHub Actions 部署脚本（v2 接入）**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Copy to server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          source: "."
          target: /opt/resume-optimizer

      - name: Build & restart
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/resume-optimizer
            git pull
            docker compose up -d --build
            cd frontend && npm install && npm run build
            docker cp dist/. resume-nginx:/usr/share/nginx/html/
            docker compose restart nginx
```

> 需要在 GitHub 仓库 Settings → Secrets 配置 `SERVER_HOST` / `SERVER_USER` / `SSH_KEY`。
> **v1 不必做**，手动部署即可。

- [ ] **Step 2：提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: 部署脚本（v2）"
```

---

## Task 7.8：上线冒烟（生产环境）

- [ ] **Step 1：访问 `https://yourdomain.com`**
  - 看到登录页
  - F12 Network 响应头有 `cf-cache-status: HIT/MISS`

- [ ] **Step 2：注册 + 上传 + 分析全流程**
  - 注册 → 收验证码 → 登录
  - 上传 → 看到流式输出 → 雷达图
  - 采纳 + 导出

- [ ] **Step 3：管理端冒烟**
  - SQL 提升 admin
  - 重新登录 → 侧边栏多 3 项
  - 数据面板 4 卡片
  - 简历管理删除一条

- [ ] **Step 4：监控数据**
  - `docker compose stats` 看 CPU/内存
  - MySQL 数据量 (`SELECT COUNT(*) FROM resumes;`)

---

## Phase 7 完结 🎉

至此整个项目从 0 到上线完成。

### 7 个核心文件清单
- [README.md](../README.md) - 项目总览
- [docs/API.md](API.md) - API 文档
- [docs/DEPLOY.md](DEPLOY.md) - 部署文档（精简版）
- [docs/ALIYUN.md](ALIYUN.md) - 阿里云详细步骤
- [docs/CLOUDFLARE.md](CLOUDFLARE.md) - Cloudflare 配置
- [docs/SECURITY.md](SECURITY.md) - 安全机制
- [docs/DEPLOY-CHECKLIST.md](DEPLOY-CHECKLIST.md) - 上线检查

### 后续可选优化（v2 路线）
- [ ] HTTPS 源站证书（certbot）+ Nginx 301
- [ ] Redis 存 session / 限流计数
- [ ] DeepSeek 失败重试 / 限流（避免超额）
- [ ] PDF 解析改用云服务（更准）
- [ ] 前端 Dockerfile 多阶段构建接入 compose
- [ ] 简历评分详情 PDF 导出
- [ ] 管理员操作日志
- [ ] Sentry 错误监控
- [ ] CI/CD 自动化部署


