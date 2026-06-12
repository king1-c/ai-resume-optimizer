import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Empty, Tooltip } from 'antd';
import {
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { getHistory, downloadResume } from '@/api/resume';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import BlurText from '@/components/ui/BlurText';
import CountUp from '@/components/ui/CountUp';
import './history.css';

export default function History() {
  useAccountStatus();
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const data = await getHistory(p, 10);
      setList(data.list || []);
      setTotal(data.total ?? 0);
      setPage(p);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const avgScore =
    list.length > 0
      ? list.reduce((acc, r) => acc + (r.totalScore ?? 0), 0) / list.filter((r) => r.totalScore != null).length
      : 0;

  const scoredCount = list.filter((r) => r.totalScore != null).length;

  return (
    <div className="history-stage">
      <motion.header
        className="history-head"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="eyebrow" style={{ marginBottom: '0.875rem' }}>
          <span className="dot" /> ARCHIVE
        </div>
        <h1 className="display history-title">
          <BlurText text="你的简历" delay={50} />
          <BlurText text="优化记录" delay={50} />
        </h1>
        <p className="history-sub">
          所有上传过的简历都将保存在这里，<br />
          你可以随时查看历史评分或重新导出优化版。
        </p>
      </motion.header>

      <motion.div
        className="history-stats"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="stat-card">
          <div className="stat-label">TOTAL · 总数</div>
          <div className="stat-value">
            <CountUp to={Math.max(0, total)} duration={1.4} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">SCORED · 已分析</div>
          <div className="stat-value">
            <CountUp to={Math.max(0, scoredCount)} duration={1.4} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">AVG · 平均分</div>
          <div className="stat-value">
            <CountUp to={Number.isFinite(avgScore) ? Math.max(0, avgScore) : 0} duration={1.6} decimals={1} />
            <span className="stat-unit">/10</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="history-table-wrap"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
      >
        {list.length === 0 && !loading ? (
          <div className="history-empty">
            <Empty
              image={<FileTextOutlined style={{ fontSize: 48, color: 'var(--text-faint)' }} />}
              description={
                <span className="muted" style={{ fontSize: '0.875rem' }}>
                  还没有记录。开始你的第一份简历优化 →
                </span>
              }
            >
              <Button type="primary" onClick={() => navigate('/app')}>
                去上传
              </Button>
            </Empty>
          </div>
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            dataSource={list}
            pagination={{
              current: page,
              total,
              pageSize: 10,
              onChange: load,
              showSizeChanger: false,
            }}
            columns={[
              {
                title: 'ID',
                dataIndex: 'id',
                width: 70,
                render: (id) => <span className="mono-id">#{String(id).padStart(4, '0')}</span>,
              },
              {
                title: '文件名',
                dataIndex: 'originalFilename',
                render: (name, r) => (
                  <div className="cell-filename">
                    <FileTextOutlined className="cell-icon" />
                    <div>
                      <div className="cell-name">{name || '—'}</div>
                      <div className="cell-time">
                        <ClockCircleOutlined /> {r.createdAt || '—'}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                title: '类型',
                dataIndex: 'fileType',
                width: 80,
                render: (t) => <span className="type-chip">{t?.toUpperCase() || '—'}</span>,
              },
              {
                title: '评分',
                dataIndex: 'totalScore',
                width: 120,
                render: (s) =>
                  s == null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className={`score-pill ${s >= 7 ? 'good' : s >= 5 ? 'mid' : 'low'}`}>
                      {Number(s).toFixed(1)}
                    </span>
                  ),
              },
              {
                title: '操作',
                width: 200,
                align: 'right',
                render: (_, r) => (
                  <Space size="small">
                    <Tooltip title="查看分析">
                      <Button
                        size="small"
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/app/result/${r.id}`)}
                      >
                        查看
                      </Button>
                    </Tooltip>
                    <Tooltip title="导出优化版">
                      <Button
                        size="small"
                        type="text"
                        icon={<DownloadOutlined />}
                        loading={downloadingId === r.id}
                        onClick={async () => {
                          setDownloadingId(r.id);
                          try {
                            await downloadResume(r.id);
                          } finally {
                            setDownloadingId(null);
                          }
                        }}
                      >
                        导出
                      </Button>
                    </Tooltip>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </motion.div>
    </div>
  );
}
