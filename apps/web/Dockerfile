# syntax=docker/dockerfile:1.7
# Natik web (Next.js). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t natik-web .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# 1. Keep only what @natik/web needs (better layer caching).
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @natik/web --docker

# 2. Install and build.
FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --fetch-timeout=600000 --fetch-retries=5
COPY --from=pruner /repo/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone TURBO_TELEMETRY_DISABLED=1
RUN pnpm exec turbo run build --filter=@natik/web

# 3. Small runtime image: Next.js standalone server, non-root user.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S natik && adduser -S natik -G natik
COPY --from=builder --chown=natik:natik /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=natik:natik /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=natik:natik /repo/apps/web/public ./apps/web/public
USER natik
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
