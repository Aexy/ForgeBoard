# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

FROM base AS dependencies
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

COPY --from=dependencies /app ./
COPY apps/web apps/web
COPY packages/api-client packages/api-client
COPY packages/ui packages/ui

# These inert values satisfy build-time validation only. Runtime configuration replaces
# them and must be injected by the deployment platform, never copied into this image.
ENV AUTH_SECRET=build-only-auth-secret-not-for-runtime
ENV AUTH_URL=http://build.invalid
ENV FORGEBOARD_API_BASE_URL=http://spring.invalid
ENV FORGEBOARD_TOKEN_ISSUER=forgeboard-build
ENV FORGEBOARD_PUBLIC_ORIGIN=http://build.invalid
ENV FORGEBOARD_PREVIEW_FIRM_SLUGS=build-placeholder

RUN pnpm --filter @forgeboard/web build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
