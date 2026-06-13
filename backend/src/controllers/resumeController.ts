import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { logger } from '@/config/logger';
import { env } from '@/config/env';
import { getClientIP } from '@/middleware/security';
import fs from 'fs';
import pdf from 'pdf-parse';
import { analyzeResume, analyzeResumeStream, AnalysisResult } from '@/services/ai/analyzer';
import type { ResumeAnalysisPrompt } from '@/services/ai/prompts';

/**
 * 安全解码文件名（修复中文乱码）
 */
function safeDecodeFilename(name: string): string {
  try {
    // 将 Latin-1 编码的文件名转换为 UTF-8
    return Buffer.from(name, 'latin1').toString('utf-8');
  } catch {
    return name;
  }
}

/**
 * 过滤文件名中的路径遍历字符
 */
function sanitizeFilename(name: string): string {
  // 移除路径分隔符和空字符，防止路径遍历攻击
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\x00/g, '');
}

/**
 * 从磁盘读取文本内容
 */
async function extractFileText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'text/plain') {
      return fs.readFileSync(filePath, 'utf-8');
    }
    if (mimeType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      return pdfData.text || null;
    }
    return null;
  } catch (error) {
    logger.warn('提取文件文本失败:', error);
    return null;
  }
}

/**
 * 上传简历
 */
export async function uploadResume(req: Request, res: Response): Promise<void> {
  const file = req.file;
  const userId = req.user?.userId;
  const ip = getClientIP(req);

  logger.info('上传调试信息', {
    hasFile: !!file,
    fileName: file?.originalname,
    fileSize: file?.size,
    fileMime: file?.mimetype,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body),
  });

  try {
    if (!file) {
      res.status(400).json({
        success: false,
        error: '请上传简历文件',
        code: 'NO_FILE',
      });
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      logger.info('上传拒绝: 文件过大', { size: file.size });
      res.status(400).json({
        success: false,
        error: '文件大小不能超过 10MB',
        code: 'FILE_TOO_LARGE',
      });
      return;
    }

    const allowedTypes = ['application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.mimetype)) {
      logger.info('上传拒绝: 类型不匹配', { mime: file.mimetype });
      res.status(400).json({
        success: false,
        error: '仅支持 PDF、TXT 格式',
        code: 'INVALID_FILE_TYPE',
      });
      return;
    }

    // 魔数校验：防止伪造 MIME 类型的文件上传
    // 只读文件前 4 字节，避免 fs.readFileSync 不支持 start/end 选项导致全量读取
    const magicBuffer = Buffer.alloc(4);
    const fd = fs.openSync(file.path, 'r');
    fs.readSync(fd, magicBuffer, 0, 4, 0);
    fs.closeSync(fd);
    if (file.mimetype === 'application/pdf' && magicBuffer.toString('ascii') !== '%PDF') {
      logger.info('上传拒绝: 魔数不匹配', { header: magicBuffer.toString('hex') });
      fs.unlinkSync(file.path); // 删除伪造文件
      res.status(400).json({
        success: false,
        error: '文件类型不匹配，仅支持真正的 PDF 文件',
        code: 'MAGIC_MISMATCH',
      });
      return;
    }

    const content = await extractFileText(file.path, file.mimetype);

    // 检查文本提取是否成功
    if (!content || content.trim().length === 0) {
      logger.warn('上传拒绝: 无法提取文本内容', { mime: file.mimetype, path: file.path });
      fs.unlinkSync(file.path); // 删除无法处理的文件
      res.status(400).json({
        success: false,
        error: '无法从文件中提取文本内容，请上传包含可识别文本的 PDF 或 TXT 文件',
        code: 'TEXT_EXTRACTION_FAILED',
      });
      return;
    }

    const resume = await prisma.resume.create({
      data: {
        userId: userId!,
        originalName: sanitizeFilename(safeDecodeFilename(file.originalname)),
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        content,
      },
    });

    logger.info('简历上传成功', { resumeId: resume.id, userId, ip, fileName: file.originalname });

    res.status(201).json({
      success: true,
      message: '上传成功',
      data: {
        resumeId: resume.id,
        originalFilename: resume.originalName,
        fileType: resume.mimeType,
        rawText: resume.content,
      },
    });
  } catch (error) {
    logger.error('上传简历失败:', error);
    res.status(500).json({
      success: false,
      error: '上传失败',
      code: 'UPLOAD_ERROR',
    });
  }
}

/**
 * 同步分析简历（非流式）
 */
export async function analyzeResumeHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { resumeId, targetPosition, targetJob } = req.body as { resumeId: number; targetPosition?: string; targetJob?: string };
  const target = targetPosition || targetJob;

  try {
    if (!resumeId || !target) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
        code: 'MISSING_PARAMS',
      });
      return;
    }

    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume || resume.userId !== userId) {
      res.status(404).json({
        success: false,
        error: '简历不存在',
        code: 'RESUME_NOT_FOUND',
      });
      return;
    }

    const promptParams: ResumeAnalysisPrompt = {
      resumeContent: resume.content || '',
      targetPosition: target,
    };

    // 调用 AI 分析（同步）
    const result: AnalysisResult = await analyzeResume(promptParams);

    // 检查解析是否失败
    if (result.overallScore === 0 && (!result.dimensions || result.dimensions.length === 0)) {
      res.status(500).json({
        success: false,
        error: 'AI 分析结果解析失败，请重试',
        code: 'PARSE_ERROR',
      });
      return;
    }

    // 保存到数据库
    const dimensions = result.dimensions || [];
    const analysis = await prisma.analysis.create({
      data: {
        resumeId: resumeId,
        userId: userId!,
        targetPosition: target,
        score: Math.round(result.overallScore), // 0-100 分整数
        suggestions: {
          overallScore: result.overallScore,
          matchScore: result.matchScore,
          dimensions: dimensions.map((d: any) => ({
            name: d.name,
            score: d.score,
            comment: d.comment,
            suggestions: d.suggestions || [],
          })),
          gapAnalysis: result.gapAnalysis || {},
          generalSuggestions: result.generalSuggestions || [],
          strengths: result.strengths || [],
          weaknesses: result.weaknesses || [],
        } as any,
        optimizedContent: result.optimizedResume || null,
        keywords: JSON.parse(JSON.stringify(result.keywords || {})) as any,
        aiModel: env.AI_MODEL,
        processingTime: 0,
        status: 'COMPLETED' as const,
        completedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        analysisId: analysis.id,
        result,
      },
    });
  } catch (error: any) {
    // 精确错误分类，便于诊断首呼失败根因
    const errMsg = error.message || '分析失败';
    let errorCode = 'ANALYSIS_ERROR';
    let statusCode = 500;

    if (errMsg.includes('AI API Key 未配置')) {
      errorCode = 'AI_KEY_MISSING';
    } else if (errMsg.includes('AI API 错误')) {
      errorCode = 'AI_API_ERROR';
    } else if (errMsg.includes('JSON 解析失败') || errMsg.includes('未找到 JSON') || errMsg.includes('括号不匹配')) {
      errorCode = 'AI_PARSE_ERROR';
    } else if (error?.code === 'P2002' || error?.code === 'P2003' || error?.code === 'P2025') {
      errorCode = 'DB_ERROR';
    } else if (errMsg.includes('connect ECONNREFUSED') || errMsg.includes('ETIMEDOUT') || errMsg.includes('fetch failed')) {
      errorCode = 'AI_NETWORK_ERROR';
    }

    logger.error('分析简历失败', { errorCode, message: errMsg, resumeId: req.body?.resumeId });
    res.status(statusCode).json({
      success: false,
      error: errMsg,
      code: errorCode,
    });
  }
}

/**
 * 流式分析简历（SSE，保留兼容）
 */
export async function analyzeResumeStreamHandler(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { resumeId, targetPosition, targetJob } = req.body as { resumeId: number; targetPosition?: string; targetJob?: string };
  const target = targetPosition || targetJob;

  try {
    if (!resumeId || !target) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数',
        code: 'MISSING_PARAMS',
      });
      return;
    }

    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume || resume.userId !== userId) {
      res.status(404).json({
        success: false,
        error: '简历不存在',
        code: 'RESUME_NOT_FOUND',
      });
      return;
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // 强制发送响应头，绕过 compression 缓冲
    res.flushHeaders();

    const promptParams: ResumeAnalysisPrompt = {
      resumeContent: resume.content || '',
      targetPosition: target,
    };

    const send = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // 强制刷新 compression 缓冲区，确保 SSE 事件立即推送
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    const startTime = Date.now();
    let completedResult: AnalysisResult | null = null;

    try {
      for await (const progress of analyzeResumeStream(promptParams)) {
        send('status', {
          status: progress.status,
          progress: progress.progress,
          message: progress.message,
        });

        if (progress.status === 'completed' && progress.result) {
          completedResult = progress.result;
        }
      }

      if (!completedResult) {
        send('failed', {
          status: 'failed',
          progress: 0,
          message: '分析未完成',
          error: '未获取到分析结果',
        });
        if (!res.writableEnded) res.end();
        return;
      }

      // 保存到数据库
      const dimensions = completedResult.dimensions || [];
      const analysis = await prisma.analysis.create({
        data: {
          resumeId: resumeId,
          userId: userId!,
          targetPosition: target,
          score: Math.round(completedResult.overallScore),
          suggestions: {
            overallScore: completedResult.overallScore,
            matchScore: completedResult.matchScore,
            dimensions: dimensions.map((d: any) => ({
              name: d.name,
              score: d.score,
              comment: d.comment,
              suggestions: d.suggestions || [],
            })),
            gapAnalysis: completedResult.gapAnalysis || {},
            generalSuggestions: completedResult.generalSuggestions || [],
            strengths: completedResult.strengths || [],
            weaknesses: completedResult.weaknesses || [],
          } as any,
          optimizedContent: completedResult.optimizedResume || null,
          keywords: JSON.parse(JSON.stringify(completedResult.keywords || {})) as any,
          aiModel: env.AI_MODEL,
          processingTime: Date.now() - startTime,
          status: 'COMPLETED' as const,
          completedAt: new Date(),
        },
      });

      send('completed', {
        status: 'completed',
        progress: 100,
        message: '分析完成',
        result: completedResult,
        analysisId: analysis.id,
      });
    } catch (aiError: any) {
      send('failed', {
        status: 'failed',
        progress: 0,
        message: '分析失败',
        error: aiError.message || '未知错误',
      });
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (error: any) {
    if (!res.writableEnded) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ type: 'error', message: error.message || '分析失败' })}\n\n`
      );
      res.end();
    }
  }
}

/**
 * 获取用户简历历史
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 10, 100);

  try {
    const [resumes, total] = await Promise.all([
      prisma.resume.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.resume.count({ where: { userId } }),
    ]);

    const list = resumes.map((r) => {
      const rawScore = r.analyses[0]?.score;
      return {
        id: r.id,
        originalFilename: r.originalName,
        fileType: r.mimeType,
        totalScore: rawScore != null ? Math.round((rawScore / 100) * 10 * 10) / 10 : null, // 0-100 转 0-10
        createdAt: r.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      };
    });

    res.json({
      success: true,
      data: {
        list,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    logger.error('获取简历历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取历史失败',
      code: 'GET_HISTORY_ERROR',
    });
  }
}

/**
 * 预览原始简历文件
 */
export async function previewResume(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  try {
    const resume = await prisma.resume.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!resume) {
      res.status(404).json({
        success: false,
        error: '简历不存在',
        code: 'RESUME_NOT_FOUND',
      });
      return;
    }

    // 权限检查：只有管理员或简历所有者可以预览
    if (userRole !== 'admin' && resume.userId !== userId) {
      res.status(403).json({
        success: false,
        error: '无权访问此简历',
        code: 'FORBIDDEN',
      });
      return;
    }

    // 检查文件是否存在于磁盘
    if (!fs.existsSync(resume.filePath)) {
      res.status(404).json({
        success: false,
        error: '原始文件已丢失',
        code: 'FILE_NOT_FOUND',
      });
      return;
    }

    // 根据 MIME 类型设置响应头
    if (resume.mimeType === 'application/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (resume.mimeType === 'text/plain') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(resume.originalName)}`);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // 流式传输文件
    const fileStream = fs.createReadStream(resume.filePath);
    fileStream.pipe(res);
    fileStream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: '文件读取失败',
          code: 'STREAM_ERROR',
        });
      }
    });
  } catch (error) {
    logger.error('预览简历失败:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: '预览失败',
        code: 'PREVIEW_ERROR',
      });
    }
  }
}

/**
 * 获取简历的所有分析记录
 */
export async function getResumeAnalyses(req: Request, res: Response): Promise<void> {
  const { resumeId } = req.params;
  const userId = req.user?.userId;

  try {
    const resume = await prisma.resume.findUnique({
      where: { id: parseInt(resumeId, 10) },
    });

    if (!resume || resume.userId !== userId) {
      res.status(404).json({
        success: false,
        error: '简历不存在',
        code: 'RESUME_NOT_FOUND',
      });
      return;
    }

    const analyses = await prisma.analysis.findMany({
      where: { resumeId: parseInt(resumeId, 10) },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        analyses: analyses.map((a) => ({
          id: a.id,
          targetPosition: a.targetPosition,
          score: a.score,
          aiModel: a.aiModel,
          status: a.status,
          completedAt: a.completedAt,
          createdAt: a.createdAt,
          result: a.suggestions,
          optimizedContent: a.optimizedContent,
          keywords: a.keywords,
        })),
      },
    });
  } catch (error) {
    logger.error('获取分析记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取分析记录失败',
      code: 'GET_ANALYSES_ERROR',
    });
  }
}

/**
 * 下载优化后的简历
 */
export async function downloadResume(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!id || isNaN(parseInt(id, 10))) {
    res.status(400).json({ success: false, error: '无效的简历ID', code: 'INVALID_ID' });
    return;
  }

  if (!userId) {
    res.status(401).json({ success: false, error: '未认证', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const resume = await prisma.resume.findFirst({
      where: {
        id: parseInt(id, 10),
        userId,
      },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!resume) {
      res.status(404).json({
        success: false,
        error: '简历不存在',
        code: 'RESUME_NOT_FOUND',
      });
      return;
    }

    const analysis = resume.analyses[0];
    if (!analysis?.optimizedContent) {
      res.status(404).json({
        success: false,
        error: '尚未完成分析',
        code: 'NO_OPTIMIZED_CONTENT',
      });
      return;
    }

    const filename = resume.originalName || `resume_${id}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`optimized_${filename}`)}`);
    res.setHeader('Cache-Control', 'no-cache');

    // 确保 content 是字符串
    const content = typeof analysis.optimizedContent === 'string'
      ? analysis.optimizedContent
      : JSON.stringify(analysis.optimizedContent);

    res.send(content);
  } catch (error) {
    logger.error('下载简历失败:', error instanceof Error ? error.message : String(error), {
      resumeId: id,
      userId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: '下载失败，请查看服务器日志',
        code: 'DOWNLOAD_ERROR',
      });
    }
  }
}
