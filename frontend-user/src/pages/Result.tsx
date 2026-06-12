import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, message, Tag, Space, Progress, Collapse, Alert, List } from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  HistoryOutlined,
  CheckOutlined,
  BulbOutlined,
  AimOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { motion } from 'motion/react';
import { analyzeResumeStream, getResumeAnalyses } from '@/api/resume';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import BlurText from '@/components/ui/BlurText';
import CountUp from '@/components/ui/CountUp';
import './result.css';

const { Panel } = Collapse;

interface Dimension {
  name: string;
  score: number;
  comment: string;
  suggestions: string[];
}

interface GapAnalysis {
  summary: string;
  metRequirements: string[];
  unmetRequirements: string[];
  skillGaps: string[];
  priorityFixes: string[];
}

interface ModuleAdjustment {
  module: string;
  action: '补充' | '调整' | '删减';
  reason: string;
  suggestion: string;
}

interface Keywords {
  matched: string[];
  missing: string[];
  suggested: string[];
}

interface AnalysisResult {
  overallScore: number;
  matchScore: number;
  dimensions: Dimension[];
  gapAnalysis: GapAnalysis;
  moduleAdjustments: ModuleAdjustment[];
  generalSuggestions: string[];
  optimizedResume: string;
  keywords: Keywords;
  strengths: string[];
  weaknesses: string[];
}

interface AnalysisRecord {
  id: number;
  targetPosition: string;
  score: number;
  aiModel: string;
  status: string;
  completedAt: string;
  createdAt: string;
  result: any;
  optimizedContent: string;
  keywords: Keywords;
}

export default function Result() {
  useAccountStatus();
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { targetPosition, jobDescription, analysisResult: savedResult } = location.state || {};

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('准备分析...');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [allAnalyses, setAllAnalyses] = useState<AnalysisRecord[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRecord | null>(null);
  const [showAnalysisList, setShowAnalysisList] = useState(false);
  const startedRef = useRef(false);

  const startAnalysis = async () => {
    setLoading(true);
    setProgress(0);
    setStatusMessage('正在准备分析...');

    try {
      for await (const event of analyzeResumeStream(Number(resumeId), targetPosition, jobDescription)) {
        if (event.status === 'failed') {
          throw new Error(event.message || '分析失败');
        }
        setProgress(event.progress);
        setStatusMessage(event.message);
        if (event.status === 'completed' && event.result) {
          setResult(event.result);
          message.success('分析完成');
        }
      }
    } catch (error: any) {
      message.error(error?.response?.data?.error || error?.message || '分析过程中出现错误');
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resumeId || startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      // 先尝试加载已有分析记录
      try {
        const data = await getResumeAnalyses(Number(resumeId));
        const analyses = data.analyses || [];
        setAllAnalyses(analyses);

        if (analyses.length > 0) {
          // 有历史记录，直接显示最新的
          const latest = analyses[0];
          setSelectedAnalysis(latest);
          const r = latest.result || {};
          setResult({
            overallScore: r.overallScore || 0,
            matchScore: r.matchScore || 0,
            dimensions: r.dimensions || [],
            gapAnalysis: r.gapAnalysis || { summary: '', metRequirements: [], unmetRequirements: [], skillGaps: [], priorityFixes: [] },
            moduleAdjustments: [],
            generalSuggestions: r.generalSuggestions || [],
            optimizedResume: latest.optimizedContent || '',
            keywords: latest.keywords || r.keywords || { matched: [], missing: [], suggested: [] },
            strengths: r.strengths || [],
            weaknesses: r.weaknesses || [],
          });
          setLoading(false);
        } else {
          // 没有分析记录，开始新的分析
          startAnalysis();
        }
      } catch {
        // 加载失败，重新开始新的分析
        startAnalysis();
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#1890ff';
    if (score >= 40) return '#faad14';
    return '#f5222d';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    if (score >= 40) return '一般';
    return '需改进';
  };

  const radarOption = result && result.dimensions.length > 0 && {
    backgroundColor: 'transparent',
    radar: {
      indicator: result.dimensions.map((d) => ({ name: d.name, max: 20 })),
      axisName: { color: '#C4C4C8', fontSize: 11, fontFamily: 'Geist, sans-serif' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      splitArea: { areaStyle: { color: ['transparent', 'rgba(255,255,255,0.02)'] } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: result.dimensions.map((d) => d.score),
            name: '评分',
            areaStyle: { color: 'rgba(94, 234, 212, 0.18)' },
            lineStyle: { color: '#5EEAD4', width: 2 },
            itemStyle: { color: '#5EEAD4' },
            symbol: 'circle',
            symbolSize: 6,
          },
        ],
      },
    ],
  };

  const displayResult = result;

  return (
    <div className="result-stage">
      <motion.div
        className="result-toolbar"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="toolbar-left">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app')}>
            返回
          </Button>
          <span className="toolbar-divider" />
          <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            {selectedAnalysis?.targetPosition || targetPosition ? `目标：${selectedAnalysis?.targetPosition || targetPosition}` : `RESUME · #${resumeId}`}
          </span>
        </div>
        <Space>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setShowAnalysisList(!showAnalysisList)}
            disabled={allAnalyses.length === 0}
          >
            分析历史 {allAnalyses.length > 0 && `(${allAnalyses.length})`}
          </Button>
          <Button icon={<HistoryOutlined />} onClick={() => navigate('/app/history')}>
            历史记录
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            disabled={!displayResult}
            onClick={() => {
              if (!displayResult?.optimizedResume) return;
              const blob = new Blob([displayResult.optimizedResume], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `优化简历_${selectedAnalysis?.targetPosition || targetPosition || resumeId}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            导出优化版
          </Button>
        </Space>
      </motion.div>

      {/* 分析历史列表 */}
      {showAnalysisList && allAnalyses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card
            title={<span className="section-title"><ClockCircleOutlined style={{ marginRight: 8 }} />分析记录</span>}
            style={{
              background: 'rgba(10, 10, 15, 0.6)',
              border: '1px solid rgba(94, 234, 212, 0.15)',
              marginBottom: 24,
            }}
          >
            <List
              dataSource={allAnalyses}
              renderItem={(item) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    background: selectedAnalysis?.id === item.id ? 'rgba(94, 234, 212, 0.08)' : 'transparent',
                    padding: '8px 12px',
                    borderRadius: 6,
                  }}
                  onClick={() => {
                    setSelectedAnalysis(item);
                    const r = item.result || {};
                    setResult({
                      overallScore: r.overallScore || 0,
                      matchScore: r.matchScore || 0,
                      dimensions: r.dimensions || [],
                      gapAnalysis: r.gapAnalysis || { summary: '', metRequirements: [], unmetRequirements: [], skillGaps: [], priorityFixes: [] },
                      moduleAdjustments: [],
                      generalSuggestions: r.generalSuggestions || [],
                      optimizedResume: item.optimizedContent || '',
                      keywords: item.keywords || r.keywords || { matched: [], missing: [], suggested: [] },
                      strengths: r.strengths || [],
                      weaknesses: r.weaknesses || [],
                    });
                    setShowAnalysisList(false);
                  }}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.targetPosition || '未指定职位'}</span>
                        <Tag color={item.score >= 7 ? 'success' : item.score >= 5 ? 'warning' : 'error'}>
                          {item.score != null ? Number(item.score).toFixed(1) : '—'} 分
                        </Tag>
                      </Space>
                    }
                    description={`${item.aiModel || 'AI'} · ${item.completedAt ? new Date(item.completedAt).toLocaleString('zh-CN') : item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '—'}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </motion.div>
      )}

      {loading && (
        <motion.div
          className="analyzing-card"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="analyzing-head">
            <div className="analyzing-eyebrow">
              <span className="dot" /> AI 正在分析
            </div>
            <h2 className="display analyzing-title">
              <BlurText text="分析你与" delay={60} />
              <BlurText text="目标职位的差距" delay={60} />
            </h2>
            {(targetPosition || selectedAnalysis?.targetPosition) && (
              <p className="analyzing-target">
                <AimOutlined /> 目标职位：{targetPosition || selectedAnalysis?.targetPosition}
              </p>
            )}
          </div>
          <div className="analyzing-progress">
            <Progress
              percent={progress}
              strokeColor={{ from: '#5EEAD4', to: '#38BDF8' }}
              trailColor="rgba(255,255,255,0.1)"
              showInfo={false}
              style={{ maxWidth: 400, margin: '0 auto' }}
            />
            <p className="analyzing-status">{statusMessage}</p>
          </div>
        </motion.div>
      )}

      {displayResult && displayResult.dimensions.length > 0 && (
        <>
          {/* 综合评分区域 */}
          <motion.div
            className="result-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="result-summary">
              <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>
                <span className="dot" /> OVERALL · 综合评估
              </div>
              <div className="score-display">
                <div className="score-item">
                  <span className="score-label">简历质量</span>
                  <h1 className="display result-title">
                    <span className="big-score" style={{ color: getScoreColor(displayResult.overallScore) }}>
                      <CountUp to={displayResult.overallScore} duration={1.8} />
                    </span>
                    <span className="score-unit">/ 100</span>
                  </h1>
                  <Tag color={getScoreColor(displayResult.overallScore)}>{getScoreLabel(displayResult.overallScore)}</Tag>
                </div>
                <div className="score-divider" />
                <div className="score-item">
                  <span className="score-label">岗位匹配度</span>
                  <h1 className="display result-title">
                    <span className="big-score" style={{ color: getScoreColor(displayResult.matchScore) }}>
                      <CountUp to={displayResult.matchScore} duration={1.8} />
                    </span>
                    <span className="score-unit">/ 100</span>
                  </h1>
                  <Tag color={getScoreColor(displayResult.matchScore)}>{getScoreLabel(displayResult.matchScore)}</Tag>
                </div>
              </div>
            </div>
            <div className="result-radar">
              {radarOption && <ReactECharts option={radarOption} style={{ height: 320 }} />}
            </div>
          </motion.div>

          {/* 差距分析区域 */}
          <motion.div
            className="gap-analysis-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card
              title={
                <span className="section-title">
                  <AimOutlined style={{ marginRight: 8 }} />
                  职位差距分析
                </span>
              }
              style={{
                background: 'rgba(10, 10, 15, 0.6)',
                border: '1px solid rgba(94, 234, 212, 0.2)',
              }}
            >
              {displayResult.gapAnalysis.summary && (
                <Alert
                  message={displayResult.gapAnalysis.summary}
                  type={displayResult.matchScore >= 60 ? 'info' : 'warning'}
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              <div className="gap-grid">
                {displayResult.gapAnalysis.metRequirements.length > 0 && (
                  <div className="gap-card success">
                    <h4><CheckCircleOutlined /> 已满足的要求</h4>
                    <ul>
                      {displayResult.gapAnalysis.metRequirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {displayResult.gapAnalysis.unmetRequirements.length > 0 && (
                  <div className="gap-card warning">
                    <h4><ExclamationCircleOutlined /> 未满足的要求</h4>
                    <ul>
                      {displayResult.gapAnalysis.unmetRequirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {displayResult.gapAnalysis.skillGaps.length > 0 && (
                  <div className="gap-card error">
                    <h4><RiseOutlined /> 技能差距</h4>
                    <ul>
                      {displayResult.gapAnalysis.skillGaps.map((gap, i) => (
                        <li key={i}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {displayResult.gapAnalysis.priorityFixes.length > 0 && (
                  <div className="gap-card priority">
                    <h4><BulbOutlined /> 最紧急的改进</h4>
                    <ul>
                      {displayResult.gapAnalysis.priorityFixes.map((fix, i) => (
                        <li key={i} className="priority-item">
                          <Tag color="red">P{i + 1}</Tag> {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* 模块调整建议 */}
          {displayResult.moduleAdjustments.length > 0 && (
            <motion.div
              className="module-adjustments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card
                title={
                  <span className="section-title">
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    模块调整建议
                  </span>
                }
                style={{
                  background: 'rgba(10, 10, 15, 0.6)',
                  border: '1px solid rgba(94, 234, 212, 0.2)',
                }}
              >
                <Collapse ghost>
                  {displayResult.moduleAdjustments.map((adjustment, i) => (
                    <Panel
                      header={
                        <div className="adjustment-header">
                          <Tag color={adjustment.action === '补充' ? 'blue' : adjustment.action === '调整' ? 'orange' : 'red'}>
                            {adjustment.action}
                          </Tag>
                          <span className="adjustment-module">{adjustment.module}</span>
                          <span className="adjustment-reason">{adjustment.reason}</span>
                        </div>
                      }
                      key={i}
                    >
                      <div className="adjustment-suggestion">
                        <p><strong>建议操作：</strong>{adjustment.suggestion}</p>
                      </div>
                    </Panel>
                  ))}
                </Collapse>
              </Card>
            </motion.div>
          )}

          {/* 关键词分析 */}
          {(displayResult.keywords.matched.length > 0 || displayResult.keywords.missing.length > 0 || displayResult.keywords.suggested.length > 0) && (
            <motion.div
              className="keywords-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card
                title={
                  <span className="section-title">
                    <CheckOutlined style={{ marginRight: 8 }} />
                    关键词覆盖情况
                  </span>
                }
                style={{
                  background: 'rgba(10, 10, 15, 0.6)',
                  border: '1px solid rgba(94, 234, 212, 0.2)',
                }}
              >
                <div className="keywords-grid">
                  {displayResult.keywords.matched.length > 0 && (
                    <div className="keyword-group">
                      <h5>已匹配的关键词</h5>
                      <Space wrap>
                        {displayResult.keywords.matched.map((kw, i) => (
                          <Tag key={i} color="success">{kw}</Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                  {displayResult.keywords.missing.length > 0 && (
                    <div className="keyword-group">
                      <h5>缺失的关键词</h5>
                      <Space wrap>
                        {displayResult.keywords.missing.map((kw, i) => (
                          <Tag key={i} color="error">{kw}</Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                  {displayResult.keywords.suggested.length > 0 && (
                    <div className="keyword-group">
                      <h5>建议添加</h5>
                      <Space wrap>
                        {displayResult.keywords.suggested.map((kw, i) => (
                          <Tag key={i} color="processing">{kw}</Tag>
                        ))}
                      </Space>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* 各维度详细评分 */}
          <div className="result-dims">
            {displayResult.dimensions.map((dim, i) => (
              <motion.div
                key={dim.name}
                className="dim-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
              >
                <header className="dim-head">
                  <div className="dim-head-left">
                    <span className="dim-head-num">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="dim-head-title display">{dim.name}</h3>
                  </div>
                  <div className="dim-head-score">
                    <CountUp to={dim.score} duration={1.2} />
                    <span className="dim-head-unit">/ 20</span>
                  </div>
                </header>

                <p className="dim-comment">{dim.comment}</p>

                {dim.suggestions.length > 0 && (
                  <div className="dim-suggestions">
                    <h5>改进建议：</h5>
                    <ul>
                      {dim.suggestions.map((suggestion, idx) => (
                        <li key={idx}>
                          <BulbOutlined /> {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* 整体建议 */}
          {displayResult.generalSuggestions.length > 0 && (
            <motion.div
              className="general-suggestions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card
                title={
                  <span className="section-title">
                    <BulbOutlined style={{ marginRight: 8 }} />
                    整体优化建议
                  </span>
                }
                style={{
                  background: 'rgba(10, 10, 15, 0.6)',
                  border: '1px solid rgba(94, 234, 212, 0.2)',
                }}
              >
                <ul className="suggestion-list">
                  {displayResult.generalSuggestions.map((suggestion, i) => (
                    <li key={i} className="suggestion-item">
                      <span className="suggestion-num">{i + 1}</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {/* 分析完成后的提示 */}
      {!loading && (!displayResult || displayResult.dimensions.length === 0) && (
        <motion.div
          className="analyzing-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center' }}
        >
          <Alert
            message="暂无分析数据"
            description="该简历尚未进行分析或数据不完整。"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Button type="primary" onClick={startAnalysis}>
            开始分析
          </Button>
        </motion.div>
      )}
    </div>
  );
}
