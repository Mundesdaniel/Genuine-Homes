# Stage 0 — Monorepo Foundation

**Status:** ✅ Done · **Commit:** `Stage 0: monorepo foundation`

## Goal

Stand up the project skeleton: one repository that holds the backend, the
(future) web app, and the code they share, plus the local infrastructure needed
to develop against a real database.

## What was built

- **pnpm workspace** with three packages:
  - `apps/api` — the NestJS backend.
  - `apps/web` — the React web app (scaffolded in Stage 4).
  - `packages/shared` — TypeScript types + Zod schemas shared by the API and
    the clients.
- **`docker-compose.yml`** for local infrastructure:
  - PostgreSQL 16 with the **PostGIS 3.4** extension (geographic search).
  - Redis 7 (cache, rate limiting, and the future job queue).
- **Root scripts** to drive everything: `db:up`, `db:down`, `db:migrate`,
  `db:seed`, `dev:api`, `dev:web`, `build`, `lint`, `test`.
- **`packages/shared`** — the single source of truth for domain enums,
  constants, and (added in later stages) Zod validation schemas.
- Editor / Node configuration (`.editorconfig`, `.nvmrc`, `.gitattributes`)
  and a project `.gitignore`.

## Key decision

> **Adopt a pnpm monorepo from day one** (rather than "start simple, add a
> monorepo later"). The specification repeatedly requires sharing Zod schemas
> and DTO types between the API and the web app, so a shared package keeps a
> single source of truth for domain types from the very first commit.

## Key files

```
package.json              # root scripts + pnpm workspace config
pnpm-workspace.yaml       # workspace package globs
docker-compose.yml        # Postgres (PostGIS) + Redis
packages/shared/          # shared enums / constants / schemas
.nvmrc / .editorconfig    # toolchain + editor config
```

## How to run

```bash
pnpm install          # install all workspace dependencies
pnpm db:up            # start Postgres + Redis (Docker Desktop must be running)
```
