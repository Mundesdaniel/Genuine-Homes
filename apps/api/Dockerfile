# Genuine Homes API — multi-stage build for the pnpm monorepo.
# Build context is the REPO ROOT:
#   docker build -f apps/api/Dockerfile .

# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Manifests first so dependency install caches across code-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @genuine-homes/api --filter @genuine-homes/shared

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @genuine-homes/shared build \
 && pnpm --filter @genuine-homes/api prisma:generate \
 && pnpm --filter @genuine-homes/api build

# Self-contained production bundle (prod deps only; workspace deps vendored).
RUN pnpm --filter @genuine-homes/api --legacy deploy --prod /out
# Regenerate the Prisma client inside the deployed node_modules so the query
# engine matches this image. `prisma` is a production dependency because the
# entrypoint also runs `migrate deploy` at container start.
WORKDIR /out
RUN ./node_modules/.bin/prisma generate

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out .
COPY --chown=app:app apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && mkdir -p uploads && chown app:app uploads
USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
