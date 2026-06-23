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

## Stage 1 — Database schema ✅

Prisma schema (`apps/api/prisma/schema.prisma`) modelling all entities from the
doc: users, properties, listings, installment_plans, installment_payments,
payments (unified ledger), property_images, rental_agreements, verifications,
favorites, reviews, messages, notifications — plus `refresh_tokens` for the
upcoming auth module.

- **Money** is `Decimal`/numeric everywhere (never float).
- **Soft deletes** (`deleted_at`) on users, properties, listings.
- **PostGIS** `geography(Point, 4326)` on properties; the GiST index is appended
  to the init migration by hand (Prisma can't index `Unsupported` columns).
- snake_case table/column names via `@@map`/`@map`; UUID PKs; timestamptz.
- Indexes: `(district, type)` + `(listing_type, is_active, price)` for the main
  search, GIN on `amenities` jsonb, GiST on `location`, `provider_ref` unique
  for payment-webhook idempotency.
- `PrismaService` + global `PrismaModule` wired into `AppModule`.
- Idempotent seed (`prisma/seed.ts`): admin + landlord + tenant (argon2 hashes,
  dev password `Password123!`), 2 properties with PostGIS locations, 2 listings.

**Verified:** migration applied to dockerized Postgres+PostGIS; all 14 tables +
GiST index present; seed ran; a `ST_Distance` query returned correct distances
(Nakawa house 4.04 km, Gayaza plot 10.65 km from Kampala center). API builds.

### How to resume next time

```bash
pnpm install              # if deps changed
pnpm db:up                # start Postgres + Redis (Docker Desktop must be running)
pnpm --filter @genuine-homes/api prisma:generate
pnpm --filter @genuine-homes/api prisma:seed   # optional demo data
pnpm dev:api              # boots on http://localhost:3100/api (3000 = Grafana here)
```

---

## Stage 2 — Auth module (next)

JWT access (short-lived) + refresh token rotation (hashed in `refresh_tokens`),
argon2 password hashing (dep already installed), `@Roles()` RBAC guard,
register/login/refresh/logout endpoints, login rate limiting.
