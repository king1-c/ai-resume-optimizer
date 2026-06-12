import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface TokenPayload {
  userId: number;
  username: string;
  role: 'user' | 'admin';
  type: 'access' | 'refresh';
  jti?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 生成访问令牌
 * @param payload 令牌载荷
 * @returns JWT 令牌
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  const tokenPayload: TokenPayload = {
    ...payload,
    type: 'access',
    jti: randomUUID(),
  };

  return jwt.sign(tokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'ai-resume-optimizer',
    audience: 'ai-resume-optimizer-client',
  } as jwt.SignOptions);
}

/**
 * 生成刷新令牌
 * @param payload 令牌载荷
 * @returns JWT 令牌
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  const tokenPayload: TokenPayload = {
    ...payload,
    type: 'refresh',
    jti: randomUUID(),
  };

  return jwt.sign(tokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'ai-resume-optimizer',
    audience: 'ai-resume-optimizer-client',
  } as jwt.SignOptions);
}

/**
 * 生成令牌对（访问令牌 + 刷新令牌）
 * @param payload 令牌载荷
 * @returns 令牌对
 */
export function generateTokenPair(payload: Omit<TokenPayload, 'type'>): TokenPair {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // 解析访问令牌获取过期时间
  const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
  const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * 验证访问令牌
 * @param token JWT 令牌
 * @returns 解码后的载荷
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'ai-resume-optimizer',
      audience: 'ai-resume-optimizer-client',
    }) as TokenPayload;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    logger.warn('访问令牌验证失败:', error);
    throw error;
  }
}

/**
 * 验证刷新令牌
 * @param token JWT 令牌
 * @returns 解码后的载荷
 */
export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'ai-resume-optimizer',
      audience: 'ai-resume-optimizer-client',
    }) as TokenPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error) {
    logger.warn('刷新令牌验证失败:', error);
    throw error;
  }
}

/**
 * 解码令牌（不验证）
 * @param token JWT 令牌
 * @returns 解码后的载荷或 null
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 检查令牌是否即将过期
 * @param token JWT 令牌
 * @param thresholdSeconds 阈值（秒）
 * @returns 是否即将过期
 */
export function isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    if (!decoded.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now < thresholdSeconds;
  } catch {
    return true;
  }
}
