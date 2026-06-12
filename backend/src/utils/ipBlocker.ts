/**
 * IP 封禁管理器
 * 用于防止暴力破解、DDoS 等攻击
 * 记录同时持久化到数据库和内存，防止重启丢失
 */

import { env } from '../config/env.js';
import { logger, auditLogger } from '../config/logger.js';

interface IPRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

class IPBlocker {
  private records: Map<string, IPRecord> = new Map();
  private readonly threshold: number;
  private readonly blockDuration: number;

  constructor() {
    this.threshold = env.IP_BLOCK_THRESHOLD;
    this.blockDuration = env.IP_BLOCK_DURATION;
    
    // 定期清理过期记录（每 10 分钟）
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * 持久化封禁到数据库
   */
  private async persistBlock(ip: string, reason: string, expiresAt: Date | null): Promise<void> {
    try {
      const { prisma } = await import('../config/database.js');
      await prisma.blockedIP.upsert({
        where: { ipAddress: ip },
        update: { reason, expiresAt, createdAt: new Date() },
        create: { ipAddress: ip, reason, expiresAt },
      });
    } catch (error) {
      // 数据库不可用时仅依赖内存封禁，不影响正常封禁流程
      logger.warn('持久化封禁记录失败（数据库不可用）:', error);
    }
  }

  /**
   * 记录一次失败请求
   * @param ip 客户端 IP
   * @param reason 失败原因
   * @returns 是否触发封禁
   */
  recordFailure(ip: string, reason: string): boolean {
    const now = Date.now();
    const record = this.records.get(ip) || {
      count: 0,
      firstAttempt: now,
      lastAttempt: now,
    };

    record.count++;
    record.lastAttempt = now;

    // 检查是否达到封禁阈值
    if (record.count >= this.threshold && !record.blockedUntil) {
      record.blockedUntil = now + this.blockDuration;
      const expiresAt = record.blockedUntil ? new Date(record.blockedUntil) : null;
      
      // 异步持久化到数据库（不阻塞）
      this.persistBlock(ip, `${reason} (失败 ${record.count} 次)`, expiresAt);
      
      auditLogger.ipBlocked({
        ip,
        reason: `${reason} (失败 ${record.count} 次)`,
        duration: this.blockDuration,
      });

      logger.warn(`IP ${ip} 已被封禁 ${this.blockDuration / 1000} 秒，原因: ${reason}`);
    }

    this.records.set(ip, record);
    return !!record.blockedUntil;
  }

  /**
   * 检查 IP 是否被封禁
   * @param ip 客户端 IP
   * @returns 封禁信息，如果未被封禁返回 null
   */
  isBlocked(ip: string): { blocked: boolean; remainingTime?: number } {
    const record = this.records.get(ip);
    
    if (!record || !record.blockedUntil) {
      return { blocked: false };
    }

    const now = Date.now();
    
    // 检查封禁是否已过期
    if (now > record.blockedUntil) {
      // 解封，但保留记录
      record.blockedUntil = undefined;
      record.count = 0;
      this.records.set(ip, record);
      return { blocked: false };
    }

    return {
      blocked: true,
      remainingTime: Math.ceil((record.blockedUntil - now) / 1000),
    };
  }

  /**
   * 记录成功请求（重置失败计数）
   * @param ip 客户端 IP
   */
  recordSuccess(ip: string): void {
    const record = this.records.get(ip);
    if (record) {
      // 保留记录但重置计数
      record.count = 0;
      record.blockedUntil = undefined;
      this.records.set(ip, record);
    }
  }

  /**
   * 手动解封 IP
   * @param ip 客户端 IP
   */
  unblock(ip: string): boolean {
    const record = this.records.get(ip);
    if (record) {
      record.blockedUntil = undefined;
      record.count = 0;
      this.records.set(ip, record);
      logger.info(`IP ${ip} 已被手动解封`);
      return true;
    }
    return false;
  }

  /**
   * 获取所有被封禁的 IP 列表
   */
  getBlockedIPs(): Array<{ ip: string; blockedUntil: number; count: number }> {
    const now = Date.now();
    const blocked: Array<{ ip: string; blockedUntil: number; count: number }> = [];
    
    for (const [ip, record] of this.records.entries()) {
      if (record.blockedUntil && record.blockedUntil > now) {
        blocked.push({
          ip,
          blockedUntil: record.blockedUntil,
          count: record.count,
        });
      }
    }
    
    return blocked;
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    const expiryTime = 24 * 60 * 60 * 1000; // 24 小时
    
    for (const [ip, record] of this.records.entries()) {
      // 删除长时间无活动的记录
      if (now - record.lastAttempt > expiryTime) {
        this.records.delete(ip);
      }
    }
    
    logger.debug(`IP 封禁管理器清理完成，当前记录数: ${this.records.size}`);
  }
}

// 导出单例
export const ipBlocker = new IPBlocker();
