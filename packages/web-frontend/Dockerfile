# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web-frontend/package.json ./packages/web-frontend/package.json
RUN pnpm install --frozen-lockfile --filter web-frontend...

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY . .
WORKDIR /app/packages/web-frontend
RUN pnpm install --frozen-lockfile --filter web-frontend...
RUN pnpm build

FROM nginx:stable-alpine AS production
COPY --from=builder /app/packages/web-frontend/dist /usr/share/nginx/html
COPY packages/web-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]