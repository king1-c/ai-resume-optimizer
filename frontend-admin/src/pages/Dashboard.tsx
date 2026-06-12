import { useEffect, useState, useRef } from 'react';
import { Spin } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  TeamOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  StarFilled,
  SyncOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import { getStats } from '@/api/admin';
import CountUp from '@/components/ui/CountUp';
import BlurText from '@/components/ui/BlurText';
import './dashboard.css';

interface Stats {
  totalUsers: number;
  totalResumes: number;
  totalAnalyses: number;
  todayUsers: number;
  todayAnalyses: number;
  successRate: number;
  userGrowth: number;
  resumeGrowth: number;
  todayCompareYesterday: number;
  successRateTrend: number;
}

const REFRESH_INTERVAL = 15_000; // 15 秒

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const timerRef = useRef<number | null>(null);

  const loadData = async () => {
    try {
      const data = await getStats();
      setStats(data.stats);
      setLastSync(new Date());
    } catch {
      // silently fail, next retry will catch up
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    timerRef.current = window.setInterval(loadData, REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="loading-stage">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="dash-stage">
      <motion.header
        className="dash-head"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 8 }}>
            <span className="status-dot" /> 概览 · 实时
          </div>
          <h1 className="h-display dash-title">
            <BlurText text="系统" delay={40} /> <BlurText text="概览" delay={40} />
          </h1>
        </div>
        <div className="dash-meta">
          <div className="meta-row">
            <span className="muted">最后同步</span>
            <span className="text-mono">{lastSync.toLocaleString('zh-CN')}</span>
            <SyncOutlined className="muted" style={{ marginLeft: 4, fontSize: 12 }} />
          </div>
          <div className="meta-row">
            <span className="muted">状态</span>
            <span className="text-mono" style={{ color: 'var(--success)' }}>● 运行中</span>
          </div>
        </div>
      </motion.header>

      <div className="kpi-grid">
        <KpiCard
          label="总用户数"
          value={stats.totalUsers}
          icon={<TeamOutlined />}
          delta={`${stats.userGrowth >= 0 ? '+' : ''}${stats.userGrowth}%`}
          positive={stats.userGrowth >= 0}
          index={0}
        />
        <KpiCard
          label="简历总数"
          value={stats.totalResumes}
          icon={<FileTextOutlined />}
          delta={`${stats.resumeGrowth >= 0 ? '+' : ''}${stats.resumeGrowth}%`}
          positive={stats.resumeGrowth >= 0}
          index={1}
        />
        <KpiCard
          label="今日分析"
          value={stats.todayAnalyses}
          icon={<ThunderboltOutlined />}
          delta={stats.todayCompareYesterday !== 0 ? `${stats.todayCompareYesterday >= 0 ? '+' : ''}${stats.todayCompareYesterday}` : '平'}
          positive={stats.todayCompareYesterday >= 0}
          index={2}
        />
        <KpiCard
          label="分析成功率"
          value={stats.successRate}
          decimals={0}
          suffix="%"
          icon={<StarFilled />}
          delta={`${stats.successRateTrend >= 0 ? '+' : ''}${stats.successRateTrend}%`}
          positive={stats.successRateTrend >= 0}
          index={3}
        />
      </div>

      <motion.div
        className="recent-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="chart-head">
          <div>
            <div className="h-eyebrow">数据 · 概览</div>
            <div className="chart-title">关键指标说明</div>
          </div>
        </div>
        <div className="recent-list">
          <div className="recent-item">
            <span className="ri-num">01</span>
            <div className="ri-name">
              <div>总用户数</div>
              <div className="ri-user">平台注册的所有用户数量</div>
            </div>
            <span className="ri-score good">{stats.totalUsers}</span>
          </div>
          <div className="recent-item">
            <span className="ri-num">02</span>
            <div className="ri-name">
              <div>简历总数</div>
              <div className="ri-user">用户上传的所有简历数量</div>
            </div>
            <span className="ri-score good">{stats.totalResumes}</span>
          </div>
          <div className="recent-item">
            <span className="ri-num">03</span>
            <div className="ri-name">
              <div>今日分析</div>
              <div className="ri-user">今日完成的简历分析次数</div>
            </div>
            <span className="ri-score good">{stats.todayAnalyses}</span>
          </div>
          <div className="recent-item">
            <span className="ri-num">04</span>
            <div className="ri-name">
              <div>分析成功率</div>
              <div className="ri-user">AI 分析成功完成的百分比</div>
            </div>
            <span className="ri-score good">{stats.successRate}%</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  delta,
  positive = true,
  decimals = 0,
  suffix = '',
  index,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  delta?: string;
  positive?: boolean;
  decimals?: number;
  suffix?: string;
  index: number;
}) {
  return (
    <motion.div
      className="kpi-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.05 }}
    >
      <div className="kpi-head">
        <span className="kpi-icon">{icon}</span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">
        <CountUp to={value} decimals={decimals} duration={1.6} />
        {suffix && <span className="kpi-suffix">{suffix}</span>}
      </div>
      {delta && (
        <div className="kpi-delta">
          {positive ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {delta}
          <span className="muted"> 环比昨日</span>
        </div>
      )}
    </motion.div>
  );
}
