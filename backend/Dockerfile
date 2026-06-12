FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY src/prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# 安装 wget 用于健康检查
RUN apk add --no-cache wget

# 创建应用用户并设置目录权限
RUN addgroup -S appuser && \
    adduser -S appuser -G appuser && \
    mkdir -p uploads logs && \
    chown -R appuser:appuser uploads logs

USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
