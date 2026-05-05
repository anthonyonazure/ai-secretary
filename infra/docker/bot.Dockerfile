# syntax=docker/dockerfile:1.7
# `apps/bot` — meeting-bot service (pg-boss `bot.join` handler).
#
#   docker build -f infra/docker/bot.Dockerfile -t aisecretary/bot .

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
COPY apps/extension/package.json apps/extension/
COPY packages/auth/package.json packages/auth/
COPY packages/bot/package.json packages/bot/
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
RUN pnpm --filter @aisecretary/bot-service typecheck

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN addgroup -S aisecretary && adduser -S aisecretary -G aisecretary
COPY --from=build --chown=aisecretary:aisecretary /repo /app
USER aisecretary
CMD ["pnpm", "--filter", "@aisecretary/bot-service", "exec", "tsx", "src/index.ts"]
