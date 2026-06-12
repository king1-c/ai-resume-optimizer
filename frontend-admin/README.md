# RÉSUMÉ·AI — 后台端 (Operations Console)

## 设计语言
- **Mood** Operations Console — 冷静、密集、可扫描
- **Background** Silk 丝绸纹理 (米色) + 噪点
- **Type** Inter Tight 标题 + Inter 正文 + JetBrains Mono 数字/标签
- **Accent** #1A1A1A 近黑 (主操作) + #DC2626 朱红 (危险/删除)
- **Surface** #FAFAF7 米白 + #FFFFFF 卡片 + #1A1A1A 深色 sidebar item

## 开发

```bash
npm install
npm run dev  # http://localhost:5174
```

Vite 已配置 `/api` 代理到 `http://localhost:3000`。

## 目录

```
src/
├── api/             # axios 客户端 + auth / admin 模块
├── components/
│   ├── common/      # AuthRoute, GuestRoute, AppLayout
│   └── ui/          # Silk, BlurText, CountUp
├── pages/           # Login, Dashboard, UserList, ResumeList
├── styles/global.css
├── store.ts
├── router.tsx
└── main.tsx
```

## 关键决策

- **左侧固定 240px 边栏** — 上下结构：品牌 → 导航 → 用户卡片
- **顶部标题 + Last sync/Status** — 让操作员一眼看清系统状态
- **KPI 卡片用 mono 后缀** — `/10` 数字与中文混排
- **颜色编码** — 绿/橙/红/黑 4 色评分区间，对应优秀/中等/较差/无评分

## 部署

参见 `docs/superpowers/plans/AI简历优化器-部署.md`
