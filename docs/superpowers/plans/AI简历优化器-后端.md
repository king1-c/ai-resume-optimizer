# AI 简历优化器 — 后端子计划（Phase 3-4）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现后端核心（简历 + AI 分析 + 用户功能）和管理端 API。

**前置:** 已完成 [主计划 Phase 0-2](AI简历优化器.md)，即仓库初始化、数据库、认证三件套、JWT 限流均已就绪。

---

## Phase 3：后端核心 - 简历 + AI 分析

### Task 3.1：multer 文件上传中间件

**Files:**
- Create: `backend/src/middleware/upload.js`

- [ ] **Step 1：实现**

```javascript
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_MB = Number(process.env.UPLOAD_MAX_MB) || 10;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${random}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.pdf', '.docx', '.txt'].includes(ext)) {
    return cb(new Error('仅支持 PDF / Word / TXT 文件'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

export default upload;
```

- [ ] **Step 2：提交**

```bash
git add backend/src/middleware/upload.js
git commit -m "feat(upload): multer 配置"
```

---

### Task 3.2：PDF / Word / TXT 解析

**Files:**
- Create: `backend/src/services/parser.js`

- [ ] **Step 1：实现**

```javascript
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractText(filePath, fileType) {
  if (fileType === 'pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || '';
  }
  if (fileType === 'docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value || '';
  }
  if (fileType === 'txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error('不支持的文件类型');
}

export function detectFileType(originalName) {
  const ext = path.extname(originalName).toLowerCase().replace('.', '');
  if (['pdf', 'docx', 'txt'].includes(ext)) return ext;
  return null;
}
```

- [ ] **Step 2：手测**

放一个 `test.pdf` 到 `uploads/`，运行：
```bash
node -e "import('./src/services/parser.js').then(m => m.extractText('./uploads/test.pdf','pdf').then(console.log))"
```

- [ ] **Step 3：提交**

```bash
git add backend/src/services/parser.js
git commit -m "feat(parser): PDF/Word/TXT 文本提取"
```

---

### Task 3.3：简历上传 API

**Files:**
- Create: `backend/src/routes/resume.js`

- [ ] **Step 1：路由（先做 upload）**

```javascript
import express from 'express';
import authRequired from '../middleware/authRequired.js';
import upload from '../middleware/upload.js';
import prisma from '../utils/prisma.js';
import { extractText, detectFileType } from '../services/parser.js';

const router = express.Router();
router.use(authRequired);

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const fileType = detectFileType(req.file.originalname);
    if (!fileType) return res.status(400).json({ error: '不支持的文件类型' });

    const rawText = await extractText(req.file.path, fileType);
    if (!rawText || rawText.trim().length < 50) {
      return res.status(400).json({ error: '简历内容过短或解析失败' });
    }

    const resume = await prisma.resume.create({
      data: {
        userId: req.user.id,
        originalFilename: req.file.originalname,
        rawText,
        filePath: req.file.path,
        fileType,
      },
    });
    res.json({ resumeId: resume.id, rawText: resume.rawText });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || '上传失败' });
  }
});

export default router;
```

- [ ] **Step 2：挂载**

修改 `backend/src/app.js`:
```javascript
import resumeRouter from './routes/resume.js';
app.use('/api', resumeRouter);
```

- [ ] **Step 3：测试**

```bash
TOKEN=<login 拿到的>
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./uploads/test.pdf"
```

预期: `{ "resumeId": 1, "rawText": "..." }`

- [ ] **Step 4：提交**

```bash
git add backend/src/routes/resume.js backend/src/app.js
git commit -m "feat(resume): 简历上传 + 解析 API"
```

---

### Task 3.4：DeepSeek AI 服务（SSE 流式）

**Files:**
- Create: `backend/src/services/ai.js`

- [ ] **Step 1：实现**

```javascript
const DEESEEK_URL = 'https://api.deepseek.com/chat/completions';

const buildPrompt = (resumeText) => `你是一位资深 HR 和简历顾问。请从以下 5 个维度分析这份简历，每个维度给出 1-10 分的评分、具体问题（引用简历中的原文）和修改建议。

【评分维度】
1. 结构排版：信息层次清晰度
2. 内容完整性：是否包含基本信息、教育、经历、技能等关键模块
3. 关键词密度：与目标岗位相关行业关键词的覆盖
4. 量化成果：是否用数据说话（如"提升 30%"）
5. 语言表达：动词选择、专业性、错别字

【简历内容】
${resumeText}

【输出要求】
严格按以下 JSON 格式返回（只返回 JSON，不要任何其他文字、解释或 Markdown 代码块标记）：
{
  "totalScore": 7.5,
  "dimensions": [
    { "name": "结构排版", "score": 8, "issues": [{ "original": "...", "suggestion": "...", "reason": "..." }] },
    { "name": "内容完整性", "score": 7, "issues": [...] },
    { "name": "关键词密度", "score": 6, "issues": [...] },
    { "name": "量化成果", "score": 5, "issues": [...] },
    { "name": "语言表达", "score": 8, "issues": [...] }
  ]
}`;

export async function analyzeResumeStream(resumeText, onChunk) {
  const response = await fetch(DEESEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一位资深 HR 和简历顾问，输出严格 JSON。' },
        { role: 'user', content: buildPrompt(resumeText) },
      ],
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API 错误：${response.status} ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch { /* 忽略解析失败 */ }
    }
  }

  return full;
}

export function parseFinalJSON(fullText) {
  const m = fullText.trim().match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI 未返回有效 JSON');
  return JSON.parse(m[0]);
}
```

- [ ] **Step 2：提交**

```bash
git add backend/src/services/ai.js
git commit -m "feat(ai): DeepSeek API SSE 流式调用"
```

---

### Task 3.5：AI 分析 SSE 路由

**Files:**
- Modify: `backend/src/routes/resume.js`

- [ ] **Step 1：在 `resume.js` 末尾追加 analyze 路由**

```javascript
import { analyzeResumeStream, parseFinalJSON } from '../services/ai.js';

router.post('/analyze/:resumeId', async (req, res) => {
  const resumeId = Number(req.params.resumeId);
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume || resume.userId !== req.user.id) {
    return res.status(404).json({ error: '简历不存在' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let fullText = '';
  try {
    await analyzeResumeStream(resume.rawText, (chunk) => {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    const result = parseFinalJSON(fullText);

    const analysis = await prisma.analysis.create({
      data: {
        resumeId: resume.id,
        totalScore: result.totalScore,
        resultJson: result,
      },
    });

    res.write(`data: ${JSON.stringify({ done: true, analysisId: analysis.id, totalScore: result.totalScore })}\n\n`);
    res.end();
  } catch (e) {
    console.error('[analyze]', e);
    res.write(`data: ${JSON.stringify({ error: e.message || '分析失败' })}\n\n`);
    res.end();
  }
});
```

- [ ] **Step 2：测试**

```bash
curl -N -X POST http://localhost:3000/api/analyze/1 \
  -H "Authorization: Bearer $TOKEN"
```

预期: 逐字流式吐回 JSON，末尾 `{"done":true,"analysisId":1}`。

- [ ] **Step 3：提交**

```bash
git add backend/src/routes/resume.js
git commit -m "feat(ai): /analyze/:resumeId SSE 接口"
```

---

### Task 3.6：获取分析结果

**Files:**
- Modify: `backend/src/routes/resume.js`

- [ ] **Step 1：追加 GET 路由**

```javascript
router.get('/analysis/:resumeId', async (req, res) => {
  const resumeId = Number(req.params.resumeId);
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { analysis: true },
  });
  if (!resume || resume.userId !== req.user.id) {
    return res.status(404).json({ error: '简历不存在' });
  }
  if (!resume.analysis) {
    return res.status(404).json({ error: '该简历尚未分析' });
  }
  res.json({
    id: resume.analysis.id,
    resumeId,
    totalScore: Number(resume.analysis.totalScore),
    resultJson: resume.analysis.resultJson,
    createdAt: resume.analysis.createdAt,
  });
});
```

- [ ] **Step 2：测试 & 提交**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/analysis/1
git add backend/src/routes/resume.js
git commit -m "feat(resume): GET /analysis/:resumeId"
```

---

### Task 3.7：采纳建议 API

**Files:**
- Modify: `backend/src/routes/resume.js`

- [ ] **Step 1：追加 adopt 路由**

```javascript
import { z } from 'zod';

const adoptSchema = z.object({
  analysisId: z.number().int().positive(),
  dimensionName: z.string().min(1).max(20),
  originalText: z.string().min(1),
  suggestionText: z.string().min(1),
});

router.post('/adopt', async (req, res) => {
  const parse = adoptSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: '参数错误' });
  const { analysisId, dimensionName, originalText, suggestionText } = parse.data;

  const a = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: { resume: true },
  });
  if (!a || a.resume.userId !== req.user.id) {
    return res.status(404).json({ error: '分析不存在' });
  }

  await prisma.adoption.create({
    data: { analysisId, dimensionName, originalText, suggestionText },
  });
  res.json({ success: true });
});
```

- [ ] **Step 2：测试 & 提交**

```bash
git add backend/src/routes/resume.js
git commit -m "feat(resume): 采纳建议 API"
```

---

### Task 3.8：历史记录 API（分页）

**Files:**
- Modify: `backend/src/routes/resume.js`

- [ ] **Step 1：追加 history**

```javascript
router.get('/history', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
  const skip = (page - 1) * pageSize;

  const [list, total] = await Promise.all([
    prisma.resume.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { analysis: { select: { totalScore: true, createdAt: true } } },
    }),
    prisma.resume.count({ where: { userId: req.user.id } }),
  ]);

  res.json({
    list: list.map(r => ({
      id: r.id,
      originalFilename: r.originalFilename,
      fileType: r.fileType,
      createdAt: r.createdAt,
      totalScore: r.analysis ? Number(r.analysis.totalScore) : null,
    })),
    total,
    page,
    pageSize,
  });
});
```

- [ ] **Step 2：测试 & 提交**

```bash
git add backend/src/routes/resume.js
git commit -m "feat(resume): 历史记录 API"
```

---

### Task 3.9：导出优化版简历

**Files:**
- Modify: `backend/src/routes/resume.js`

- [ ] **Step 1：追加 export**

```javascript
router.get('/export/:resumeId', async (req, res) => {
  const resumeId = Number(req.params.resumeId);
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { analysis: { include: { adoptions: true } } },
  });
  if (!resume || resume.userId !== req.user.id) {
    return res.status(404).json({ error: '简历不存在' });
  }
  if (!resume.analysis) {
    return res.status(400).json({ error: '该简历尚未分析，无法导出' });
  }

  let text = resume.rawText + '\n\n===== AI 优化建议（已采纳）=====\n\n';
  const adoptions = resume.analysis.adoptions;
  if (adoptions.length === 0) {
    text += '（你尚未采纳任何建议）';
  } else {
    adoptions.forEach((a, i) => {
      text += `[${i + 1}] ${a.dimensionName}\n`;
      text += `原句：${a.originalText}\n`;
      text += `建议：${a.suggestionText}\n\n`;
    });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="resume_${resumeId}_optimized.txt"`);
  res.send(text);
});
```

- [ ] **Step 2：测试 & 提交**

```bash
git add backend/src/routes/resume.js
git commit -m "feat(resume): 导出优化版简历"
```

---

### Task 3.10：后端 README

**Files:**
- Create: `backend/README.md`

- [ ] **Step 1：写**

```markdown
# 后端 (Resume Optimizer Backend)

## 开发
\`\`\`bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
\`\`\`

## 目录
- `src/middleware/` Express 中间件
- `src/routes/` 路由（auth / resume / admin）
- `src/services/` AI / 邮件 / 解析 / 验证码
- `src/utils/` jwt / password / prisma
- `prisma/schema.prisma` 数据模型

## 部署
参见 [docs/DEPLOY.md](../docs/DEPLOY.md)
```

- [ ] **Step 2：提交**

```bash
git add backend/README.md
git commit -m "docs(backend): README"
```

---

## Phase 4：后端管理端

### Task 4.1：管理端路由入口

**Files:**
- Create: `backend/src/routes/admin.js`

- [ ] **Step 1：骨架 + 挂载**

```javascript
import express from 'express';
import authRequired from '../middleware/authRequired.js';
import adminOnly from '../middleware/adminOnly.js';
import prisma from '../utils/prisma.js';

const router = express.Router();
router.use(authRequired, adminOnly);

router.get('/ping', (req, res) => res.json({ ok: true, role: req.user.role }));

export default router;
```

修改 `backend/src/app.js`:
```javascript
import adminRouter from './routes/admin.js';
app.use('/api/admin', adminRouter);
```

- [ ] **Step 2：测试 & 提交**

```bash
git add backend/src/routes/admin.js backend/src/app.js
git commit -m "feat(admin): 管理端路由入口"
```

---

### Task 4.2：统计接口

**Files:**
- Modify: `backend/src/routes/admin.js`

- [ ] **Step 1：追加 stats**

```javascript
router.get('/stats', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalUsers, totalResumes, todayUploads, avgScore] = await Promise.all([
    prisma.user.count(),
    prisma.resume.count(),
    prisma.resume.count({ where: { createdAt: { gte: today } } }),
    prisma.analysis.aggregate({ _avg: { totalScore: true } }),
  ]);

  const scoreRows = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN total_score BETWEEN 1 AND 2 THEN '1-2'
        WHEN total_score BETWEEN 3 AND 4 THEN '3-4'
        WHEN total_score BETWEEN 5 AND 6 THEN '5-6'
        WHEN total_score BETWEEN 7 AND 8 THEN '7-8'
        ELSE '9-10'
      END AS score_range,
      COUNT(*) AS count
    FROM analyses
    GROUP BY score_range
    ORDER BY score_range
  `;

  const dailyRows = await prisma.$queryRaw`
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM resumes
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date
  `;

  res.json({
    totalUsers,
    totalResumes,
    todayUploads,
    avgScore: avgScore._avg.totalScore
      ? Math.round(Number(avgScore._avg.totalScore) * 10) / 10
      : 0,
    scoreDistribution: scoreRows.reduce((acc, r) => {
      acc[r.score_range] = Number(r.count);
      return acc;
    }, {}),
    dailyUploads: dailyRows.map(r => ({ date: r.date, count: Number(r.count) })),
  });
});
```

- [ ] **Step 2：测试 & 提交**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/admin/stats
git add backend/src/routes/admin.js
git commit -m "feat(admin): 统计接口"
```

---

### Task 4.3：用户列表 + 详情

**Files:**
- Modify: `backend/src/routes/admin.js`

- [ ] **Step 1：追加**

```javascript
router.get('/users', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const keyword = (req.query.keyword || '').trim();
  const where = keyword
    ? { OR: [{ username: { contains: keyword } }, { email: { contains: keyword } }] }
    : {};

  const [list, total] = await Promise.all([
    prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
      select: {
        id: true, username: true, email: true, role: true,
        createdAt: true, lastActiveAt: true,
        _count: { select: { resumes: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ list, total, page, pageSize });
});

router.get('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, email: true, role: true,
      createdAt: true, lastActiveAt: true,
      resumes: {
        orderBy: { createdAt: 'desc' },
        include: { analysis: { select: { totalScore: true } } },
      },
    },
  });
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});
```

- [ ] **Step 2：测试 & 提交**

```bash
git add backend/src/routes/admin.js
git commit -m "feat(admin): 用户列表与详情"
```

---

### Task 4.4：简历列表 + 详情 + 删除

**Files:**
- Modify: `backend/src/routes/admin.js`

- [ ] **Step 1：追加**

```javascript
router.get('/resumes', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const keyword = (req.query.keyword || '').trim();
  const minScore = Number(req.query.minScore) || 0;
  const maxScore = Number(req.query.maxScore) || 10;

  const where = {
    ...(keyword && {
      OR: [
        { originalFilename: { contains: keyword } },
        { user: { username: { contains: keyword } } },
      ],
    }),
    ...((minScore > 0 || maxScore < 10) && {
      analysis: { totalScore: { gte: minScore, lte: maxScore } },
    }),
  };

  const [list, total] = await Promise.all([
    prisma.resume.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize, take: pageSize,
      include: {
        user: { select: { id: true, username: true, email: true } },
        analysis: { select: { totalScore: true, createdAt: true } },
      },
    }),
    prisma.resume.count({ where }),
  ]);
  res.json({ list, total, page, pageSize });
});

router.get('/resumes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const resume = await prisma.resume.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, email: true } },
      analysis: true,
    },
  });
  if (!resume) return res.status(404).json({ error: '简历不存在' });
  res.json({ resume });
});

router.delete('/resumes/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.resume.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: '简历不存在' });
  }
});
```

- [ ] **Step 2：测试 & 提交**

```bash
# 列表
curl -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:3000/api/admin/resumes?minScore=7"
# 删除
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/admin/resumes/1
git add backend/src/routes/admin.js
git commit -m "feat(admin): 简历列表/详情/删除"
```

---

### Task 4.5：后端启动前环境变量自检

**Files:**
- Create: `backend/src/check-env.js`

- [ ] **Step 1：实现**

```javascript
import dotenv from 'dotenv';
dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET', 'DEEPSEEK_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missing = required.filter(k => !process.env[k] || /change_me|your_/.test(process.env[k] || ''));

if (missing.length) {
  console.error('❌ 缺少或未修改的环境变量：', missing.join(', '));
  console.error('请编辑 backend/.env 文件后重启。');
  process.exit(1);
}
if ((process.env.JWT_SECRET || '').length < 32) {
  console.error('❌ JWT_SECRET 至少 32 位');
  process.exit(1);
}
console.log('✅ 环境变量检查通过');
```

- [ ] **Step 2：app.js 顶部引入**

修改 `backend/src/app.js` 顶部，在 `dotenv.config()` 后：
```javascript
import './check-env.js';
```

- [ ] **Step 3：测试 & 提交**

故意改错 JWT_SECRET 启动，应退出；恢复后正常启动。

```bash
git add backend/src/check-env.js backend/src/app.js
git commit -m "feat(ops): 启动前环境变量自检"
```

---

**Phase 3-4 完结。下一步：[前端子计划](AI简历优化器-前端.md)**


