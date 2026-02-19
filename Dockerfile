FROM node:20-alpine

WORKDIR /app

# 依存関係のみ先にコピー（キャッシュ効率化）
COPY package*.json ./
RUN npm ci --omit=dev

# ソースコードをコピー（シークレットファイルは .dockerignore で除外済み）
COPY . .

# ログディレクトリ作成
RUN mkdir -p logs

# 非rootユーザーで実行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "src/index.js"]
