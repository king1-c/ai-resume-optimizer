import crypto from 'crypto';
import { AnalysisResult } from '@/services/ai/analyzer';

interface CacheEntry {
  key: string;
  value: AnalysisResult;
  createdAt: number;
}

/**
 * AI 分析结果 LRU 缓存
 * 通过 MD5(resumeContent | targetPosition) 作为缓存键
 * 默认最大 100 条，TTL 1 小时
 */
export class AICache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 100, ttlMs = 3_600_000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * 生成缓存键（基于简历内容哈希 + 目标职位）
   */
  static generateKey(resumeContent: string, targetPosition: string): string {
    return crypto
      .createHash('md5')
      .update(`${resumeContent}|${targetPosition}`)
      .digest('hex');
  }

  /**
   * 获取缓存的分析结果
   * 返回 null 表示未命中或已过期
   */
  get(key: string): AnalysisResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // LRU：访问时移到末尾
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /**
   * 设置缓存
   */
  set(key: string, value: AnalysisResult): void {
    // 如果已存在则先删除再添加（LRU 重排序）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 达到上限时淘汰最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      key,
      value,
      createdAt: Date.now(),
    });
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取当前缓存大小
   */
  get size(): number {
    return this.cache.size;
  }
}

// 单例导出
export const aiCache = new AICache();
