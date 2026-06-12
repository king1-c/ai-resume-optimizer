import { Form, Input, Button, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'motion/react';
import { login } from '@/api/auth';
import { useApp } from '@/store';
import BlurText from '@/components/ui/BlurText';
import Aurora from '@/components/ui/Aurora';
import './auth.css';

// 阻止中文输入
const blockChineseInput = (e: React.CompositionEvent<HTMLInputElement>) => {
  e.preventDefault();
};

// 过滤中文字符
const filterChinese = (value: string) => {
  return value.replace(/[\u4e00-\u9fa5]/g, '');
};

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useApp((s) => s.setAuth);
  const [form] = Form.useForm();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const data = await login(values);
      setAuth(data.accessToken, data.user);
      message.success(`欢迎回来，${data.user.username}`);
      navigate('/app');
    } catch (e: any) {
      message.error(e.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
      <div className="auth-aurora">
        <Aurora colorStops={['#5EEAD4', '#A78BFA', '#5EEAD4']} amplitude={1.5} blend={0.8} speed={0.4} />
      </div>
      <div className="aurora-noise" />

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth-eyebrow">SIGN IN</div>
        <h1 className="auth-title display">
          <BlurText text="重新开始" delay={80} />
        </h1>
        <p className="auth-sub">
          上传简历，让 AI 告诉你<br />
          <span className="accent">5 个维度</span>上的真实表现。
        </p>

        <Form form={form} onFinish={onFinish} layout="vertical" className="auth-form" requiredMark={false}>
          <Form.Item name="username" label="用户名 / 邮箱">
            <Input
              size="large"
              autoComplete="username"
              onCompositionStart={blockChineseInput}
              onChange={(e) => {
                const filtered = filterChinese(e.target.value);
                if (filtered !== e.target.value) {
                  form.setFieldsValue({ username: filtered });
                }
              }}
            />
          </Form.Item>
          <div className="field-hint">请输入用户名或邮箱</div>

          <Form.Item name="password" label="密码">
            <Input.Password
              size="large"
              autoComplete="current-password"
              onCompositionStart={blockChineseInput}
              onChange={(e) => {
                const filtered = filterChinese(e.target.value);
                if (filtered !== e.target.value) {
                  form.setFieldsValue({ password: filtered });
                }
              }}
            />
          </Form.Item>
          <div className="field-hint">请输入密码</div>

          <Button type="primary" htmlType="submit" size="large" loading={loading} block className="auth-submit">
            登录
          </Button>
        </Form>

        <div className="auth-foot">
          还没有账号？<Link to="/register">立即注册 →</Link>
        </div>
      </motion.div>
    </div>
  );
}
