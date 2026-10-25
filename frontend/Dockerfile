FROM node:24-bookworm-slim AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY backend/.adonisjs/client/registry/ /app/backend/.adonisjs/client/registry/
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/.output ./.output
COPY --from=build --chown=node:node /app/frontend/scripts/check-env.mjs ./scripts/check-env.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--import", "./scripts/check-env.mjs", ".output/server/index.mjs"]
