import { useEffect, useState, useRef } from 'react';
import { Table, Input, Button, Modal, Space, InputNumber, message, Tag } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined, CloseOutlined, SyncOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import dayjs from 'dayjs';
import { getResumes, getResumeDetail, getResumePreviewUrl, deleteResume } from '@/api/admin';
import BlurText from '@/components/ui/BlurText';
import './list.css';

const REFRESH_INTERVAL = 30_000; // 30 秒

export default function ResumeList() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ keyword: '', minScore: 0, maxScore: 10 });
  const [detail, setDetail] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const timerRef = useRef<number | null>(null);

  const load = async (p = 1, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getResumes({ ...filters, page: p, pageSize: 20 });
      setList(data.list ?? []);
      setTotal(data.pagination?.total ?? 0);
      setPage(p);
      setLastSync(new Date());
    } catch {
      if (!silent) message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    timerRef.current = window.setInterval(() => load(page, true), REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="list-stage">
      <motion.header
        className="list-head"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 8 }}>简历 · 全部</div>
          <h1 className="h-display list-title">
            <BlurText text="简历管理" delay={40} />
          </h1>
          <p className="muted" style={{ fontSize: '0.875rem', marginTop: 4 }}>
            共 <span className="text-mono" style={{ color: 'var(--text)' }}>{total}</span> 份简历
            <SyncOutlined style={{ marginLeft: 6, fontSize: 12 }} />
            <span style={{ marginLeft: 4 }}>{lastSync.toLocaleTimeString('zh-CN')}</span>
          </p>
        </div>
      </motion.header>

      <motion.div
        className="filters"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
      >
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: 'var(--text-faint)' }} />}
          placeholder="搜索文件名 / 用户名"
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
          style={{ width: 280 }}
          onPressEnter={() => load(1)}
        />
        <div className="filter-group">
          <span className="filter-label">评分</span>
          <InputNumber min={0} max={10} step={0.5} value={filters.minScore} onChange={(v) => setFilters((f) => ({ ...f, minScore: v ?? 0 }))} style={{ width: 80 }} />
          <span className="muted">—</span>
          <InputNumber min={0} max={10} step={0.5} value={filters.maxScore} onChange={(v) => setFilters((f) => ({ ...f, maxScore: v ?? 10 }))} style={{ width: 80 }} />
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(page)}>刷新</Button>
      </motion.div>

      <motion.div
        className="list-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={list}
          pagination={{ current: page, total, pageSize: 20, onChange: (p) => load(p, false), showSizeChanger: false }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 70, render: (id) => <span className="text-mono mono-id">#{String(id).padStart(4, '0')}</span> },
            { title: '文件名', dataIndex: 'originalFilename', render: (n) => <span style={{ color: 'var(--text)', fontWeight: 500 }}>{n || '—'}</span> },
            {
              title: '用户',
              width: 140,
              render: (_, r: any) => (
                <div>
                  <div style={{ color: 'var(--text)' }}>{r.user?.username || '—'}</div>
                  {r.user?.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.user.email}</div>}
                </div>
              ),
            },
            {
              title: '类型',
              dataIndex: 'fileType',
              width: 80,
              render: (t) => <span className="text-mono" style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--bg-subtle)', borderRadius: 4 }}>{t ? String(t).split('/')[1]?.toUpperCase() : '—'}</span>,
            },
            {
              title: '期望职位',
              dataIndex: 'targetPosition',
              width: 140,
              render: (v) => v ? <span style={{ color: 'var(--text)' }}>{v}</span> : <span className="muted">—</span>,
            },
            {
              title: '评分',
              width: 100,
              align: 'right',
              render: (_, r: any) => {
                const s = r.totalScore;
                if (s == null) return <span className="muted">—</span>;
                return <span className="text-mono" style={{ color: s >= 7 ? 'var(--success)' : s >= 5 ? 'var(--warning)' : 'var(--danger)', fontWeight: 600, fontSize: '0.9375rem' }}>{Number(s).toFixed(1)}</span>;
              },
            },
            {
              title: '上传时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (t) => <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—'}</span>,
            },
            {
              title: '操作',
              width: 140,
              align: 'right',
              render: (_, r) => (
                <Space size={4}>
                  <Button size="small" type="text" icon={<EyeOutlined />} onClick={async () => { try { const [d, url] = await Promise.all([getResumeDetail(r.id), getResumePreviewUrl(r.id)]); setDetail(d.data || d); setPreviewUrl(url); } catch { message.error('加载失败'); } }} />
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={async () => { try { await deleteResume(r.id); message.success('已删除'); load(page); } catch { message.error('删除失败'); } }} />
                </Space>
              ),
            },
          ]}
        />
      </motion.div>

      <Modal open={!!detail} onCancel={() => { setDetail(null); setPreviewUrl(''); }} footer={null} width={820} title={<div className="modal-title"><span>{detail?.originalFilename}</span><Button size="small" type="text" icon={<CloseOutlined />} onClick={() => { setDetail(null); setPreviewUrl(''); }} /></div>} closeIcon={null}>
        {detail && (
          <div>
            <div className="detail-meta" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <div className="meta-item"><span className="muted">用户</span><span>{detail.user?.username || '—'}</span></div>
              <div className="meta-item"><span className="muted">类型</span><span className="text-mono">{detail.fileType ? String(detail.fileType).split('/')[1]?.toUpperCase() : '—'}</span></div>
              <div className="meta-item"><span className="muted">期望职位</span><span>{detail.analysis?.targetPosition || '—'}</span></div>
              <div className="meta-item"><span className="muted">上传</span><span className="text-mono">{detail.createdAt ? dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm') : '—'}</span></div>
              <div className="meta-item"><span className="muted">评分</span>{detail.analysis?.totalScore != null ? <span className="text-mono" style={{ color: detail.analysis.totalScore >= 7 ? 'var(--success)' : detail.analysis.totalScore >= 5 ? 'var(--warning)' : 'var(--danger)', fontWeight: 600 }}>{Number(detail.analysis.totalScore).toFixed(1)} / 10</span> : <span className="muted">—</span>}</div>
            </div>

            {/* 在线预览原始文件 */}
            {previewUrl && detail.fileType === 'application/pdf' && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className="h-eyebrow" style={{ marginBottom: '0.75rem' }}>在线预览</div>
                <iframe
                  src={previewUrl}
                  style={{ width: '100%', height: '500px', border: '1px solid var(--border)', borderRadius: 8 }}
                  title="简历预览"
                />
              </div>
            )}

            <div className="h-eyebrow" style={{ margin: '1.5rem 0 0.75rem' }}>简历原文</div>
            <pre className="raw-text">{detail.content || detail.rawText || '暂无内容'}</pre>
            {detail.analysis?.resultJson?.dimensions && (
              <>
                <div className="h-eyebrow" style={{ margin: '1.5rem 0 0.75rem' }}>评估详情</div>
                <div className="dim-grid">
                  {detail.analysis.resultJson.dimensions.map((d: any) => (
                    <div key={d.name} className="dim-cell">
                      <div className="dim-cell-head"><span className="dim-cell-name">{d.name}</span><span className="dim-cell-score" style={{ color: d.score >= 7 ? 'var(--success)' : d.score >= 5 ? 'var(--warning)' : 'var(--danger)' }}>{d.score}</span></div>
                      {d.issues?.length > 0 && <div className="dim-cell-issues">{d.issues.map((i: any, idx: number) => (<div key={idx} className="issue-mini"><div className="issue-mini-row"><Tag>原</Tag><span style={{ textDecoration: 'line-through', color: 'var(--text-faint)' }}>{i.original}</span></div><div className="issue-mini-row"><Tag color="default">改</Tag><span style={{ color: 'var(--text)' }}>{i.suggestion}</span></div></div>))}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
