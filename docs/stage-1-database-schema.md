# Stage 1 — Database Schema (Prisma + PostGIS)

**Status:** ✅ Done · **Commit:** `Stage 1: database schema (Prisma + PostGIS)`

## Goal

Model the whole domain in a Prisma schema and wire it into the NestJS app, so
every later stage has a typed, migrated database to build on.

## What was built

A Prisma schema (`apps/api/prisma/schema.prisma`) covering all core entities:

- `users`, `properties`, `listings`
- `installment_plans`, `installment_payments`
- `payments` (one unified ledger for **all** money movements)
- `property_images`, `rental_agreements`, `verifications`
- `favorites`, `reviews`, `messages`, `notifications`
- `refresh_tokens` (added ahead of the Stage 2 auth module)

Plus:

- A global **`PrismaModule`** + `PrismaService` (the single database entry
  point; repositories depend on it, controllers/services never make their own
  client).
- An **idempotent seed** (`prisma/seed.ts`): an admin, a landlord, and a tenant
  (argon2 password hashes, dev password `Password123!`), two properties with
  real PostGIS locations, and two listings.

## Design rules baked into the schema

- **Money is `Decimal`/numeric, never float** — floats lose cents.
- **Soft deletes** (`deleted_at`) on `users`, `properties`, `listings` — never
  lose financial history.
- **PostGIS** `geography(Point, 4326)` on `properties` for "within N km" map
  search. The GiST index is appended to the init migration by hand because
  Prisma can't index an `Unsupported` column.
- **snake_case** table/column names via `@@map`/`@map`; **UUID** primary keys;
  **timestamptz** timestamps.
- **Indexes** for the real queries: `(district, type)` and
  `(listing_type, is_active, price)` for search, GIN on the `amenities` JSON,
  GiST on `location`, and a unique `provider_ref` on payments for
  webhook idempotency.

## Key files

```
apps/api/prisma/schema.prisma                       # the full data model
apps/api/prisma/migrations/.../migration.sql        # init migration (+ GiST index)
apps/api/prisma/seed.ts                              # idempotent dev seed
apps/api/src/prisma/prisma.service.ts               # single DB entry point
apps/api/src/prisma/prisma.module.ts                # global module
```

## Verification

The migration was applied to the Dockerised Postgres+PostGIS; all 14 tables and
the GiST index were present; the seed ran; and a `ST_Distance` query returned
correct distances (Nakawa house 4.04 km, Gayaza plot 10.65 km from Kampala
centre). The API built cleanly.

## How to resume

```bash
pnpm db:up
pnpm --filter @genuine-homes/api prisma:generate
pnpm --filter @genuine-homes/api prisma:seed    # optional demo data
```
