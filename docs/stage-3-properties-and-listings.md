# Stage 3 — Properties & Listings (CRUD + Search)

**Status:** ✅ Done · **Commit:** `Stage 3: properties & listings (CRUD + PostGIS search)`

## Goal

The heart of the catalogue: let sellers manage properties and the ways they're
offered (rent / sale / installment), and let anyone discover them through a
faceted, location-aware search. This is the API the Stage 4 web frontend builds
against.

## What was built

Two feature modules: `apps/api/src/properties` and `apps/api/src/listings`.

### Properties (`/api/properties`)

| Method & path | Auth | Purpose |
| ------------- | ---- | ------- |
| `POST /` | seller roles | Create a property |
| `GET /mine` | bearer | The current user's properties (paginated) |
| `GET /:id` | public | Full detail: gallery + listings + coordinates |
| `PATCH /:id` | owner/admin | Update a property you own |
| `DELETE /:id` | owner/admin | Soft-delete (cascades to its listings) |
| `POST /:id/images` | owner/admin | Attach an image URL |
| `DELETE /:id/images/:imageId` | owner/admin | Remove an image |

### Listings

| Method & path | Auth | Purpose |
| ------------- | ---- | ------- |
| `POST /api/properties/:propertyId/listings` | owner/admin | Create a listing |
| `GET /api/listings` | public | **Search** (facets + "near me") |
| `GET /api/listings/:id` | public | Listing + its property |
| `PATCH /api/listings/:id` | owner/admin | Update a listing |
| `DELETE /api/listings/:id` | owner/admin | Soft-delete a listing |

**Seller roles** = `landlord`, `agent`, `developer`, `admin` (tenants can't own
properties). Every mutation is also **ownership-checked** — you can only touch
your own; admins bypass.

### Listing type rules

A listing is `rent`, `sale`, or `installment`, each with different required
fields, enforced by a single shared rule (`listingShapeError`):

- **rent** → requires a `rentPeriod` (monthly/yearly), no installment terms.
- **sale** → no `rentPeriod`, no installment terms.
- **installment** → requires `minDepositPercent` + `maxInstallmentMonths`
  within the platform `INSTALLMENT` guardrails; no `rentPeriod`.

Updating a listing to a different type clears the now-irrelevant fields.

### Search (`GET /api/listings`)

- **Faceted filters**: `district`, property `type`, `listingType`,
  `minPrice`/`maxPrice`, `minBedrooms`, `onlyVerified`.
- **"Near me"**: `lat` + `lng` (+ optional `radiusM`, default 5 km) → a PostGIS
  radius search using `ST_DWithin`, with `ST_Distance` returned in **metres**.
- **Sorting**: `newest`, `price_asc`, `price_desc`, `distance` (geo searches
  default to nearest-first).
- **Pagination**: `page` / `pageSize`.

Results are **listing-centric** — one hit per listing, with its property
embedded — which is how people actually search and which maps cleanly onto the
`(listing_type, is_active, price)` index.

## Key decisions

> **Listing-centric search** (one row per listing + property) rather than
> property-centric: it matches real queries ("rentals in Kampala under X"), fits
> the existing index, and avoids property/listing fan-out duplication in
> pagination.

> **Parameterised raw SQL for search.** The `location` column is an
> `Unsupported` PostGIS type, so it can't go through the Prisma query builder.
> The search builds its `WHERE`/`ORDER BY` from safe `Prisma.sql` fragments
> (never string interpolation), runs the geo query for matching ids + distance,
> then hydrates full rows via Prisma. Coordinates are written/read with raw SQL
> (`ST_MakePoint` / `ST_X`/`ST_Y`).

> **Soft-delete cascades.** Deleting a property also deactivates its listings,
> so both leave search while financial history is preserved.

## Key files

```
apps/api/src/properties/properties.controller.ts   # property + image endpoints
apps/api/src/properties/properties.service.ts       # ownership, coords, CRUD
apps/api/src/properties/properties.repository.ts     # Prisma + PostGIS raw SQL
apps/api/src/listings/listings.controller.ts         # search/detail/update/delete
apps/api/src/listings/property-listings.controller.ts# nested create
apps/api/src/listings/listings.service.ts            # type rules, search orchestration
apps/api/src/listings/listings.repository.ts          # faceted + geo search SQL
apps/api/src/common/mappers.ts                        # Prisma rows -> API shapes
apps/api/src/common/roles.ts                          # SELLER_ROLES
apps/api/src/common/dto/pagination-query.dto.ts       # reusable ?page&pageSize
packages/shared/src/schemas/property.ts               # shared schemas + types
packages/shared/src/schemas/listing.ts                # incl. listingShapeError
```

## Verification (live, against Dockerised Postgres+PostGIS)

- `nest build` + type check pass; **34 unit tests** green (auth + RBAC +
  properties/listings services + AppModule DI).
- End-to-end over HTTP:
  - public search returned the seeded listings;
  - a geo search at Kampala centre / 8 km returned **only** the Nakawa house at
    **4035 m** (the Gayaza plot at ~10.6 km was correctly excluded);
  - creating a property with coordinates + a rent listing made it appear in a
    3 km geo search;
  - a tenant creating a property was blocked (**403**);
  - a rent listing with no period was rejected (**400**);
  - soft-delete returned **204**, after which the detail **404**s and the
    listing leaves search.

## How to try it

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev:api
curl 'localhost:3100/api/listings?district=Kampala&listingType=rent'
curl 'localhost:3100/api/listings?lat=0.3476&lng=32.5825&radiusM=8000'
```
