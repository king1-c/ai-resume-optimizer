# AI 简历优化器 — 前端子计划（Phase 5-6）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现前端用户端（登录/注册/上传/分析结果/历史）和管理端（仪表盘/用户/简历）。

**前置:** 
- [主计划 Phase 0-2](AI简历优化器.md) 完成
- [后端 Phase 3-4](AI简历优化器-后端.md) 完成
- 后端在 `http://localhost:3000` 运行

---

## Phase 5：前端用户端

### Task 5.1：Vite + React + TS 初始化

**Files:**
- Create: `frontend/`（Vite 生成）

- [ ] **Step 1：初始化**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
# 选 React + TypeScript
npm install
```

- [ ] **Step 2：装核心依赖**

```bash
npm install antd @ant-design/icons axios zustand react-router-dom echarts echarts-for-react
npm install -D @types/node
```

- [ ] **Step 3：`vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4：本地启动验证**

```bash
npm run dev
# 浏览器打开 http://localhost:5173 看到 Vite 默认页
```

- [ ] **Step 5：提交**

```bash
git add frontend/
git commit -m "feat(frontend): Vite + React + TS 初始化"
```

---

### Task 5.2：API 客户端 + zustand store

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/resume.ts`
- Create: `frontend/src/api/admin.ts`
- Create: `frontend/src/store.ts`

- [ ] **Step 1：axios 客户端**

Create `frontend/src/api/client.ts`:
```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (location.pathname !== '/login') location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
```

- [ ] **Step 2：auth API**

Create `frontend/src/api/auth.ts`:
```typescript
import client from './client';

export const sendCode = (email: string) =>
  client.post('/auth/send-code', { email }).then(r => r.data);

export const register = (data: {
  username: string; email: string; password: string; code: string;
}) => client.post('/auth/register', data).then(r => r.data);

export const login = (data: { username: string; password: string }) =>
  client.post('/auth/login', data).then(r => r.data);
```

- [ ] **Step 3：resume API**

Create `frontend/src/api/resume.ts`:
```typescript
import client from './client';

export const uploadResume = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return client.post('/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const getAnalysis = (resumeId: number) =>
  client.get(`/analysis/${resumeId}`).then(r => r.data);

export const adoptSuggestion = (data: {
  analysisId: number; dimensionName: string; originalText: string; suggestionText: string;
}) => client.post('/adopt', data).then(r => r.data);

export const getHistory = (page = 1, pageSize = 10) =>
  client.get('/history', { params: { page, pageSize } }).then(r => r.data);

// 注意：导出端点需要 JWT，但浏览器 <a href> 无法携带 header
// 所以用 axios 拿 blob，再触发下载
export const downloadResume = async (resumeId: number) => {
  const res = await client.get(`/export/${resumeId}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = `resume_${resumeId}_optimized.txt`;
  a.click();
  window.URL.revokeObjectURL(url);
};
```

- [ ] **Step 4：admin API**

Create `frontend/src/api/admin.ts`:
```typescript
import client from './client';

export const getStats = () => client.get('/admin/stats').then(r => r.data);
export const getUsers = (keyword = '', page = 1) =>
  client.get('/admin/users', { params: { keyword, page } }).then(r => r.data);
export const getUserDetail = (id: number) =>
  client.get(`/admin/users/${id}`).then(r => r.data);
export const getResumes = (params: { keyword?: string; minScore?: number; maxScore?: number; page?: number } = {}) =>
  client.get('/admin/resumes', { params }).then(r => r.data);
export const getResumeDetail = (id: number) =>
  client.get(`/admin/resumes/${id}`).then(r => r.data);
export const deleteResume = (id: number) =>
  client.delete(`/admin/resumes/${id}`).then(r => r.data);
```

- [ ] **Step 5：zustand store**

Create `frontend/src/store.ts`:
```typescript
import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

interface AppState {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  init: () => void;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  token: null,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
  init: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr) });
    }
  },
}));
```

- [ ] **Step 6：提交**

```bash
git add frontend/src/api frontend/src/store.ts
git commit -m "feat(frontend): API 客户端 + 三个 API 模块 + store"
```

---

### Task 5.3：路由 + 守卫 + AppLayout

**Files:**
- Create: `frontend/src/components/common/AuthRoute.tsx`
- Create: `frontend/src/components/common/AdminRoute.tsx`
- Create: `frontend/src/components/common/AppLayout.tsx`
- Create: `frontend/src/router.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1：AuthRoute**

```typescript
import { Navigate } from 'react-router-dom';
import { useApp } from '../../store';

export default function AuthRoute({ children }: { children: JSX.Element }) {
  const token = useApp(s => s.token);
  return token ? children : <Navigate to="/login" replace />;
}
```

- [ ] **Step 2：AdminRoute**

```typescript
import { Navigate } from 'react-router-dom';
import { useApp } from '../../store';

export default function AdminRoute({ children }: { children: JSX.Element }) {
  const user = useApp(s => s.user);
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}
```

- [ ] **Step 3：AppLayout（左侧菜单 + 顶部退出）**

```typescript
import { Layout, Menu, Button } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../store';

const { Header, Content, Sider } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useApp();
  const isAdmin = user?.role === 'admin';

  const items = [
    { key: '/', label: '上传简历' },
    { key: '/history', label: '历史记录' },
    ...(isAdmin ? [
      { key: '/admin', label: '📊 数据面板' },
      { key: '/admin/users', label: '👥 用户管理' },
      { key: '/admin/resumes', label: '📄 简历管理' },
    ] : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>AI 简历优化器</div>
        <div>
          <span style={{ color: '#fff', marginRight: 16 }}>
            {user?.username}
            {isAdmin && <span style={{ background: '#1677ff', padding: '2px 8px', borderRadius: 4, fontSize: 12, marginLeft: 8 }}>管理员</span>}
          </span>
          <Button onClick={() => { logout(); navigate('/login'); }}>退出</Button>
        </div>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
```

- [ ] **Step 4：router.tsx**

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthRoute from './components/common/AuthRoute';
import AdminRoute from './components/common/AdminRoute';
import AppLayout from './components/common/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Upload from './pages/user/Upload';
import Result from './pages/user/Result';
import History from './pages/user/History';
import Dashboard from './pages/admin/Dashboard';
import UserList from './pages/admin/UserList';
import ResumeList from './pages/admin/ResumeList';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    path: '/',
    element: <AuthRoute><AppLayout /></AuthRoute>,
    children: [
      { index: true, element: <Upload /> },
      { path: 'result/:resumeId', element: <Result /> },
      { path: 'history', element: <History /> },
      { path: 'admin', element: <AdminRoute><Dashboard /></AdminRoute> },
      { path: 'admin/users', element: <AdminRoute><UserList /></AdminRoute> },
      { path: 'admin/resumes', element: <AdminRoute><ResumeList /></AdminRoute> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
```

- [ ] **Step 5：main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { useApp } from './store';

useApp.getState().init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
```

- [ ] **Step 6：占位页面（让路由跑起来）**

依次创建以下 7 个文件，初始内容为 `export default function XXX() { return <div>XXX（待实现）</div>; }`：
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/user/Upload.tsx`
- `frontend/src/pages/user/Result.tsx`
- `frontend/src/pages/user/History.tsx`
- `frontend/src/pages/admin/Dashboard.tsx`
- `frontend/src/pages/admin/UserList.tsx`
- `frontend/src/pages/admin/ResumeList.tsx`

- [ ] **Step 7：提交**

```bash
git add frontend/src/
git commit -m "feat(frontend): 路由 + 守卫 + AppLayout + 占位页面"
```

---

### Task 5.4：登录页

**Files:**
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { Form, Input, Button, Card, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { login } from '../api/auth';
import { useApp } from '../store';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useApp(s => s.setAuth);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const { token, user } = await login(values);
      setAuth(token, user);
      message.success('登录成功');
      navigate('/');
    } catch (e: any) {
      message.error(e.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card title="AI 简历优化器" style={{ width: 400 }}>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="用户名 / 邮箱" rules={[{ required: true }]}>
            <Input placeholder="请输入" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password placeholder="请输入" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>登录</Button>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            还没有账号？<Link to="/register">立即注册</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2：测试 & 提交**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat(frontend): 登录页"
```

---

### Task 5.5：注册页（含发送验证码 + 60s 倒计时）

**Files:**
- Modify: `frontend/src/pages/Register.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { Form, Input, Button, Card, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { sendCode, register } from '../api/auth';
import { useApp } from '../store';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const setAuth = useApp(s => s.setAuth);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const onSendCode = async () => {
    const email = (document.querySelector('input[id="email"]') as HTMLInputElement)?.value;
    if (!email) return message.warning('请先填写邮箱');
    setSending(true);
    try {
      await sendCode(email);
      message.success('验证码已发送，请查收邮箱');
      setCountdown(60);
    } catch (e: any) {
      message.error(e.response?.data?.error || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const { token, user } = await register(values);
      setAuth(token, user);
      message.success('注册成功');
      navigate('/');
    } catch (e: any) {
      message.error(e.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card title="注册" style={{ width: 420 }}>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[
            { required: true, min: 3, max: 20, message: '3-20 位' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '只能含字母数字下划线' },
          ]}>
            <Input placeholder="字母数字下划线" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input id="email" placeholder="将用于接收验证码" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[
            { required: true, min: 8, message: '至少 8 位' },
            { pattern: /^(?=.*[a-zA-Z])(?=.*\d).+$/, message: '必须含字母+数字' },
          ]}>
            <Input.Password placeholder="至少 8 位，含字母+数字" />
          </Form.Item>
          <Form.Item name="code" label="验证码" rules={[{ required: true, len: 6 }]}>
            <Input.Search
              placeholder="6 位数字"
              enterButton={countdown > 0 ? `${countdown}s` : '发送验证码'}
              onSearch={onSendCode}
              loading={sending}
              disabled={countdown > 0}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>注册</Button>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            已有账号？<Link to="/login">立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2：测试 & 提交**

```bash
git add frontend/src/pages/Register.tsx
git commit -m "feat(frontend): 注册页（验证码+60s 倒计时）"
```

---

### Task 5.6：上传页

**Files:**
- Modify: `frontend/src/pages/user/Upload.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { Upload as AntUpload, Card, Typography, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { UploadProps } from 'antd';
import { uploadResume } from '../../api/resume';

const { Dragger } = AntUpload;
const { Title, Paragraph } = Typography;

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const props: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.pdf,.docx,.txt',
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      setLoading(true);
      try {
        const data = await uploadResume(file as File);
        message.success('上传成功，开始分析');
        navigate(`/result/${data.resumeId}`, { state: { rawText: data.rawText } });
        onSuccess?.(data);
      } catch (e: any) {
        message.error(e.response?.data?.error || '上传失败');
        onError?.(e);
      } finally {
        setLoading(false);
      }
    },
  };

  return (
    <Card>
      <Title level={3}>上传简历</Title>
      <Paragraph type="secondary">
        支持 PDF / Word / TXT 格式，文件大小不超过 10MB。上传后 AI 将从 5 个维度进行评分。
      </Paragraph>
      <Dragger {...props} disabled={loading} style={{ padding: 24 }}>
        <p><InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} /></p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持单个文件上传</p>
      </Dragger>
      {loading && <div style={{ marginTop: 16, textAlign: 'center' }}>正在解析简历...</div>}
    </Card>
  );
}
```

- [ ] **Step 2：测试 & 提交**

```bash
git add frontend/src/pages/user/Upload.tsx
git commit -m "feat(frontend): 上传页"
```

---

### Task 5.7：分析结果页（SSE 流式）

**Files:**
- Modify: `frontend/src/pages/user/Result.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, message, Spin, Tag, Space } from 'antd';
import { getAnalysis, adoptSuggestion, downloadResume } from '../../api/resume';
import ScoreRadar from '../../components/user/ScoreRadar';
import AdviceCard from '../../components/user/AdviceCard';

interface Dimension {
  name: string;
  score: number;
  issues: { original: string; suggestion: string; reason: string }[];
}

interface AnalysisResult {
  totalScore: number;
  dimensions: Dimension[];
}

export default function Result() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [streamingText, setStreamingText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisId, setAnalysisId] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const startedRef = useRef(false);

  const startAnalysis = async () => {
    if (!resumeId) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/analyze/${resumeId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) setStreamingText(prev => prev + data.chunk);
            if (data.done) {
              setAnalysisId(data.analysisId);
              const final = await getAnalysis(Number(resumeId));
              setResult(final.resultJson);
              message.success('分析完成');
            }
            if (data.error) message.error(data.error);
          } catch { /* ignore */ }
        }
      }
    } catch {
      message.error('分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await getAnalysis(Number(resumeId));
        setResult(data.resultJson);
        setAnalysisId(data.id);
      } catch {
        if (!startedRef.current) {
          startedRef.current = true;
          startAnalysis();
        }
      }
    })();
  }, [resumeId]);

  const onAdopt = async (dimension: string, original: string, suggestion: string) => {
    if (analysisId == null) return message.warning('请等待分析完成');
    try {
      await adoptSuggestion({
        analysisId,
        dimensionName: dimension,
        originalText: original,
        suggestionText: suggestion,
      });
      message.success('已采纳');
    } catch {
      message.error('采纳失败');
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate('/')}>返回上传</Button>
        <Button onClick={() => navigate('/history')}>历史记录</Button>
        <Button type="primary" onClick={() => downloadResume(Number(resumeId))}>
          导出优化版
        </Button>
      </Space>

      {!result && (
        <Card title="AI 分析中" extra={analyzing && <Spin />}>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto', fontSize: 12 }}>
            {streamingText || '正在准备...'}
          </pre>
        </Card>
      )}

      {result && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Card title={`综合评分：${result.totalScore}`} style={{ flex: '1 1 360px' }}>
            <ScoreRadar dimensions={result.dimensions} />
          </Card>
          <div style={{ flex: '2 1 600px' }}>
            {result.dimensions.map((dim) => (
              <Card
                key={dim.name}
                title={<><Tag color={dim.score >= 7 ? 'green' : dim.score >= 5 ? 'gold' : 'red'}>{dim.name}</Tag> 评分：{dim.score}</>}
                style={{ marginBottom: 16 }}
              >
                {dim.issues.length === 0
                  ? <div style={{ color: '#888' }}>暂无问题，表现优秀 ✨</div>
                  : dim.issues.map((issue, i) => (
                      <AdviceCard
                        key={i}
                        original={issue.original}
                        suggestion={issue.suggestion}
                        reason={issue.reason}
                        onAdopt={() => onAdopt(dim.name, issue.original, issue.suggestion)}
                      />
                    ))
                }
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2：提交**

```bash
git add frontend/src/pages/user/Result.tsx
git commit -m "feat(frontend): 分析结果页（SSE）"
```

---

### Task 5.8：ScoreRadar 雷达图组件

**Files:**
- Create: `frontend/src/components/user/ScoreRadar.tsx`

- [ ] **Step 1：实现**

```tsx
import ReactECharts from 'echarts-for-react';

interface Dim { name: string; score: number; }

export default function ScoreRadar({ dimensions }: { dimensions: Dim[] }) {
  const option = {
    radar: { indicator: dimensions.map(d => ({ name: d.name, max: 10 })) },
    series: [{
      type: 'radar',
      data: [{
        value: dimensions.map(d => d.score),
        name: '评分',
        areaStyle: { color: 'rgba(22, 119, 255, 0.3)' },
        lineStyle: { color: '#1677ff' },
        itemStyle: { color: '#1677ff' },
      }],
    }],
  };
  return <ReactECharts option={option} style={{ height: 300 }} />;
}
```

- [ ] **Step 2：提交**

```bash
git add frontend/src/components/user/ScoreRadar.tsx
git commit -m "feat(frontend): 评分雷达图"
```

---

### Task 5.9：AdviceCard 建议卡片组件

**Files:**
- Create: `frontend/src/components/user/AdviceCard.tsx`

- [ ] **Step 1：实现**

```tsx
import { Card, Button, Tag } from 'antd';

interface Props {
  original: string;
  suggestion: string;
  reason: string;
  onAdopt: () => void;
}

export default function AdviceCard({ original, suggestion, reason, onAdopt }: Props) {
  return (
    <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
      <div style={{ marginBottom: 8 }}>
        <Tag color="red">原句</Tag>
        <span style={{ color: '#888', textDecoration: 'line-through' }}>{original}</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="green">建议</Tag>
        <span style={{ fontWeight: 500 }}>{suggestion}</span>
      </div>
      <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>💡 {reason}</div>
      <Button size="small" type="primary" onClick={onAdopt}>采纳</Button>
    </Card>
  );
}
```

- [ ] **Step 2：提交**

```bash
git add frontend/src/components/user/AdviceCard.tsx
git commit -m "feat(frontend): 建议卡片"
```

---

### Task 5.10：历史记录页

**Files:**
- Modify: `frontend/src/pages/user/History.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getHistory, downloadResume } from '../../api/resume';

export default function History() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const data = await getHistory(p, 10);
      setList(data.list);
      setTotal(data.total);
      setPage(p);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  return (
    <Card title="历史记录">
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={{ current: page, total, pageSize: 10, onChange: load }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '文件名', dataIndex: 'originalFilename' },
          { title: '类型', dataIndex: 'fileType', width: 80, render: (t) => <Tag>{t.toUpperCase()}</Tag> },
          {
            title: '评分', dataIndex: 'totalScore', width: 100,
            render: (s) => s == null ? '-' : <Tag color={s >= 7 ? 'green' : s >= 5 ? 'gold' : 'red'}>{s}</Tag>,
          },
          { title: '上传时间', dataIndex: 'createdAt', width: 180 },
          {
            title: '操作', width: 200,
            render: (_, r) => (
              <Space>
                <Button size="small" type="link" onClick={() => navigate(`/result/${r.id}`)}>查看</Button>
                <Button size="small" type="link" onClick={() => downloadResume(r.id)}>导出</Button>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
```

- [ ] **Step 2：测试 & 提交**

```bash
git add frontend/src/pages/user/History.tsx
git commit -m "feat(frontend): 历史记录页"
```

---

## Phase 6：前端管理端

### Task 6.1：仪表盘（4 卡片 + 折线 + 柱状）

**Files:**
- Modify: `frontend/src/pages/admin/Dashboard.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { useEffect, useState } from 'react';
import { Card, Row, Col, Spin } from 'antd';
import { UserOutlined, FileTextOutlined, ThunderboltOutlined, StarOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getStats } from '../../api/admin';

interface Stats {
  totalUsers: number;
  totalResumes: number;
  todayUploads: number;
  avgScore: number;
  scoreDistribution: Record<string, number>;
  dailyUploads: { date: string; count: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  if (!stats) return <Spin />;

  const lineOption = {
    title: { text: '近 7 天上传趋势' },
    xAxis: { type: 'category', data: stats.dailyUploads.map(d => d.date) },
    yAxis: { type: 'value' },
    series: [{
      data: stats.dailyUploads.map(d => d.count), type: 'line', smooth: true,
      areaStyle: { opacity: 0.3 }, itemStyle: { color: '#1677ff' },
    }],
  };

  const barOption = {
    title: { text: '评分分布' },
    xAxis: { type: 'category', data: Object.keys(stats.scoreDistribution) },
    yAxis: { type: 'value' },
    series: [{
      data: Object.values(stats.scoreDistribution), type: 'bar',
      itemStyle: {
        color: (p: any) => ['#ff4d4f', '#ff7a45', '#faad14', '#52c41a', '#1677ff'][p.dataIndex] || '#1677ff',
      },
    }],
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <UserOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.totalUsers}</div>
            <div>总用户数</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <FileTextOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.totalResumes}</div>
            <div>总简历数</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <ThunderboltOutlined style={{ fontSize: 24, color: '#faad14' }} />
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.todayUploads}</div>
            <div>今日上传</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <StarOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>{stats.avgScore}</div>
            <div>平均评分</div>
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}><Card><ReactECharts option={lineOption} style={{ height: 300 }} /></Card></Col>
        <Col span={12}><Card><ReactECharts option={barOption} style={{ height: 300 }} /></Card></Col>
      </Row>
    </div>
  );
}
```

- [ ] **Step 2：测试 & 提交**

```bash
git add frontend/src/pages/admin/Dashboard.tsx
git commit -m "feat(admin): 仪表盘（4 卡片+折线+柱状）"
```

---

### Task 6.2：用户列表 + 详情弹窗

**Files:**
- Modify: `frontend/src/pages/admin/UserList.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { useEffect, useState } from 'react';
import { Table, Input, Tag, Button, Modal, Space } from 'antd';
import { getUsers, getUserDetail } from '../../api/admin';

export default function UserList() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<any>(null);

  const load = async (p = 1, k = keyword) => {
    const data = await getUsers(k, p);
    setList(data.list); setTotal(data.total); setPage(p);
  };

  useEffect(() => { load(1); }, []);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索用户名/邮箱"
          allowClear
          onSearch={v => { setKeyword(v); load(1, v); }}
          style={{ width: 300 }}
        />
      </Space>
      <Table
        rowKey="id"
        dataSource={list}
        pagination={{ current: page, total, pageSize: 20, onChange: load }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '用户名', dataIndex: 'username' },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '角色', dataIndex: 'role', width: 100,
            render: (r) => r === 'admin' ? <Tag color="blue">管理员</Tag> : <Tag>用户</Tag>,
          },
          { title: '简历数', dataIndex: ['_count', 'resumes'], width: 100 },
          { title: '注册时间', dataIndex: 'createdAt', width: 180 },
          { title: '最后活跃', dataIndex: 'lastActiveAt', width: 180 },
          {
            title: '操作', width: 100,
            render: (_, r) => (
              <Button size="small" type="link" onClick={async () => {
                const d = await getUserDetail(r.id);
                setDetail(d.user);
              }}>查看</Button>
            ),
          },
        ]}
      />
      <Modal
        open={!!detail}
        title={detail ? `${detail.username} 的简历` : ''}
        width={700}
        onCancel={() => setDetail(null)}
        footer={null}
      >
        {detail && (
          <div>
            <p>邮箱：{detail.email}</p>
            <p>角色：{detail.role}</p>
            <Table
              rowKey="id"
              size="small"
              dataSource={detail.resumes}
              pagination={false}
              columns={[
                { title: 'ID', dataIndex: 'id' },
                { title: '文件名', dataIndex: 'originalFilename' },
                { title: '类型', dataIndex: 'fileType' },
                { title: '评分', dataIndex: 'analysis', render: (a) => a ? a.totalScore : '-' },
                { title: '时间', dataIndex: 'createdAt' },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2：测试 & 提交**

```bash
git add frontend/src/pages/admin/UserList.tsx
git commit -m "feat(admin): 用户列表+详情"
```

---

### Task 6.3：简历列表（搜索+评分筛选+详情+删除）

**Files:**
- Modify: `frontend/src/pages/admin/ResumeList.tsx`

- [ ] **Step 1：完整实现**

```tsx
import { useEffect, useState } from 'react';
import { Table, Input, Button, Modal, Space, InputNumber, message, Popconfirm, Tag } from 'antd';
import { getResumes, getResumeDetail, deleteResume } from '../../api/admin';

export default function ResumeList() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ keyword: '', minScore: 0, maxScore: 10 });
  const [detail, setDetail] = useState<any>(null);

  const load = async (p = 1) => {
    const data = await getResumes({ ...filters, page: p });
    setList(data.list); setTotal(data.total); setPage(p);
  };

  useEffect(() => { load(1); }, [filters]);

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索文件名/用户名"
          allowClear
          onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          style={{ width: 240 }}
        />
        <span>评分范围：</span>
        <InputNumber min={0} max={10} step={0.5} value={filters.minScore}
          onChange={v => setFilters(f => ({ ...f, minScore: v || 0 }))} />
        <span>~</span>
        <InputNumber min={0} max={10} step={0.5} value={filters.maxScore}
          onChange={v => setFilters(f => ({ ...f, maxScore: v || 10 }))} />
        <Button onClick={load}>刷新</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={list}
        pagination={{ current: page, total, pageSize: 20, onChange: load }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '文件名', dataIndex: 'originalFilename' },
          { title: '用户', dataIndex: ['user', 'username'] },
          { title: '类型', dataIndex: 'fileType', width: 80, render: t => <Tag>{t.toUpperCase()}</Tag> },
          {
            title: '评分', dataIndex: ['analysis', 'totalScore'], width: 100,
            render: (s) => s == null ? '-' : <Tag color={s >= 7 ? 'green' : s >= 5 ? 'gold' : 'red'}>{Number(s).toFixed(1)}</Tag>,
          },
          { title: '上传时间', dataIndex: 'createdAt', width: 180 },
          {
            title: '操作', width: 200,
            render: (_, r) => (
              <Space>
                <Button size="small" type="link" onClick={async () => {
                  const d = await getResumeDetail(r.id);
                  setDetail(d.resume);
                }}>详情</Button>
                <Popconfirm title="确认删除？" onConfirm={async () => {
                  await deleteResume(r.id);
                  message.success('已删除');
                  load(page);
                }}>
                  <Button size="small" type="link" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        open={!!detail}
        title="简历详情"
        width={900}
        onCancel={() => setDetail(null)}
        footer={null}
      >
        {detail && (
          <div>
            <p>用户：{detail.user?.username}（{detail.user?.email}）</p>
            <p>类型：{detail.fileType}</p>
            <p>上传时间：{detail.createdAt}</p>
            {detail.analysis && <p>评分：<Tag color="blue">{Number(detail.analysis.totalScore).toFixed(1)}</Tag></p>}
            <h4>简历原文</h4>
            <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12, fontSize: 12 }}>
              {detail.rawText}
            </pre>
            {detail.analysis?.resultJson?.dimensions?.map((d: any) => (
              <div key={d.name} style={{ marginTop: 12 }}>
                <strong>{d.name}：{d.score}</strong>
                {d.issues.map((i: any, idx: number) => (
                  <div key={idx} style={{ marginLeft: 16, marginTop: 4, fontSize: 13 }}>
                    • 原：{i.original}<br />• 改：{i.suggestion}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2：测试 & 提交**

```bash
git add frontend/src/pages/admin/ResumeList.tsx
git commit -m "feat(admin): 简历列表+详情+删除"
```

---

### Task 6.4：端到端冒烟测试

- [ ] **Step 1：本地完整跑一遍**

1. 启动后端 + 前端
2. 注册新用户 → 收验证码 → 提交
3. 上传一份 PDF → 自动跳转分析页
4. SSE 实时流式输出
5. 看到雷达图 + 5 维度建议
6. 点"采纳" → 200
7. "历史记录" → 看到刚才那条
8. 点"导出" → 下载 txt
9. SQL 把自己设 admin
10. 退出重新登录 → 侧边栏多 3 项
11. 数据面板 → 看到 4 个数字
12. 用户管理 → 搜自己 → 详情弹窗
13. 简历管理 → 评分筛选 → 删除一条

- [ ] **Step 2：记录问题并修复**

如无问题：
```bash
git commit --allow-empty -m "test(e2e): 端到端冒烟通过"
```

---

### Task 6.5：前端 README

**Files:**
- Create: `frontend/README.md`

- [ ] **Step 1：写**

```markdown
# 前端 (Resume Optimizer Frontend)

## 开发
\`\`\`bash
npm install
npm run dev  # http://localhost:5173
\`\`\`

Vite 已配置 `/api` 代理到 `http://localhost:3000`。

## 目录
- `src/api/`  API 客户端与各模块
- `src/components/`  通用组件（common / user / admin）
- `src/pages/`  页面（Login / Register / user/ / admin/）
- `src/router.tsx`  路由 + 守卫
- `src/store.ts`  zustand 全局状态

## 部署
参见 [docs/DEPLOY.md](../docs/DEPLOY.md)
```

- [ ] **Step 2：提交**

```bash
git add frontend/README.md
git commit -m "docs(frontend): README"
```

---

**Phase 5-6 完结。下一步：[部署子计划](AI简历优化器-部署.md)**


