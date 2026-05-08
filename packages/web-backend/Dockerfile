# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web-backend/package.json ./packages/web-backend/package.json

RUN pnpm install --frozen-lockfile --filter web-backend...

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY --from=deps /app /app

COPY packages/web-backend ./packages/web-backend

WORKDIR /app/packages/web-backend
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "server.js"]