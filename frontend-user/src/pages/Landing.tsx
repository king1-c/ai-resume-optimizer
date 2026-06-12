import { useNavigate, useOutletContext } from 'react-router-dom';
import { Button, Space } from 'antd';
import { UploadOutlined, FileSearchOutlined, HistoryOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import BlurText from '@/components/ui/BlurText';
import CountUp from '@/components/ui/CountUp';
import './landing.css';

interface OutletContext {
  handleAction: (action: () => void) => void;
}

export default function Landing() {
  useAccountStatus();
  const navigate = useNavigate();
  const { handleAction } = useOutletContext<OutletContext>();

  const features = [
    {
      icon: <UploadOutlined />,
      title: '上传简历',
      desc: '支持 PDF、Word、TXT 格式，AI 自动解析内容',
      action: () => navigate('/app'),
    },
    {
      icon: <FileSearchOutlined />,
      title: '智能分析',
      desc: '5 个维度深度评分，找出简历中的关键问题',
      action: () => navigate('/app'),
    },
    {
      icon: <HistoryOutlined />,
      title: '历史记录',
      desc: '随时查看过往分析，追踪简历优化进度',
      action: () => navigate('/app/history'),
    },
  ];

  return (
    <div className="landing-stage">
      <section className="hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="eyebrow">
            <span className="dot" /> AI 简历优化器
          </div>
          <h1 className="hero-title display">
            <BlurText text="让你的简历" delay={60} />
            <BlurText text="脱颖而出" delay={60} />
          </h1>
          <p className="hero-sub">
            基于 Agnes-2.0-Flash 大模型，从结构、内容、量化、关键词、语言<br />
            5 个维度为你的简历打分并给出专业建议
          </p>
          <Space size="middle" className="hero-actions">
            <Button
              type="primary"
              size="large"
              icon={<UploadOutlined />}
              onClick={() => handleAction(() => navigate('/app'))}
            >
              立即上传简历
            </Button>
            <Button
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              了解更多
            </Button>
          </Space>
        </motion.div>

        <motion.div
          className="hero-stats"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="stat-item">
            <div className="stat-num">
              <CountUp to={5} duration={1.5} />
            </div>
            <div className="stat-label">评估维度</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-num">
              <CountUp to={10} duration={1.5} suffix="+" />
            </div>
            <div className="stat-label">秒完成分析</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-num">
              <CountUp to={100} duration={1.5} suffix="%" />
            </div>
            <div className="stat-label">AI 驱动</div>
          </div>
        </motion.div>
      </section>

      <section id="features" className="features">
        <motion.div
          className="section-header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="eyebrow">FEATURES</div>
          <h2 className="section-title display">核心功能</h2>
        </motion.div>

        <div className="feature-grid">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              onClick={() => handleAction(f.action)}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
              <div className="feature-arrow">
                <ArrowRightOutlined />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="cta">
        <motion.div
          className="cta-content"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="cta-title display">
            准备好优化你的简历了吗？
          </h2>
          <p className="cta-sub">
            免费使用全部功能，立即获取专业评分与建议
          </p>
          <Button
            type="primary"
            size="large"
            onClick={() => handleAction(() => navigate('/app'))}
          >
            开始使用
          </Button>
        </motion.div>
      </section>
    </div>
  );
}
