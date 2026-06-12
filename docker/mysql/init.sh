#!/bin/bash
# MySQL 初始化脚本 - 创建应用专用数据库用户
# 此脚本在 MySQL 容器首次启动时自动执行

set -e

mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    -- 创建应用专用用户（远程连接）
    CREATE USER IF NOT EXISTS 'ai_resume_app'@'%' IDENTIFIED BY '${DB_APP_PASSWORD}';
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON ai_resume_optimizer.* TO 'ai_resume_app'@'%';

    -- 创建应用专用用户（本地连接）
    CREATE USER IF NOT EXISTS 'ai_resume_app'@'localhost' IDENTIFIED BY '${DB_APP_PASSWORD}';
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON ai_resume_optimizer.* TO 'ai_resume_app'@'localhost';

    FLUSH PRIVILEGES;

    SELECT '✅ 应用数据库用户 ai_resume_app 创建成功' AS status;
EOSQL
