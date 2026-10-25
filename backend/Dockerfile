FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app/build
COPY --from=build /app/build ./
COPY --from=build /app/node_modules ./node_modules
WORKDIR /app
COPY scripts ./scripts
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333 LOG_LEVEL=info DB_PATH=/data/budget.sqlite3 APK_DIRECTORY=/apk
EXPOSE 3333
CMD ["sh", "-c", "node build/ace.js migration:run --force && exec node build/bin/server.js"]
