import bcrypt from 'bcrypt';
import { logger } from '../config/logger';

const SALT_ROUNDS = 13;

/**
 * 哈希密码
 * @param password 明文密码
 * @returns 哈希后的密码
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    logger.error('密码哈希失败:', error);
    throw new Error('密码处理失败');
  }
}

/**
 * 验证密码
 * @param password 明文密码
 * @param hashedPassword 哈希后的密码
 * @returns 是否匹配
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    logger.error('密码验证失败:', error);
    return false;
  }
}

/**
 * 检查密码强度
 * @param password 明文密码
 * @returns 强度评估结果
 */
export function checkPasswordStrength(password: string): {
  score: number;
  isStrong: boolean;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // 长度检查
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('密码长度至少为8位');
  }

  if (password.length >= 12) {
    score += 1;
  }

  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('密码需要包含大写字母');
  }

  // 包含小写字母
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('密码需要包含小写字母');
  }

  // 包含数字
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('密码需要包含数字');
  }

  // 包含特殊字符
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push('密码需要包含特殊字符');
  }

  // 检查常见弱密码
  const commonPasswords = ['123456', 'password', 'qwerty', 'abc123', 'letmein'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score = Math.max(0, score - 2);
    feedback.push('密码过于常见，请使用更复杂的密码');
  }

  return {
    score,
    isStrong: score >= 4,
    feedback,
  };
}
