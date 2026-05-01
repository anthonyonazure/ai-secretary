# syntax=docker/dockerfile:1.7
# Multi-stage build for `apps/api` — Fastify HTTP server.
#
# Build context MUST be the repo root (so pnpm-workspace.yaml + every
# package is reachable). Example:
#   docker build -f infra/docker/api.Dockerfile -t aisecretary/api .

ARG NODE_VERSION=22-alpine

# ─── deps stage ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
# Copy only the manifests first so Docker layer caching survives a pnpm-store
# warm-up between code changes.
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

# ─── build stage ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /repo /repo
COPY . .
# Compile design-tokens first — apps/web's tailwind config consumes the
# build artifact. apps/api doesn't depend on it but the workspace
# typecheck does.
RUN pnpm --filter @aisecretary/design-tokens build
RUN pnpm --filter @aisecretary/api typecheck
# Copy package source-of-record into a slim runtime layer.

# ─── runtime stage ────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN addgroup -S aisecretary && adduser -S aisecretary -G aisecretary
COPY --from=build --chown=aisecretary:aisecretary /repo /app
USER aisecretary
EXPOSE 3001
CMD ["pnpm", "--filter", "@aisecretary/api", "exec", "tsx", "src/index.ts"]
