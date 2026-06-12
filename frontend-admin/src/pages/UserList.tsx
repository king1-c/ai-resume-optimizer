import { useEffect, useState, useRef } from 'react';
import { Table, Input, Tag, Button, Modal, Space, message, Avatar, Switch, Popconfirm } from 'antd';
import { SearchOutlined, CloseOutlined, LockOutlined, UnlockOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import dayjs from 'dayjs';
import { getUsers, getUserDetail, blockUser, unblockUser, deleteUser } from '@/api/admin';
import BlurText from '@/components/ui/BlurText';
import './list.css';

const REFRESH_INTERVAL = 30_000; // 30 秒

export default function UserList() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const timerRef = useRef<number | null>(null);

  const load = async (p: number = 1, k: string = keyword, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await getUsers(k, p);
      setList(result?.list ?? []);
      setTotal(result?.pagination?.total ?? 0);
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
    timerRef.current = window.setInterval(() => load(page, keyword, true), REFRESH_INTERVAL);
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
          <div className="h-eyebrow" style={{ marginBottom: 8 }}>用户 · 全部</div>
          <h1 className="h-display list-title">
            <BlurText text="用户管理" delay={40} />
          </h1>
          <p className="muted" style={{ fontSize: '0.875rem', marginTop: 4 }}>
            共 <span className="text-mono" style={{ color: 'var(--text)' }}>{total}</span> 位注册用户
            <SyncOutlined style={{ marginLeft: 6, fontSize: 12 }} />
            <span style={{ marginLeft: 4 }}>{lastSync.toLocaleTimeString('zh-CN')}</span>
          </p>
        </div>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: 'var(--text-faint)' }} />}
          placeholder="搜索用户名或邮箱"
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => load(1, keyword)}
          style={{ width: 280 }}
          size="large"
        />
      </motion.header>

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
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (p) => load(p),
            showSizeChanger: false,
          }}
          columns={[
            {
              title: 'ID',
              dataIndex: 'id',
              width: 70,
              render: (id: any) => (
                <span className="text-mono mono-id">#{String(id).padStart(4, '0')}</span>
              ),
            },
            {
              title: '用户',
              dataIndex: 'username',
              render: (username: any, r: any) => (
                <div className="user-cell">
                  <Avatar size={32} className="user-avatar">
                    {(username ?? '?')?.[0]?.toUpperCase()}
                  </Avatar>
                  <div className="user-info">
                    <div className="user-name">{username || '—'}</div>
                    {r.email && <div className="user-email">{r.email}</div>}
                  </div>
                </div>
              ),
            },
            {
              title: 'IP 地址',
              dataIndex: 'lastLoginIP',
              width: 150,
              render: (ip: any) => (
                <span className="text-mono" style={{ fontSize: '0.8125rem' }}>
                  {ip || '—'}
                </span>
              ),
            },
            {
              title: '角色',
              width: 100,
              render: () => <Tag>普通用户</Tag>,
            },
            {
              title: '简历数',
              dataIndex: 'resumeCount',
              width: 80,
              align: 'right',
              render: (n: any) => <span className="text-mono">{n ?? 0}</span>,
            },
            {
              title: '注册时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (t: any) => (
                <span className="text-mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—'}
                </span>
              ),
            },
            {
              title: '最后活跃',
              dataIndex: 'lastLoginAt',
              width: 170,
              render: (t: any) => (
                <span className="text-mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '—'}
                </span>
              ),
            },
            {
              title: '操作',
              width: 220,
              align: 'right',
              render: (_: any, r: any) => (
                <Space size="small">
                  {r.isActive === false ? (
                    <Popconfirm
                      title="确定要解封此用户吗？"
                      description="解封后用户账号将恢复正常，关联封禁的IP也将被解封。"
                      onConfirm={async () => {
                        try {
                          await unblockUser(r.id);
                          message.success('已解封用户');
                          load(page);
                        } catch {
                          message.error('解封失败');
                        }
                      }}
                    >
                      <Button size="small" type="primary" icon={<UnlockOutlined />}>
                        解封
                      </Button>
                    </Popconfirm>
                  ) : (
                    <Popconfirm
                      title="确定要封禁此用户吗？"
                      description="封禁后用户账号将被禁用，且其登录IP也将被封禁。"
                      onConfirm={async () => {
                        try {
                          await blockUser(r.id);
                          message.success('已封禁用户');
                          load(page);
                        } catch {
                          message.error('封禁失败');
                        }
                      }}
                    >
                      <Button size="small" danger icon={<LockOutlined />}>
                        封禁
                      </Button>
                    </Popconfirm>
                  )}
                  <Button
                      size="small"
                      type="default"
                      onClick={async () => {
                        try {
                          const d = await getUserDetail(r.id);
                          setDetail(d);
                        } catch {
                          message.error('加载失败');
                        }
                      }}
                    >
                      详情
                    </Button>
                    <Popconfirm
                      title="确定要删除此用户吗？"
                      description="删除后将永久移除该用户的所有数据（简历、分析记录、登录日志等），此操作不可撤销。"
                      onConfirm={async () => {
                        try {
                          await deleteUser(r.id);
                          message.success('用户已删除');
                          load(page);
                        } catch {
                          message.error('删除失败');
                        }
                      }}
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </motion.div>

      <Modal
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
        title={
          <div className="modal-title">
            <span>{detail?.username}</span>
            <Button
              size="small"
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setDetail(null)}
            />
          </div>
        }
        closeIcon={null}
      >
        {detail && (
          <div>
            <div className="detail-meta">
              <div className="meta-item">
                <span className="muted">角色</span>
                <Tag>普通用户</Tag>
              </div>
              <div className="meta-item">
                <span className="muted">注册</span>
                <span className="text-mono">
                  {detail.createdAt ? dayjs(detail.createdAt).format('YYYY-MM-DD') : '—'}
                </span>
              </div>
            </div>

            <div className="h-eyebrow" style={{ margin: '1.5rem 0 0.75rem' }}>
              上传的简历 · {detail.resumes?.length || 0}
            </div>
            <Table
              rowKey="id"
              size="small"
              dataSource={detail.resumes || []}
              pagination={false}
              columns={[
                {
                  title: '文件名',
                  dataIndex: 'originalFilename',
                  render: (n) => <span style={{ color: 'var(--text)' }}>{n || '—'}</span>,
                },
                {
                  title: '类型',
                  dataIndex: 'fileType',
                  width: 80,
                  render: (t) => (
                    <span className="text-mono" style={{ fontSize: '0.75rem' }}>
                      {t?.toUpperCase() || '—'}
                    </span>
                  ),
                },
                {
                  title: '评分',
                  width: 80,
                  align: 'right',
                  render: (_: any, r: any) => {
                    const s = r.analysis?.totalScore;
                    if (s == null) return <span className="muted">—</span>;
                    return (
                      <span
                        className="text-mono"
                        style={{
                          color:
                            s >= 7
                              ? 'var(--success)'
                              : s >= 5
                              ? 'var(--warning)'
                              : 'var(--danger)',
                          fontWeight: 500,
                        }}
                      >
                        {Number(s).toFixed(1)}
                      </span>
                    );
                  },
                },
                {
                  title: '时间',
                  dataIndex: 'createdAt',
                  width: 150,
                  render: (t) => (
                    <span
                      className="text-mono"
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                    >
                      {t ? dayjs(t).format('MM-DD HH:mm') : '—'}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
