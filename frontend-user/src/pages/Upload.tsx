import { Upload as AntUpload, message, Input, Form, Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import type { UploadProps } from 'antd';
import { uploadResume } from '@/api/resume';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import BlurText from '@/components/ui/BlurText';
import './upload.css';

const { Dragger } = AntUpload;
const { TextArea } = Input;

const blockChineseInput = (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.preventDefault();
};

export default function Upload() {
  useAccountStatus();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const startedRef = useRef(false);

  const handleUpload = async (values: { targetPosition: string; jobDescription?: string }) => {
    if (!file) {
      message.error('请先上传简历文件');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    setProgress(15);
    const t1 = setTimeout(() => setProgress(45), 250);
    const t2 = setTimeout(() => setProgress(80), 700);
    try {
      const data = await uploadResume(file);
      setProgress(100);
      message.success('上传成功，开始分析');
      setTimeout(() => navigate(`/app/result/${data.resumeId}`, {
        state: {
          rawText: data.rawText,
          targetPosition: values.targetPosition,
          jobDescription: values.jobDescription,
        }
      }), 300);
    } catch (e: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      message.error(e.response?.data?.error || '上传失败');
      setLoading(false);
      setProgress(0);
      startedRef.current = false;
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.pdf,.docx,.txt',
    showUploadList: false,
    beforeUpload: (file) => {
      setFile(file as File);
      return false;
    },
    onRemove: () => { setFile(null); return true; },
  };

  const dimensions = [
    { n: '01', t: '岗位匹配度', d: '简历与目标职位的契合程度' },
    { n: '02', t: '技能差距分析', d: '缺失的关键技能与能力' },
    { n: '03', t: '经历量化呈现', d: '如何用数据说话' },
    { n: '04', t: '关键词优化', d: 'JD 关键词覆盖度' },
    { n: '05', t: '改进优先级', d: '最紧急的提升项' },
  ];

  return (
    <div className="upload-stage">
      {/* 背景纹理 */}
      <div className="stage-bg">
        <div className="bg-noise" />
        <div className="bg-glow bg-glow--1" />
        <div className="bg-glow bg-glow--2" />
        <div className="bg-grid" />
      </div>

      {/* Hero */}
      <motion.div
        className="upload-hero"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="hero-eyebrow">
          <span className="eyebrow-line" />
          <span>STEP 01 — UPLOAD & ANALYZE</span>
        </div>
        <h1 className="hero-title">
          <BlurText text="让 AI" delay={70} />
          <BlurText text="帮你匹配理想职位" delay={70} />
        </h1>
        <p className="hero-sub">
          上传简历，填写目标职位。AI 将从五个维度深度分析，指出差距并给出具体优化建议。
        </p>
      </motion.div>

      {/* 主工作区 */}
      <motion.div
        className="upload-layout"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* 左侧：上传 + 表单 */}
        <div className="layout-main">
          <Form form={form} layout="vertical" onFinish={handleUpload} disabled={loading}>
            {/* 上传区 */}
            <section className="upload-block">
              <Dragger
                {...uploadProps}
                disabled={loading}
                className={`upload-dragger ${file ? 'has-file' : ''} ${loading ? 'loading' : ''}`}
              >
                <div className="drop-inner">
                  <div className="drop-icon">
                    {loading ? (
                      <div className="loading-spinner">
                        <div className="spinner-track" />
                        <div className="spinner-fill" style={{ ['--progress' as string]: `${progress}%` }} />
                      </div>
                    ) : (
                      <>
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                          <path d="M18 26V10M18 10L12 16M18 10L24 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6 26V29C6 29.8284 6.67157 30.5 7.5 30.5H28.5C29.3284 30.5 30 29.8284 30 29V26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="drop-orbit" />
                      </>
                    )}
                  </div>
                  <p className="drop-label">
                    {file ? <span className="file-name">{file.name}</span> : '拖拽文件到此处，或点击选择'}
                  </p>
                  {!file && <p className="drop-sub">PDF · DOCX · TXT · 最大 10MB</p>}
                </div>
              </Dragger>
              {file && !loading && (
                <motion.div
                  className="file-badge"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="badge-icon">✓</span>
                  <span>{(file.size / 1024).toFixed(0)} KB</span>
                </motion.div>
              )}
            </section>

            {/* 表单区 */}
            <section className="form-block">
              <div className="block-header">
                <span className="block-num">02</span>
                <span className="block-title">目标职位</span>
              </div>

              <Form.Item name="targetPosition" label="期望职位" rules={[{ required: true, message: '请输入期望职位' }]}>
                <Input placeholder="例如：高级前端工程师、产品经理、数据分析师" onCompositionStart={blockChineseInput} className="dark-input" size="large" />
              </Form.Item>

              <Form.Item name="jobDescription" label="职位描述（可选）">
                <TextArea placeholder="粘贴目标职位的 JD 描述，AI 将更精准分析匹配度" rows={4} onCompositionStart={blockChineseInput} className="dark-textarea" />
              </Form.Item>

              <Button type="primary" size="large" htmlType="submit" loading={loading} block className="analyze-btn">
                {loading ? '正在分析中…' : '开始分析'}
              </Button>
            </section>
          </Form>
        </div>

        {/* 右侧：分析维度 */}
        <aside className="layout-side">
          <div className="side-label">AI 分析维度</div>
          <ul className="dim-list">
            {dimensions.map((item, i) => (
              <motion.li
                key={item.n}
                className="dim-item"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="dim-num">{item.n}</span>
                <div className="dim-body">
                  <span className="dim-title">{item.t}</span>
                  <span className="dim-desc">{item.d}</span>
                </div>
                <div className="dim-line" />
              </motion.li>
            ))}
          </ul>
          <div className="side-trust">
            <div className="trust-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L1 4.5V8.5C1 12.1 4 15.1 8 15.5C12 15.1 15 12.1 15 8.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6 8L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span>文件经 TLS 加密传输，分析完成后可随时删除</span>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
