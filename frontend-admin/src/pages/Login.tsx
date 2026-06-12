import { Form, Input, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'motion/react';
import { LockOutlined, UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { login } from '@/api/auth';
import { useApp } from '@/store';
import './login.css';

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
      if (data.admin.role !== 'admin' && data.admin.role !== 'SUPER_ADMIN') {
        message.error('该账号没有管理员权限');
        return;
      }
      setAuth(data.accessToken, data.admin);
      message.success('登录成功');
      navigate('/');
    } catch (e: any) {
      message.error(e.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-stage">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="login-head">
          <div className="login-brand">
            <div className="brand-mark">
              <i /><i /><i /><i />
            </div>
            <span className="brand-text">
              智能简历优化
              <small>管理后台</small>
            </span>
          </div>
          <div className="login-eyebrow">
            <span className="dot" /> 管理员登录入口
          </div>
        </header>

        <h1 className="h-display login-title">管理员登录</h1>
        <p className="login-sub muted">
          此入口仅供管理员使用，普通用户请前往产品前台。
        </p>

        <Form form={form} onFinish={onFinish} layout="vertical" className="login-form" requiredMark={false}>
          <Form.Item name="username" label="账号">
            <Input
              size="large"
              prefix={<UserOutlined style={{ color: 'var(--text-faint)' }} />}
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
          <div className="field-hint">请输入管理员账号</div>

          <Form.Item name="password" label="密码">
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: 'var(--text-faint)' }} />}
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

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
            className="login-submit"
          >
            登录 <ArrowRightOutlined />
          </Button>
        </Form>

        <footer className="login-foot muted">
          <span>v1.0.0 · {new Date().getFullYear()}</span>
        </footer>
      </motion.div>
    </div>
  );
}
