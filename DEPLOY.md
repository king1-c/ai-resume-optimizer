---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 5d6908d095f8a3366f52b612e703c214_53db19bd656e11f18b225254006c9bbf
    ReservedCode1: EmU1OJosLN9Eijs+RA5Px08JrCIhhww3VWovRyVLLscVMCWghRo4wwYY5H5HJBDN35lAka3VPJGSpoOOAYK6Qe7L8EOL1qTNZ1SQ7jU+CyuG/x4lW/VMdEPuC084a/LwpV67L6wEFmrhA9gJyWtbwB14v/foYTAYeGISWESSDPnYFaZUX05V4q87FrY=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 5d6908d095f8a3366f52b612e703c214_53db19bd656e11f18b225254006c9bbf
    ReservedCode2: EmU1OJosLN9Eijs+RA5Px08JrCIhhww3VWovRyVLLscVMCWghRo4wwYY5H5HJBDN35lAka3VPJGSpoOOAYK6Qe7L8EOL1qTNZ1SQ7jU+CyuG/x4lW/VMdEPuC084a/LwpV67L6wEFmrhA9gJyWtbwB14v/foYTAYeGISWESSDPnYFaZUX05V4q87FrY=
---

# AI Resume Optimizer — 完整部署手册

## 目录

1. [准备工作：服务器初始化](#1-准备工作服务器初始化)
2. [安装 Docker 环境](#2-安装-docker-环境)
3. [上传项目代码](#3-上传项目代码)
4. [配置环境变量（.env）](#4-配置环境变量env)
5. [构建并启动所有服务](#5-构建并启动所有服务)
6. [验证部署是否成功](#6-验证部署是否成功)
7. [初始化管理员账户](#7-初始化管理员账户)
8. [配置定时任务（磁盘清理 + 备份）](#8-配置定时任务磁盘清理--备份)
9. [可选：配置 HTTPS 反向代理](#9-可选配置-https-反向代理nginx--lets-encrypt)
10. [可选：配置防火墙](#10-可选配置防火墙)
11. [常用运维命令速查](#11-常用运维命令速查)

---

## 1. 准备工作：服务器初始化

### 1.1 环境要求

| 项目 | 最低 | 推荐 |
|------|------|------|
| 操作系统 | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04 LTS |
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 磁盘 | 3 GB 可用 | 10 GB |
| 开放端口 | 80, 443 / 3000 / 5173, 5174 | 仅暴露 80 / 443 |

### 1.2 创建非 root 用户（安全最佳实践）

```bash
# 创建用户
adduser deployer
usermod -aG sudo deployer

# 配置 SSH Key 登录（在本地电脑执行）
ssh-copy-id deployer@你的服务器IP地址

# 禁用 root SSH 登录和密码认证
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

> 之后所有操作均使用 `ssh deployer@你的服务器IP地址`。

### 1.3 安装 fail2ban（防 SSH 暴力破解）

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban && sudo systemctl start fail2ban
```

### 1.4 更新系统

```bash
apt update && apt upgrade -y
```

### 1.5 安装基础工具

```bash
apt install -y curl wget git vim unzip
```

### 1.5 设置时区

```bash
timedatectl set-timezone Asia/Shanghai
```

---

## 2. 安装 Docker 环境

### 2.1 卸载旧版本

```bash
apt remove -y docker docker-engine docker.io containerd runc
```

### 2.2 安装依赖

```bash
apt install -y ca-certificates gnupg lsb-release
```

### 2.3 添加 Docker 官方 GPG 密钥和仓库

```bash
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 2.4 安装 Docker Engine

```bash
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 2.5 设置开机自启

```bash
systemctl enable docker
systemctl start docker
```

### 2.6 免 sudo 使用 Docker

```bash
sudo usermod -aG docker $USER
```

> 执行完后退出 SSH 重新登录即可生效：
> ```bash
> exit
> ssh deployer@你的服务器IP地址
> ```

---

## 3. 上传项目代码

### 3.1 创建工作目录

```bash
sudo mkdir -p /opt/ai-resume-optimizer
sudo chown -R $USER:$USER /opt/ai-resume-optimizer
```

### 3.2 上传方式

**方式一：从本地用 scp**（在你的本地电脑上执行）

```bash
cd /mnt/c/Users/chenqiuhong/Desktop
tar --exclude='node_modules' --exclude='dist' --exclude='.git' -czf ai-resume.tar.gz "AI Resume Optimizer"
scp ai-resume.tar.gz root@你的服务器IP地址:/opt/
```

然后在服务器上解压：

```bash
cd /opt
tar -xzf ai-resume.tar.gz -C /opt/ai-resume-optimizer --strip-components=1
rm ai-resume.tar.gz
```

**方式二：用 Git 克隆**

```bash
cd /opt
git clone 你的仓库地址 ai-resume-optimizer
```

---

## 4. 配置环境变量（.env）

### 4.1 生成 JWT 密钥

```bash
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 64)"
```

**记录输出**，下一步要用到。

### 4.2 创建 .env 文件

```bash
cd /opt/ai-resume-optimizer
nano .env
```

填入以下内容，**替换所有尖括号内容**：

```env
# ===== 数据库 =====
DB_ROOT_PASSWORD=替换为强密码(12位+大小写+数字+符号)

# ===== JWT =====
JWT_SECRET=粘贴上一步生成的 JWT_SECRET
JWT_REFRESH_SECRET=粘贴上一步生成的 JWT_REFRESH_SECRET

# ===== AI API =====
AI_API_KEY=你的AI_API密钥

# ===== 管理员初始账户 =====
ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为管理后台密码(12位以上)

# ===== CORS =====
ALLOWED_ORIGINS=http://你的服务器IP:5173,http://你的服务器IP:5174

# ===== 可选 =====
MAX_FILE_SIZE=10485760
```

保存：`Ctrl+X` → `Y` → `Enter`

### 4.3 保护 .env 权限

```bash
chmod 600 /opt/ai-resume-optimizer/.env
```

---

## 5. 构建并启动所有服务

### 5.1 构建镜像（3-8 分钟）

```bash
cd /opt/ai-resume-optimizer
docker compose build
```

### 5.2 启动服务

```bash
docker compose up -d
```

### 5.3 等待就绪（30-60 秒）

```bash
docker compose logs -f
```

看到 `✅ 数据库连接成功` + `Server running on port 3000` 即就绪，按 `Ctrl+C` 退出日志。

---

## 6. 验证部署是否成功

### 6.1 容器状态

```bash
docker compose ps
```

4 个容器均应为 `Up`。

### 6.2 后端健康检查

```bash
curl http://localhost:3000/health
```

期望返回：`{"status":"ok", ...}`

### 6.3 数据库健康检查

```bash
curl http://localhost:3000/health/db
```

期望返回：`{"healthy":true, ...}`

### 6.4 浏览器验证

- 用户端：`http://你的服务器IP:5173`
- 管理后台：`http://你的服务器IP:5174`

### 6.5 API 测试

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@1234"}'
```

期望返回：`{"success":true,"message":"注册成功",...}`

---

## 7. 初始化管理员账户

### 7.1 自动创建

后端首次启动时自动用 `.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 创建。

### 7.2 验证管理员登录

```bash
curl -X POST http://localhost:3000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"你的密码"}'
```

返回中包含 `accessToken` 即成功。

### 7.3 访问管理后台

浏览器打开 `http://你的服务器IP:5174`，用管理员账号登录。

---

## 8. 配置定时任务（磁盘清理 + 备份）

> 1G-2G 小磁盘服务器必须配置，否则 2-4 周内磁盘满。

### 8.1 赋予清理脚本执行权限

```bash
chmod +x /opt/ai-resume-optimizer/scripts/docker-cleanup.sh
```

### 8.2 安装 cron

```bash
apt install -y cron
systemctl enable cron && systemctl start cron
```

### 8.3 创建日志目录

```bash
mkdir -p /var/log/docker-cleanup
```

### 8.4 编辑 crontab

```bash
crontab -e
```

> **安全警告**：MySQL 密码绝不能写在 crontab 命令行中（`ps aux` 会暴露）。先创建 `~/.my.cnf` 文件：
> ```bash
> cat > ~/.my.cnf << 'EOF'
> [client]
> user=root
> password=你的数据库密码
> EOF
> chmod 600 ~/.my.cnf
> ```

在文件末尾添加：

```cron
# 每天凌晨 3:00 清理 Docker 镜像/缓存
0 3 * * * /opt/ai-resume-optimizer/scripts/docker-cleanup.sh >> /var/log/docker-cleanup/cleanup.log 2>&1

# 每天凌晨 2:00 备份数据库（密码从 ~/.my.cnf 读取，不暴露在命令行）
0 2 * * * docker exec ai-resume-mysql mysqldump --defaults-extra-file=/root/.my.cnf ai_resume_optimizer | gzip > /backup/db_$(date +\%Y\%m\%d).sql.gz

# 每周日凌晨 4:00 删除 7 天前旧备份
0 4 * * 0 find /backup -name "db_*.sql.gz" -mtime +7 -delete
```

### 8.5 备份 GPG 加密（如需加密备份文件）

```bash
# 生成 GPG 密钥（如无）
gpg --gen-key

# 修改 cron 中的备份行，追加 GPG 加密步骤：
0 2 * * * docker exec ai-resume-mysql mysqldump --defaults-extra-file=/root/.my.cnf ai_resume_optimizer | gzip | gpg --batch --encrypt -r your-gpg-key > /backup/db_$(date +\%Y\%m\%d).sql.gz.gpg 2>/dev/null
```

### 8.6 创建备份目录

```bash
mkdir -p /backup
```

### 8.7 验证

```bash
crontab -l
```

---

## 9. 可选：配置 HTTPS 反向代理（Nginx + Let's Encrypt）

### 9.1 安装 Nginx 和 Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
systemctl enable nginx && systemctl start nginx
```

### 9.2 创建站点配置

```bash
nano /etc/nginx/sites-available/ai-resume
```

```nginx
server {
    listen 80;
    server_name 你的域名.com 管理后台域名.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 你的域名.com;

    ssl_certificate     /etc/letsencrypt/live/你的域名.com/fullchain.pem;
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
    server_name 管理后台域名.com;

    ssl_certificate     /etc/letsencrypt/live/管理后台域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/管理后台域名.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 9.3 启用站点并申请证书

```bash
ln -s /etc/nginx/sites-available/ai-resume /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
certbot --nginx -d 你的域名.com -d 管理后台域名.com
```

### 9.4 更新 ALLOWED_ORIGINS

```bash
nano /opt/ai-resume-optimizer/.env
```

改 `ALLOWED_ORIGINS` 为 `https://你的域名.com,https://管理后台域名.com`，然后：

```bash
cd /opt/ai-resume-optimizer
docker compose restart backend
```

---

## 10. 可选：配置防火墙

```bash
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose
```

---

## 11. 常用运维命令速查

### 服务管理

```bash
cd /opt/ai-resume-optimizer

# 重新构建并启动（代码更新后）
docker compose down && docker compose build && docker compose up -d

# 仅重启后端
docker compose restart backend

# 查看状态
docker compose ps

# 停止所有
docker compose down
```

### 日志

```bash
docker compose logs -f                    # 全部实时
docker compose logs -f backend            # 仅后端
docker compose logs --tail=100 backend    # 最近 100 行
```

### 数据库

```bash
# 进入 MySQL
docker exec -it ai-resume-mysql mysql -uroot -p你的密码 ai_resume_optimizer

# 常用 SQL
SHOW TABLES;
SELECT COUNT(*) FROM User;
SELECT id, username, email, createdAt FROM User ORDER BY createdAt DESC LIMIT 10;
```

### 磁盘

```bash
df -h                           # 磁盘使用总览
du -sh /var/lib/docker/*        # Docker 占用
docker system prune -f          # 清理未使用资源
```

### 故障排查

```bash
docker logs ai-resume-backend --tail=200
ss -tlnp | grep -E '3000|3306|5173|5174'
docker stats --no-stream
docker exec ai-resume-backend printenv | grep -E 'JWT|AI|DATABASE|ALLOWED'
```

---

## 附录：项目架构

```
浏览器
  ├─ :5173 → frontend-user  (React → /api/* 代理 → backend:3000)
  └─ :5174 → frontend-admin (React → /api/* 代理 → backend:3000)
                                              │
                                              ▼
                                          MySQL 8.0
```

- **backend**：Express + TypeScript + Prisma，端口 3000
- **frontend-user / admin**：React + Vite + Nginx 静态服务，端口 5173 / 5174
- **mysql**：MySQL 8.0，端口 3306
*（内容由AI生成，仅供参考）*
