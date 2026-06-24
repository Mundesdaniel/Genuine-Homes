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

## Stage 2 — Auth module (JWT + RBAC) ✅

Full authentication + authorization for the modular monolith
(`apps/api/src/auth`).

- **Endpoints** (`/api/auth`): `POST register`, `POST login`, `POST refresh`,
  `POST logout`, `GET me`.
- **Passwords**: argon2id via `@node-rs/argon2` (same scheme as the seed).
  Login runs a decoy verify when the account is missing, so timing can't be
  used to enumerate users; credential errors are deliberately generic.
- **Tokens**: short-lived JWT access token + long-lived refresh token, both
  signed in `TokenService` (the only place the secrets are read). Payloads carry
  a `type` (`access`/`refresh`) so the two can't be swapped.
- **Refresh rotation + reuse detection**: refresh tokens are stored only as a
  SHA-256 hash in `refresh_tokens`. Each refresh revokes the old row and issues
  a new one; replaying a rotated token revokes **every** session for that user.
- **RBAC**: global `JwtAuthGuard` (everything is protected unless `@Public()`)
  + global `RolesGuard` (`@Roles(...)`). `@CurrentUser()` injects the user.
  `admin` can never be self-assigned at registration.
- **Rate limiting**: `@nestjs/throttler` — 100 req/min/IP default, tightened to
  5/min on register & login and 10/min on refresh.
- **Validation**: class-validator DTOs mirror the Zod schemas now exported from
  `@genuine-homes/shared` (`registerSchema`/`loginSchema`), keeping API and
  web validation in lockstep.

**Decision:** Implemented the JWT guards directly on `@nestjs/jwt` rather than
pulling in Passport — fewer dependencies, full control over refresh-token
rotation, and simpler to unit test. Made `JwtAuthGuard` a global guard with an
`@Public()` opt-out so every future endpoint is secure by default (good fit for
a financial platform); the health probe is marked `@Public()`.

**Verified:** `pnpm --filter @genuine-homes/api build` (nest build) and the type
check pass; 16 unit tests green — `AuthService` (register, duplicate phone,
login by phone/email, wrong-password & unknown-user rejection, refresh rotation,
reuse detection, logout), `RolesGuard`, and an `AppModule` DI smoke test that
boots the whole graph with Prisma stubbed (so it needs no database). A live
boot against Postgres was **not** run this round — Docker Desktop was down.

### How to resume next time

```bash
pnpm install
pnpm db:up                # start Postgres + Redis (Docker Desktop must be running)
pnpm --filter @genuine-homes/api prisma:generate
pnpm --filter @genuine-homes/api prisma:seed   # seeded users can now log in
pnpm dev:api
# Smoke test (seeded dev password = Password123!):
#   curl -XPOST localhost:3100/api/auth/login -H 'content-type: application/json' \
#        -d '{"emailOrPhone":"+256700000003","password":"Password123!"}'
#   curl localhost:3100/api/auth/me -H "authorization: Bearer <accessToken>"
```

---

## Stage 3 — Properties & Listings (CRUD + search) ✅

Property and listing management plus public discovery
(`apps/api/src/properties`, `apps/api/src/listings`).

- **Properties** (`/api/properties`): create, update, soft-delete, `GET /:id`
  (public detail with gallery + listings + coordinates), `GET /mine`
  (paginated owner dashboard), and image attach/remove. Mutations are gated to
  seller roles (`landlord`/`agent`/`developer`/`admin`) **and** an ownership
  check (admins bypass).
- **Listings** (`/api/listings`, created under `/api/properties/:id/listings`):
  create/update/soft-delete with the rent/sale/installment cross-field rules
  (`listingShapeError` — rent needs a period, installment needs deposit % +
  months within the `INSTALLMENT` guardrails, etc.). Updates that switch the
  listing type clear the now-irrelevant fields.
- **Search** (`GET /api/listings`): faceted (district, property type, listing
  type, price range, min bedrooms, verified-only) + **PostGIS "near me"**
  (`lat`/`lng`/`radiusM`, `ST_DWithin` + `ST_Distance`, distance returned in
  metres), with `newest`/`price`/`distance` sorting and pagination. Built with
  parameterised `Prisma.sql` fragments (no string interpolation), then hydrated
  via Prisma.
- **PostGIS**: coordinates are written/read with raw SQL (`ST_MakePoint` /
  `ST_X`/`ST_Y`) since Prisma can't touch the `Unsupported` geography column.
- **Soft deletes** cascade: deleting a property deactivates its listings, so
  both leave search while financial history is preserved.

**Decision:** Made search **listing-centric** (one row per listing + its
property) rather than property-centric — it matches how people search ("rentals
in Kampala under X"), maps cleanly onto the `(listing_type, is_active, price)`
index, and avoids property/listing fan-out duplication in pagination.

**Verified (live against Dockerised Postgres+PostGIS):** `nest build` + type
check pass; 34 unit tests green (auth + RBAC + properties/listings services +
AppModule DI). End-to-end over HTTP: landlord login → public search (2 seeded
listings) → geo search at Kampala centre/8 km returns only the Nakawa house at
**4035 m** (Gayaza plot at ~10.6 km correctly excluded) → created a property
with coordinates + a rent listing → it surfaced in a 3 km geo search → tenant
create blocked (**403**) → rent-without-period rejected (**400**) → soft-delete
returned **204**, after which detail **404**s and the listing leaves search.

### How to resume next time

```bash
pnpm install && pnpm build:shared
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev:api
# Public search examples:
#   curl 'localhost:3100/api/listings?district=Kampala&listingType=rent'
#   curl 'localhost:3100/api/listings?lat=0.3476&lng=32.5825&radiusM=8000'
```

---

## Stage 4 — Web frontend MVP (next)

React + Vite + TS + Tailwind + TanStack Query + Zustand. Auth flow against
Stage 2 (register/login/refresh/protected routes), and property browse / map
search / detail against the Stage 3 listing-search API.
