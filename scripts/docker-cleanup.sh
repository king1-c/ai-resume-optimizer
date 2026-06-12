#!/bin/sh
# Docker 磁盘定时清理脚本
# 建议通过 crontab 每天执行：0 3 * * * /path/to/docker-cleanup.sh >> /var/log/docker-cleanup.log 2>&1

set -e

echo "=== Docker Cleanup $(date) ==="

# 1. 清理停止超过24h的容器（保留最近）
echo "[1/4] 清理已停止的容器..."
docker container prune -f --filter "until=24h"

# 2. 清理未使用的镜像（保留 tagged）
echo "[2/4] 清理 dangling 镜像..."
docker image prune -f

# 3. 清理构建缓存
echo "[3/4] 清理构建缓存..."
docker builder prune -f --filter "until=48h"

# 4. 清理未使用的卷（保守模式，只清理无引用且超过7天的）
echo "[4/4] 清理未使用的卷..."
docker volume prune -f --filter "label!=keep"

echo "=== Cleanup Complete ==="

# 显示磁盘使用
df -h / | tail -1
