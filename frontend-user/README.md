# RÉSUMÉ·AI — 用户端 (Dark Career Studio)

## 设计语言
- **Mood** 深夜职涯工作室 — 冷静、专注、高端
- **Background** WebGL 极光 (青→紫渐变) + 噪点叠加
- **Type** Fraunces 衬线标题 + Geist 正文 + JetBrains Mono 标签
- **Accent** #5EEAD4 薄荷青 (Hover 时辉光增强)
- **Surface** #0A0A0F 深空黑 + #14141C 卡片

## 开发

```bash
npm install
npm run dev  # http://localhost:5173
```

Vite 已配置 `/api` 代理到 `http://localhost:3000`。

## 目录

```
src/
├── api/             # axios 客户端 + auth / resume 模块
├── components/
│   ├── common/      # AuthRoute, AdminRoute, GuestRoute, AppLayout
│   └── ui/          # Aurora, BlurText, CountUp, PillNav
├── pages/           # Login, Register, Upload, Result, History
├── styles/global.css
├── store.ts         # zustand 全局状态
├── router.tsx       # 路由
└── main.tsx         # 入口
```

## 关键组件

- **Aurora.tsx** — 自适应 WebGL 极光背景 (OGL)
- **BlurText.tsx** — Motion 字模糊入场动画
- **CountUp.tsx** — 弹簧动画数字滚动
- **PillNav.tsx** — 居中毛玻璃胶囊导航

## 部署

参见 `docs/superpowers/plans/AI简历优化器-部署.md`
