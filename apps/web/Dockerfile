# Genuine Homes web app — static build served by nginx, which also reverse-
# proxies /api, /socket.io and /uploads to the API container.
# Build context is the REPO ROOT:
#   docker build -f apps/web/Dockerfile .

# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @genuine-homes/web --filter @genuine-homes/shared

COPY packages/shared packages/shared
COPY apps/web apps/web

# Same-origin by default: the bundle calls /api and nginx proxies it.
# Override only when the API lives on a different origin.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @genuine-homes/shared build \
 && pnpm --filter @genuine-homes/web build

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
