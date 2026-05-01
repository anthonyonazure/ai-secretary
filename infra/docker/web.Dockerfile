# syntax=docker/dockerfile:1.7
# `apps/web` — Vite SPA. Build-time only; serve via Railway static or any
# CDN. The runtime stage emits the dist/ directory; deploy targets that
# need a node server can mount it behind a tiny nginx / caddy front.
#
#   docker build -f infra/docker/web.Dockerfile -t aisecretary/web .

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY apps/workers/package.json apps/workers/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/bot/package.json apps/bot/
COPY apps/admin/package.json apps/admin/
COPY packages/auth/package.json packages/auth/
COPY packages/consent/package.json packages/consent/
COPY packages/crm/package.json packages/crm/
COPY packages/db/package.json packages/db/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/llm-gateway/package.json packages/llm-gateway/
COPY packages/modules/package.json packages/modules/
COPY packages/notifications/package.json packages/notifications/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/transcription/package.json packages/transcription/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

FROM node:${NODE_VERSION} AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /repo /repo
COPY . .
RUN pnpm --filter @aisecretary/design-tokens build
RUN pnpm --filter @aisecretary/web build

FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/caddy
COPY infra/docker/Caddyfile.web /etc/caddy/Caddyfile
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
