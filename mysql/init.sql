-- ============================================================
-- AI Resume Optimizer 数据库初始化脚本
-- 包含：数据库创建、普通用户表、管理员表、简历表、分析记录表、采纳记录表
-- 默认管理员账号：CCCking2002 / CQHcqh2002.
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS ai_resume_optimizer
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE ai_resume_optimizer;

-- ============================================================
-- 普通用户表 (users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(20) NOT NULL UNIQUE COMMENT '用户名，仅允许字母数字下划线',
  email VARCHAR(255) NOT NULL UNIQUE COMMENT '邮箱地址',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密后的密码',
  is_active BOOLEAN DEFAULT TRUE COMMENT '账号是否激活',
  email_verified BOOLEAN DEFAULT FALSE COMMENT '邮箱是否验证',
  last_active_at DATETIME DEFAULT NULL COMMENT '最后活跃时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_email (email),
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='普通用户表';

-- ============================================================
-- 管理员表 (admins)
-- 独立的管理员账号体系，与普通用户分离
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(20) NOT NULL UNIQUE COMMENT '管理员用户名',
  email VARCHAR(255) NOT NULL UNIQUE COMMENT '管理员邮箱',
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt 加密后的密码',
  is_active BOOLEAN DEFAULT TRUE COMMENT '账号是否激活',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_email (email),
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- ============================================================
-- 简历表 (resumes)
-- ============================================================
CREATE TABLE IF NOT EXISTS resumes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL COMMENT '上传用户ID',
  original_filename VARCHAR(255) NOT NULL COMMENT '原始文件名',
  file_path VARCHAR(500) NOT NULL COMMENT '文件存储路径',
  file_type ENUM('pdf', 'docx', 'txt') NOT NULL COMMENT '文件类型',
  file_size INT UNSIGNED NOT NULL COMMENT '文件大小（字节）',
  raw_text LONGTEXT COMMENT '提取的纯文本内容',
  optimized_text LONGTEXT COMMENT '优化后的文本内容（用户采纳的建议）',
  is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否已删除',
  deleted_at DATETIME DEFAULT NULL COMMENT '删除时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_is_deleted (is_deleted),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='简历表';

-- ============================================================
-- 分析记录表 (analysis_records)
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_records (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resume_id INT UNSIGNED NOT NULL COMMENT '关联简历ID',
  total_score DECIMAL(3,1) DEFAULT NULL COMMENT '总分（0-10）',
  result_json JSON NOT NULL COMMENT 'AI分析结果（5个维度详细数据）',
  raw_response LONGTEXT COMMENT 'AI原始响应文本',
  processing_time_ms INT UNSIGNED DEFAULT NULL COMMENT '处理耗时（毫秒）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '分析时间',
  
  INDEX idx_resume_id (resume_id),
  INDEX idx_total_score (total_score),
  INDEX idx_created_at (created_at),
  
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI分析记录表';

-- ============================================================
-- 采纳建议表 (adopted_suggestions)
-- 记录用户采纳的修改建议，用于生成优化版简历
-- ============================================================
CREATE TABLE IF NOT EXISTS adopted_suggestions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT UNSIGNED NOT NULL COMMENT '关联分析记录ID',
  dimension_name VARCHAR(50) NOT NULL COMMENT '维度名称',
  original_text TEXT NOT NULL COMMENT '原文',
  suggestion_text TEXT NOT NULL COMMENT '建议文本',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '采纳时间',
  
  INDEX idx_analysis_id (analysis_id),
  INDEX idx_dimension_name (dimension_name),
  
  FOREIGN KEY (analysis_id) REFERENCES analysis_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户采纳的建议表';

-- ============================================================
-- 邮箱验证码表 (email_verification_codes)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL COMMENT '邮箱地址',
  code VARCHAR(6) NOT NULL COMMENT '6位数字验证码',
  purpose ENUM('register', 'reset_password') DEFAULT 'register' COMMENT '用途',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  is_used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  INDEX idx_email (email),
  INDEX idx_code (code),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证码表';

-- ============================================================
-- 插入默认管理员账号
-- 用户名：CCCking2002
-- 密码：CQHcqh2002.
-- bcrypt 哈希：$2b$10$1ldNzEwNkP/h1K6n3hxp1.uoPjob/MYmRuw6doT.yIt6bAkGubMJC
-- ============================================================

-- 先检查是否已存在该管理员
SET @admin_exists = (SELECT COUNT(*) FROM admins WHERE username = 'CCCking2002');

-- 插入默认管理员账号
INSERT INTO admins (username, email, password_hash, is_active)
SELECT 'CCCking2002', 'admin@ai-resume.local', '$2b$10$1ldNzEwNkP/h1K6n3hxp1.uoPjob/MYmRuw6doT.yIt6bAkGubMJC', TRUE
WHERE @admin_exists = 0;

-- ============================================================
-- 创建视图：普通用户简历统计
-- ============================================================
CREATE OR REPLACE VIEW user_resume_stats AS
SELECT 
  u.id AS user_id,
  u.username,
  u.email,
  COUNT(DISTINCT r.id) AS total_resumes,
  COUNT(DISTINCT CASE WHEN ar.id IS NOT NULL THEN r.id END) AS analyzed_resumes,
  AVG(ar.total_score) AS avg_score,
  MAX(r.created_at) AS last_upload_at
FROM users u
LEFT JOIN resumes r ON u.id = r.user_id AND r.is_deleted = FALSE
LEFT JOIN analysis_records ar ON r.id = ar.resume_id
WHERE u.is_active = TRUE
GROUP BY u.id, u.username, u.email;

-- ============================================================
-- 创建视图：每日上传统计
-- ============================================================
CREATE OR REPLACE VIEW daily_upload_stats AS
SELECT 
  DATE(created_at) AS date,
  COUNT(*) AS upload_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM resumes
WHERE is_deleted = FALSE
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================
-- 创建视图：评分分布统计
-- ============================================================
CREATE OR REPLACE VIEW score_distribution AS
SELECT 
  CASE 
    WHEN total_score >= 8 THEN '8-10 (优秀)'
    WHEN total_score >= 6 THEN '6-8 (良好)'
    WHEN total_score >= 4 THEN '4-6 (一般)'
    ELSE '0-4 (需改进)'
  END AS score_range,
  COUNT(*) AS count
FROM analysis_records
WHERE total_score IS NOT NULL
GROUP BY 
  CASE 
    WHEN total_score >= 8 THEN '8-10 (优秀)'
    WHEN total_score >= 6 THEN '6-8 (良好)'
    WHEN total_score >= 4 THEN '4-6 (一般)'
    ELSE '0-4 (需改进)'
  END;

-- ============================================================
-- 完成
-- ============================================================
SELECT '数据库初始化完成！' AS message;
SELECT '管理员账号：CCCking2002，密码：CQHcqh2002.' AS admin_info;
