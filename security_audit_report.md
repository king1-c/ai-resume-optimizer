# AI Resume Optimizer 安全审计报告

**审计日期**: 2026-06-12  
**审计范围**: 全栈 TypeScript/JavaScript 项目（后端 + 前端 + 部署）  
**审计维度**: 认证与授权、输入验证、安全头部、敏感数据保护、访问控制、文件上传、依赖安全、Docker/部署安全、前端安全

---

## 执行摘要

本次安全审计对 AI Resume Optimizer 项目进行了全面的安全评估。项目整体安全基础较好，采用了 Prisma ORM、bcrypt 密码哈希、JWT 令牌、Helmet 安全头、速率限制、IP 封禁等安全措施。但仍发现 **2 个 Critical、3 个 High、6 个 Medium、5 个 Low 和 4 个 Info** 级别的安全问题，需要尽快修复。

**关键风险**: 前端存储 JWT 令牌存在 XSS 泄露风险、管理员创建接口缺乏密码强度校验、nginx 配置缺少 HTTPS/安全头、文件上传路径遍历风险、AI API 密钥通过环境变量注入容器。

---

## 发现详情

### Critical

#### C1: 前端 localStorage 存储 JWT 令牌 — XSS 攻击可导致会话劫持
- **严重级别**: Critical
- **位置**:
  - `frontend-user/src/store.ts` 第 24-25 行
  - `frontend-admin/src/store.ts` 第 22-23 行
  - `frontend-user/src/api/client.ts` 第 10-11 行
  - `frontend-admin/src/api/client.ts` 第 10-11 行
- **问题描述**: 用户端和管理端均将 JWT 访问令牌（`token` / `admin_token`）和用户信息存储在 `localStorage` 中。如果应用存在 XSS 漏洞（如通过上传的简历内容、AI 返回的富文本等），恶意脚本可直接读取 localStorage 中的令牌并发送到攻击者服务器，实现完全会话劫持。
- **修复建议**:
  1. 将 JWT 访问令牌改为存储在 `httpOnly`、`Secure`、`SameSite=Strict` 的 Cookie 中，由后端在登录响应中通过 `Set-Cookie` 头部设置。
  2. 前端通过 `withCredentials: true` 自动携带 Cookie。
  3. 刷新令牌（refresh token）也必须存储在 httpOnly Cookie 中。
  4. 如必须使用 localStorage，需实施严格的 CSP 策略并确保无 XSS 漏洞。

#### C2: 管理员创建接口未校验密码强度
- **严重级别**: Critical
- **位置**:
  - `backend/src/controllers/adminController.ts` 第 757-818 行（`createAdmin` 函数）
- **问题描述**: `createAdmin` 接口接收 `password` 参数后直接调用 `hashPassword` 进行哈希，未执行任何密码强度校验。超级管理员可能创建使用弱密码（如 "123456"、"admin"）的管理员账号，极易被暴力破解。
- **修复建议**:
  1. 在 `createAdmin` 中调用 `checkPasswordStrength(password)` 进行密码强度校验，要求密码长度至少 8 位且包含大小写字母、数字和特殊字符。
  2. 复用 `authController.ts` 中已有的密码强度检查逻辑。

---

### High

#### H1: nginx 配置缺少 HTTPS 和 HSTS 头部
- **严重级别**: High
- **位置**:
  - `nginx-gateway.conf` 第 5-44 行、第 47-85 行
- **问题描述**: nginx 配置仅监听 HTTP 80 端口，未配置 HTTPS/SSL 证书，也未添加 `Strict-Transport-Security` (HSTS) 头部。所有客户端与服务器之间的通信（包括 JWT 令牌、密码、简历文件）均以明文传输，存在中间人攻击（MITM）和会话劫持风险。
- **修复建议**:
  1. 配置 HTTPS 监听 443 端口，使用有效的 SSL/TLS 证书（Let's Encrypt 或商业证书）。
  2. 添加 HSTS 头部：`add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`
  3. 配置 HTTP 自动跳转到 HTTPS。
  4. 使用现代 TLS 配置（TLS 1.2+，禁用弱密码套件）。

#### H2: 文件上传存在路径遍历风险（文件名处理）
- **严重级别**: High
- **位置**:
  - `backend/src/routes/resume.ts` 第 32-34 行（multer filename 回调）
  - `backend/src/controllers/resumeController.ts` 第 14-21 行（`safeDecodeFilename`）
- **问题描述**: `safeDecodeFilename` 使用 `Buffer.from(name, 'latin1').toString('utf-8')` 解码文件名，但未过滤路径遍历字符（如 `../`）。虽然 multer 的 `filename` 回调使用自定义唯一名称，但原始文件名 `originalname` 被直接存入数据库并在响应中返回，如果后续有功能直接使用原始文件名构造文件路径，可能导致路径遍历。
- **修复建议**:
  1. 对 `originalname` 进行严格的路径遍历过滤，移除所有 `../`、`..\`、`/`、`\` 等字符。
  2. 使用 `path.basename()` 提取纯文件名。
  3. 限制文件名长度（如最多 255 字符）。

#### H3: AI API 密钥通过环境变量注入 Docker 容器
- **严重级别**: High
- **位置**:
  - `docker-compose.yml` 第 51 行（`AI_API_KEY: ${AI_API_KEY}`）
  - `backend/src/services/ai/client.ts` 第 35 行
- **问题描述**: AI API 密钥以明文环境变量形式传入 Docker 容器，任何能够执行 `docker inspect` 或进入容器的人员均可查看密钥。如果容器被入侵，攻击者可窃取 API 密钥并滥用 AI 服务。
- **修复建议**:
  1. 使用 Docker Secrets 或外部密钥管理服务（如 AWS Secrets Manager、HashiCorp Vault）存储 API 密钥。
  2. 在运行时通过文件挂载方式读取密钥（如 `/run/secrets/ai_api_key`），而非环境变量。
  3. 限制密钥权限，定期轮换 API 密钥。

---

### Medium

#### M1: 请求体大小限制不一致（全局 1MB vs 上传 10MB）
- **严重级别**: Medium
- **位置**:
  - `backend/src/index.ts` 第 33-34 行（`express.json({ limit: '1mb' })`）
  - `backend/src/routes/resume.ts` 第 41 行（`fileSize: env.MAX_FILE_SIZE`，默认 10MB）
- **问题描述**: 全局 JSON 请求体限制为 1MB，但文件上传限制为 10MB。虽然文件上传使用 multipart/form-data 不受 JSON 限制影响，但如果其他端点（如 base64 编码文件上传）使用 JSON，1MB 限制可能不够。更关键的是，nginx 配置 `client_max_body_size 11m` 与后端限制不完全对齐，可能导致不一致的行为。
- **修复建议**:
  1. 确保 nginx `client_max_body_size`、multer `fileSize` 限制和 `express.json` 限制保持一致且合理。
  2. 对于大文件上传端点，使用专门的流式处理而非 base64 JSON。

#### M2: 注册接口未验证邮箱格式（如果支持邮箱登录）
- **严重级别**: Medium
- **位置**:
  - `backend/src/controllers/authController.ts` 第 12-130 行（`register` 函数）
- **问题描述**: 用户注册接口仅校验 `username` 和 `password`，未要求或校验 `email` 字段。但登录接口支持通过邮箱登录（`where: { OR: [{ username }, { email: username }] }`），如果用户注册时未设置邮箱，后续可能被他人利用邮箱注册冲突或账号恢复问题。
- **修复建议**:
  1. 强制要求注册时提供邮箱，并使用正则表达式验证邮箱格式。
  2. 确保邮箱唯一性约束在数据库层面生效。

#### M3: `previewResume` 端点未校验用户所有权
- **严重级别**: Medium
- **位置**:
  - `backend/src/controllers/resumeController.ts` 第 450-510 行（`previewResume` 函数）
- **问题描述**: `previewResume` 接口仅通过 `id` 查询简历并返回文件流，未检查当前认证用户是否是该简历的所有者。任何登录用户都可以通过遍历 `id` 参数预览其他用户的简历文件。
- **修复建议**:
  1. 在 `previewResume` 中添加用户所有权校验：`if (!resume || resume.userId !== req.user?.userId)` 返回 403。
  2. 管理员角色可豁免此校验。

#### M4: 日志中可能记录敏感信息
- **严重级别**: Medium
- **位置**:
  - `backend/src/controllers/resumeController.ts` 第 51-57 行（上传调试日志）
  - `backend/src/middleware/security.ts` 第 331-334 行（错误处理日志）
- **问题描述**: 上传调试日志记录了 `fileName`、`fileSize`、`fileMime`、`contentType`、`bodyKeys` 等信息，虽然未直接记录文件内容，但在错误处理中间件中，`err.stack` 可能包含敏感信息（如数据库连接字符串、文件路径）。虽然生产环境不返回堆栈，但日志中仍可能记录。
- **修复建议**:
  1. 在生产环境中降低上传调试日志级别为 `debug`，或移除敏感字段。
  2. 在错误日志中对敏感信息进行脱敏处理，如过滤 `password`、`token`、`apiKey` 等字段。
  3. 定期审查日志内容，确保无敏感信息泄露。

#### M5: CSRF 防护可被绕过
- **严重级别**: Medium
- **位置**:
  - `backend/src/middleware/security.ts` 第 360-392 行（`csrfProtection`）
- **问题描述**: CSRF 中间件通过检查 `X-Requested-With: XMLHttpRequest` 头部来防护。但此防护可被绕过：
  1. 如果攻击者利用同源的其他漏洞（如 XSS），可以设置该头部。
  2. 对于无 `origin` 的请求（如服务器间调用）直接放行，如果攻击者通过某些方式构造无 origin 的请求，可能绕过。
  3. 非 Mozilla 浏览器的 User-Agent 直接放行，某些自动化工具可伪造 User-Agent。
- **修复建议**:
  1. 实施双重 Cookie 模式（Double Submit Cookie）或同步令牌模式（Synchronizer Token）。
  2. 对于敏感操作（如修改密码、删除账号），要求输入当前密码进行二次确认。
  3. 考虑使用 SameSite=Strict Cookie 作为主要的 CSRF 防护手段。

#### M6: 前端 Vite 开发服务器 `fs.strict: false`
- **严重级别**: Medium
- **位置**:
  - `frontend-user/vite.config.ts` 第 15-16 行
  - `frontend-admin/vite.config.ts` 第 14-15 行
- **问题描述**: 两个前端的 Vite 开发配置均设置了 `fs: { strict: false }`，允许开发服务器访问项目根目录之外的文件。虽然这仅在开发环境生效，但如果开发服务器被暴露到公网（如通过 `--host`），攻击者可能利用此配置读取服务器上的敏感文件。
- **修复建议**:
  1. 将 `fs.strict` 恢复为 `true`（默认值）。
  2. 如果必须访问外部文件，使用 `fs.allow` 明确指定允许的目录。
  3. 确保开发服务器不暴露到公网。

---

### Low

#### L1: JWT 令牌未实现黑名单/撤销检查（访问令牌）
- **严重级别**: Low
- **位置**:
  - `backend/src/middleware/auth.ts` 第 42-161 行（`authenticateToken`）
  - `backend/src/utils/jwt.ts` 第 83-99 行（`verifyAccessToken`）
- **问题描述**: 访问令牌（access token）验证时仅检查签名和过期时间，未查询数据库确认令牌是否被撤销。虽然刷新令牌实现了撤销机制（`revokedAt`），但访问令牌一旦被签发，在过期前无法使其失效。如果用户账号被禁用，访问令牌仍可继续使用直到过期（默认 1 小时）。虽然 `authenticateToken` 检查了用户 `isActive` 状态，但如果令牌泄露，无法单独撤销该令牌。
- **修复建议**:
  1. 实现访问令牌黑名单（如 Redis 存储被撤销的 token jti），在验证时查询黑名单。
  2. 缩短访问令牌有效期（如 15 分钟），降低泄露后的风险窗口。
  3. 考虑使用滑动会话（Sliding Session）机制。

#### L2: `getDashboardStats` 返回原始 IP 地址
- **严重级别**: Low
- **位置**:
  - `backend/src/controllers/adminController.ts` 第 93-99 行（`recentLogins` 映射）
- **问题描述**: 管理员仪表盘接口返回最近登录记录时，直接返回了用户的原始 IP 地址（`ipAddress: log.ipAddress`）。虽然这仅对管理员可见，但如果管理员账号被入侵，攻击者可获取所有用户的真实 IP 地址，存在隐私泄露风险。
- **修复建议**:
  1. 对日志中的 IP 地址进行部分脱敏处理（如将 `192.168.1.100` 显示为 `192.168.1.xxx`）。
  2. 或仅在需要时（如安全审计）显示完整 IP，日常统计中隐藏。

#### L3: 数据库连接字符串包含在环境变量中，无加密
- **严重级别**: Low
- **位置**:
  - `backend/src/config/env.ts` 第 33 行
  - `docker-compose.yml` 第 48 行
- **问题描述**: `DATABASE_URL` 包含数据库密码，以明文形式存储在 `.env` 文件和 Docker Compose 环境变量中。虽然这是常见做法，但如果 `.env` 文件权限设置不当或被意外提交到版本控制，将导致数据库凭证泄露。
- **修复建议**:
  1. 确保 `.env` 文件已添加到 `.gitignore`。
  2. 设置 `.env` 文件权限为 `600`（仅所有者可读写）。
  3. 考虑使用 Docker Secrets 或外部密钥管理服务存储数据库密码。

#### L4: 分析结果缓存未限制单用户缓存大小
- **严重级别**: Low
- **位置**:
  - `backend/src/utils/aiCache.ts` 第 20-24 行
- **问题描述**: AI 分析结果缓存使用内存中的 Map，全局最大 100 条。但未按用户限制缓存大小，单个用户可能通过提交大量不同的简历内容占满整个缓存，导致其他用户的缓存被驱逐（缓存污染攻击）。
- **修复建议**:
  1. 按用户 ID 划分缓存命名空间，或为每个用户设置缓存上限。
  2. 考虑使用 Redis 等外部缓存服务，支持更细粒度的缓存策略。

#### L5: 管理员路由缺少额外的速率限制
- **严重级别**: Low
- **位置**:
  - `backend/src/routes/admin.ts` 第 22-57 行
- **问题描述**: 管理员路由虽然应用了全局速率限制和 IP 封禁，但缺少针对管理员接口的专门速率限制。如果管理员凭证被泄露，攻击者可以以较高频率调用敏感接口（如删除用户、封禁 IP）。
- **修复建议**:
  1. 为管理员路由添加专门的速率限制中间件，限制频率（如每分钟 30 次请求）。
  2. 对敏感操作（如删除用户、创建管理员）添加更严格的限制。

---

### Info

#### I1: 生产环境 `DEBUG_KEY` 默认为空字符串
- **严重级别**: Info
- **位置**:
  - `backend/src/config/env.ts` 第 75 行
- **问题描述**: `DEBUG_KEY` 默认值为空字符串，在生产环境中如果未显式设置，任何人都可以通过不发送 `x-debug` 头部或发送空值来获取错误信息（因为 `'' === ''` 为 true）。虽然代码逻辑是 `DEBUG_KEY && req.headers['x-debug'] === DEBUG_KEY`，当 `DEBUG_KEY` 为空时条件为 false，行为正确，但这是一个潜在的风险点。
- **修复建议**:
  1. 确保生产环境 `DEBUG_KEY` 为空时，严格禁止返回任何调试信息。
  2. 考虑移除 `DEBUG_KEY` 机制，生产环境永远不应返回堆栈信息。

#### I2: `crossOriginEmbedderPolicy: false` 降低了安全级别
- **严重级别**: Info
- **位置**:
  - `backend/src/middleware/security.ts` 第 43 行
- **问题描述**: Helmet 配置中禁用了 `crossOriginEmbedderPolicy`（COEP）。COEP 要求所有嵌入资源必须携带 CORP/CORS 头部，是启用某些高级浏览器功能（如 SharedArrayBuffer）的前提。禁用此策略降低了安全级别，但可能是为了兼容性考虑。
- **修复建议**:
  1. 评估是否可以启用 `crossOriginEmbedderPolicy: true`。
  2. 如果必须禁用，在文档中记录原因。

#### I3: 前端构建未启用 CSP 报告
- **严重级别**: Info
- **位置**:
  - `frontend-user/vite.config.ts`
  - `frontend-admin/vite.config.ts`
- **问题描述**: 前端构建配置中未设置 Content Security Policy (CSP) 的 `<meta>` 标签或报告机制。虽然后端 Helmet 已配置 CSP，但前端作为单页应用（SPA），可能需要更细粒度的 CSP 配置。
- **修复建议**:
  1. 在前端 `index.html` 中添加 CSP `<meta>` 标签，与后端 Helmet 策略保持一致。
  2. 配置 CSP 报告 URI，收集违规报告。

#### I4: 项目缺少安全相关的自动化测试
- **严重级别**: Info
- **位置**:
  - 全局
- **问题描述**: 项目中未看到针对安全场景的自动化测试，如：
  - 认证绕过测试
  - SQL 注入测试
  - XSS 防护测试
  - 速率限制测试
  - CSRF 防护测试
- **修复建议**:
  1. 添加安全测试用例，覆盖常见的攻击场景。
  2. 使用工具如 `jest`、`supertest` 编写自动化安全测试。
  3. 考虑引入 SAST/DAST 工具（如 SonarQube、OWASP ZAP）到 CI/CD 流程。

---

## 修复优先级建议

| 优先级 | 问题编号 | 描述 |
|--------|----------|------|
| P0（立即） | C1 | 前端 JWT 存储改为 httpOnly Cookie |
| P0（立即） | C2 | 管理员创建接口添加密码强度校验 |
| P1（本周） | H1 | nginx 配置 HTTPS 和 HSTS |
| P1（本周） | H2 | 文件上传路径遍历防护 |
| P1（本周） | H3 | Docker 环境变量密钥改为 Secrets |
| P2（本月） | M3 | previewResume 添加所有权校验 |
| P2（本月） | M5 | 增强 CSRF 防护 |
| P2（本月） | M4 | 日志敏感信息脱敏 |
| P3（后续） | L1 | JWT 黑名单机制 |
| P3（后续） | I4 | 安全自动化测试 |

---

## 附录：安全良好实践（已实施）

以下安全措施已在项目中正确实施，值得肯定：

1. **密码存储**: 使用 bcrypt 哈希（13 rounds），并实现了密码强度检查。
2. **SQL 注入防护**: 使用 Prisma ORM，所有数据库查询均参数化。
3. **速率限制**: 实现了通用速率限制、登录速率限制和用户名级别速率限制。
4. **IP 封禁**: 实现了内存 + 数据库双层的 IP 封禁机制，支持自动和手动封禁。
5. **安全头部**: 使用 Helmet 配置了 CSP、HSTS（生产环境）、Referrer-Policy 等。
6. **CORS**: 基于白名单的 CORS 配置，生产环境通过环境变量控制允许的来源。
7. **会话管理**: 刷新令牌存储在数据库中，支持撤销，登录时生成新令牌对。
8. **权限控制**: 实现了用户认证、管理员权限、超级管理员权限和所有权检查中间件。
9. **文件上传**: 使用 multer 限制文件类型和大小，并实现了 PDF 魔数校验。
10. **Docker 安全**: 后端容器以非 root 用户（appuser）运行，MySQL 和 backend 端口仅绑定 127.0.0.1。
11. **网络隔离**: Docker Compose 中使用了 `internal` 网络隔离数据库。
12. **错误处理**: 生产环境不暴露详细错误信息和堆栈跟踪。
13. **审计日志**: 实现了专门的安全审计日志，记录登录、注册、上传、管理员操作等。
