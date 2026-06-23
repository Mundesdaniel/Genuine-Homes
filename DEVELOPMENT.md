# Development Log

Progress notes per build stage. Each stage is a git commit checkpoint.

---

## Stage 0 — Monorepo foundation ✅

- pnpm workspace with `apps/api`, `apps/web`, `packages/shared`.
- `docker-compose.yml`: PostgreSQL 16 + PostGIS 3.4, Redis 7.
- Root scripts (`db:up`, `db:migrate`, `dev:api`, `dev:web`, …).
- `packages/shared`: shared TypeScript types + Zod schemas (the doc calls for
  sharing validation between backend `class-validator`/Zod and frontend Zod).
- Editor/Node config, `.gitignore`.

**Decision:** Adopted a pnpm monorepo from day one (rather than the doc's
"start simple, monorepo in Phase 2") because the spec repeatedly requires sharing
Zod schemas and DTO types between the API and web app, and pnpm was already
available. This keeps a single source of truth for domain types.

---

## Stage 1 — Database schema (next)

Prisma schema modelling: users, properties, listings, installment_plans,
installment_payments, payments (unified ledger), property_images,
rental_agreements, verifications, favorites, reviews, messages, notifications.
PostGIS `geography(Point)` for property location; numeric (never float) for money.
