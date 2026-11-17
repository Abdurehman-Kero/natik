# syntax=docker/dockerfile:1.7
# Natik API + worker (NestJS). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t natik-api .                  # API / worker image
#   docker build -f apps/api/Dockerfile --target migrate -t natik-migrate .  # runs `prisma migrate deploy`
# The same image runs the API (default) or the worker: `node dist/worker.js`.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# 1. Keep only what @natik/api needs.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @natik/api --docker

# 2. Full install (dev tools included) and build.
FROM base AS builder
COPY --from=pruner /repo/out/json/ .
# The postinstall step runs `prisma generate`, which needs the schema and config.
COPY --from=pruner /repo/out/full/apps/api/prisma ./apps/api/prisma
COPY --from=pruner /repo/out/full/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --fetch-timeout=600000 --fetch-retries=5
# Native compiler binaries are optional packages: pnpm skips them silently if a download
# fails. Fail here with a clear message instead of a confusing build error later.
RUN cd apps/api && node -e "require('@swc/core'); require('argon2')" \
    || (echo 'Native packages failed to install (network?). Re-run the build.' && exit 1)
COPY --from=pruner /repo/out/full/ .
ENV TURBO_TELEMETRY_DISABLED=1
RUN pnpm exec turbo run build --filter=@natik/api

# 3a. One-off migration job (has the Prisma CLI).
FROM builder AS migrate
WORKDIR /repo/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# 3b. Production dependencies only (the Prisma client is already compiled into dist).
FROM base AS prod-deps
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --fetch-timeout=600000 --fetch-retries=5 \
    && cd apps/api && node -e "require('argon2'); require('@prisma/adapter-pg')"

# 4. Runtime image, non-root user.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S natik && adduser -S natik -G natik
COPY --from=prod-deps --chown=natik:natik /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=natik:natik /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=natik:natik /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder --chown=natik:natik /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=natik:natik /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=natik:natik /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=natik:natik /repo/apps/api/dist ./apps/api/dist
# Certificates are PDFs printed from a web page by a headless browser (see certificate-renderer.ts).
RUN apk add --no-cache chromium font-noto-arabic
ENV CHROMIUM_PATH=/usr/bin/chromium
USER natik
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
