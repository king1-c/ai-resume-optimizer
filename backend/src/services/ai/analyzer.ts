import { aiClient } from './client';
import {
  SYSTEM_PROMPT,
  generateAnalysisPrompt,
  ResumeAnalysisPrompt,
} from './prompts';
import { logger } from '@/config/logger';
import { aiCache, AICache } from '@/utils/aiCache';

export interface AnalysisResult {
  overallScore: number;
  matchScore: number;
  dimensions: DimensionScore[];
  gapAnalysis: GapAnalysis;
  moduleAdjustments: ModuleAdjustment[];
  generalSuggestions: string[];
  optimizedResume: string;
  keywords: Keywords;
  strengths: string[];
  weaknesses: string[];
}

export interface DimensionScore {
  name: string;
  score: number;
  comment: string;
  suggestions: string[];
}

export interface GapAnalysis {
  summary: string;
  metRequirements: string[];
  unmetRequirements: string[];
  skillGaps: string[];
  priorityFixes: string[];
}

export interface ModuleAdjustment {
  module: string;
  action: '补充' | '调整' | '删减';
  reason: string;
  suggestion: string;
}

export interface Keywords {
  matched: string[];
  missing: string[];
  suggested: string[];
}

export interface AnalysisProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: AnalysisResult;
  error?: string;
}

/**
 * 解析 AI 返回的 JSON 结果
 */
function clampScore(value: number, min: number, max: number): number {
  return Math.min(Math.max(value ?? 0, min), max);
}

function parseAIResult(content: string): AnalysisResult {
  // 策略1: 尝试从 markdown 代码块中提取 JSON
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : content;

  // 策略2: 用非贪婪匹配提取最外层 JSON 对象（支持嵌套）
  let jsonStr = '';
  const firstBrace = candidate.indexOf('{');
  if (firstBrace === -1) {
    logger.error('AI 返回内容中未找到 JSON 对象', { contentLength: content.length });
    return emptyResult('AI 返回内容中未找到 JSON 对象');
  }

  // 从第一个 { 开始计数括号层级，找到匹配的 }
  let depth = 0;
  let endIndex = -1;
  for (let i = firstBrace; i < candidate.length; i++) {
    if (candidate[i] === '{' && (i === 0 || candidate[i - 1] !== '\\')) depth++;
    else if (candidate[i] === '}' && (i === 0 || candidate[i - 1] !== '\\')) {
      depth--;
      if (depth === 0) { endIndex = i; break; }
    }
  }

  if (endIndex === -1) {
    logger.error('AI 返回 JSON 括号不匹配', { contentLength: content.length });
    return emptyResult('AI 返回 JSON 格式不完整（括号不匹配）');
  }

  jsonStr = candidate.slice(firstBrace, endIndex + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    return {
        overallScore: clampScore(parsed.overallScore, 0, 100),
        matchScore: clampScore(parsed.matchScore, 0, 100),
        dimensions: (parsed.dimensions || []).map((d: any) => ({
          ...d,
          score: clampScore(d.score, 0, 20),
        })),
        gapAnalysis: parsed.gapAnalysis || {
          summary: '',
          metRequirements: [],
          unmetRequirements: [],
          skillGaps: [],
          priorityFixes: [],
        },
        moduleAdjustments: parsed.moduleAdjustments || [],
        generalSuggestions: parsed.generalSuggestions || [],
        optimizedResume: parsed.optimizedResume || '',
        keywords: parsed.keywords || { matched: [], missing: [], suggested: [] },
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
      };
  } catch (error) {
    logger.error('JSON 解析失败', { error: (error as Error).message, jsonLength: jsonStr.length });
    return emptyResult(`JSON 解析失败: ${(error as Error).message}`);
  }
}

/** 生成带错误信息的空白结果 */
function emptyResult(reason: string): AnalysisResult {
  return {
    overallScore: 0,
    matchScore: 0,
    dimensions: [],
    gapAnalysis: {
      summary: reason,
      metRequirements: [],
      unmetRequirements: [],
      skillGaps: [],
      priorityFixes: [],
    },
    moduleAdjustments: [],
    generalSuggestions: [reason],
    optimizedResume: '',
    keywords: { matched: [], missing: [], suggested: [] },
    strengths: [],
    weaknesses: [],
  };
}

/**
 * 分析简历
 */
export async function analyzeResume(
  params: ResumeAnalysisPrompt,
  onProgress?: (progress: AnalysisProgress) => void
): Promise<AnalysisResult> {
  try {
    // 检查缓存
    const cacheKey = AICache.generateKey(params.resumeContent, params.targetPosition || '');
    const cached = aiCache.get(cacheKey);
    if (cached) {
      logger.info('AI 分析缓存命中');
      onProgress?.({
        status: 'completed',
        progress: 100,
        message: '分析完成（缓存）',
        result: cached,
      });
      return cached;
    }

    onProgress?.({
      status: 'processing',
      progress: 10,
      message: '正在准备分析...',
    });

    const prompt = generateAnalysisPrompt(params);

    onProgress?.({
      status: 'processing',
      progress: 30,
      message: '正在调用 AI 进行分析...',
    });

    const response = await aiClient.complete(prompt, SYSTEM_PROMPT, {
      temperature: 0.7,
      maxTokens: 4000,
    });

    onProgress?.({
      status: 'processing',
      progress: 70,
      message: '正在解析分析结果...',
    });

    const result = parseAIResult(response.content);

    // 写入缓存
    aiCache.set(cacheKey, result);

    onProgress?.({
      status: 'completed',
      progress: 100,
      message: '分析完成',
      result,
    });

    return result;
  } catch (error) {
    logger.error('简历分析失败:', error);
    onProgress?.({
      status: 'failed',
      progress: 0,
      message: '分析失败',
      error: error instanceof Error ? error.message : '未知错误',
    });
    throw error;
  }
}

/**
 * 流式分析简历
 */
export async function* analyzeResumeStream(
  params: ResumeAnalysisPrompt
): AsyncGenerator<AnalysisProgress, void, unknown> {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    // 检查缓存
    const cacheKey = AICache.generateKey(params.resumeContent, params.targetPosition || '');
    const cached = aiCache.get(cacheKey);
    if (cached) {
      logger.info('AI 分析缓存命中（流式）');
      yield {
        status: 'processing',
        progress: 30,
        message: '正在准备分析...',
      };
      await delay(400);
      yield {
        status: 'processing',
        progress: 65,
        message: '缓存命中，正在返回结果...',
      };
      await delay(400);
      yield {
        status: 'completed',
        progress: 100,
        message: '分析完成（缓存）',
        result: cached,
      };
      return;
    }

    yield {
      status: 'processing',
      progress: 10,
      message: '正在准备分析...',
    };
    await delay(500);

    const prompt = generateAnalysisPrompt(params);

    yield {
      status: 'processing',
      progress: 30,
      message: '正在调用 AI 进行分析...',
    };
    await delay(500);

    let fullContent = '';

    for await (const chunk of aiClient.completeStream(prompt, SYSTEM_PROMPT, {
      temperature: 0.7,
      maxTokens: 4000,
    })) {
      fullContent += chunk;
      yield {
        status: 'processing',
        progress: 50,
        message: 'AI 正在分析简历内容...',
      };
    }

    yield {
      status: 'processing',
      progress: 80,
      message: '正在解析分析结果...',
    };
    await delay(500);

    const result = parseAIResult(fullContent);

    // 写入缓存
    aiCache.set(cacheKey, result);

    yield {
      status: 'completed',
      progress: 100,
      message: '分析完成',
      result,
    };
  } catch (error) {
    logger.error('简历流式分析失败:', error);
    yield {
      status: 'failed',
      progress: 0,
      message: '分析失败',
      error: error instanceof Error ? error.message : '未知错误',
    };
    throw error;
  }
}
