import { Form, Input, Button, message } from 'antd';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'motion/react';
import { register } from '@/api/auth';
import { useApp } from '@/store';
import BlurText from '@/components/ui/BlurText';
import Aurora from '@/components/ui/Aurora';
import CaptchaInput from '@/components/ui/CaptchaInput';
import './auth.css';

// 阻止中文输入
const blockChineseInput = (e: React.CompositionEvent<HTMLInputElement>) => {
  e.preventDefault();
};

// 过滤中文字符
const filterChinese = (value: string) => {
  return value.replace(/[\u4e00-\u9fa5]/g, '');
};

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useApp((s) => s.setAuth);
  const [form] = Form.useForm();
  const [captchaCode, setCaptchaCode] = useState('');

  const onFinish = async (values: any) => {
    const inputCode = (values.captcha || '').trim();
    if (!inputCode) {
      form.setFields([{ name: 'captcha', errors: ['请输入图形验证码'] }]);
      return;
    }
    if (inputCode !== captchaCode) {
      form.setFields([{ name: 'captcha', errors: ['图形验证码错误，请重新输入'] }]);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: values.username,
        password: values.password,
      };
      const data = await register(payload);
      setAuth(data.accessToken, data.user);
      message.success('注册成功');
      navigate('/app');
    } catch (e: any) {
      message.error(e.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
      <div className="auth-aurora">
        <Aurora colorStops={['#A78BFA', '#5EEAD4', '#A78BFA']} amplitude={1.4} blend={0.8} speed={0.3} />
      </div>
      <div className="aurora-noise" />

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth-eyebrow">CREATE ACCOUNT</div>
        <h1 className="auth-title display">
          <BlurText text="几秒钟，" delay={70} />
          <BlurText text="开始你的职涯升级" delay={70} />
        </h1>
        <p className="auth-sub">
          免费使用全部功能，<br />
          立即获取 <span className="accent">5 维度专业评分</span>。
        </p>

        <Form
          form={form}
          onFinish={onFinish}
          layout="vertical"
          className="auth-form"
          requiredMark={false}
          onValuesChange={(_, allValues) => {
            if (allValues.username && /[\u4e00-\u9fa5]/.test(allValues.username)) {
              form.setFieldsValue({ username: filterChinese(allValues.username) });
            }
            if (allValues.password && /[\u4e00-\u9fa5]/.test(allValues.password)) {
              form.setFieldsValue({ password: filterChinese(allValues.password) });
            }
          }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, min: 3, max: 20, message: '3-20 位' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '仅字母、数字、下划线' },
            ]}
          >
            <Input
              size="large"
              autoComplete="username"
              onCompositionStart={blockChineseInput}
            />
          </Form.Item>
          <div className="field-hint">字母数字下划线</div>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, min: 8, message: '至少 8 位' },
              {
                validator(_, value) {
                  if (!value) return Promise.resolve();
                  const checks = [
                    /[a-z]/.test(value) ? 0 : 1,
                    /[A-Z]/.test(value) ? 0 : 1,
                    /\d/.test(value) ? 0 : 1,
                    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value) ? 0 : 1,
                  ];
                  const missing = checks.filter(c => c === 1).length;
                  if (missing >= 2) {
                    return Promise.reject(new Error('需包含大写+小写字母+数字+特殊字符，至少满足其中3项'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              onCompositionStart={blockChineseInput}
            />
          </Form.Item>
          <div className="field-hint">至少 8 位，含大写+小写字母+数字+特殊字符</div>

          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              onCompositionStart={blockChineseInput}
            />
          </Form.Item>
          <div className="field-hint">再次输入密码</div>

          <Form.Item
            name="captcha"
            label="图形验证码"
            rules={[{ required: true, message: '请输入图形验证码' }]}
          >
            <CaptchaInput
              onCaptchaChange={setCaptchaCode}
            />
          </Form.Item>
          <div className="field-hint">请输入图中 4 位数字</div>

          <Button type="primary" htmlType="submit" size="large" loading={loading} block className="auth-submit">
            创建账号
          </Button>
        </Form>

        <div className="auth-foot">
          已有账号？<Link to="/login">立即登录 →</Link>
        </div>
      </motion.div>
    </div>
  );
}
