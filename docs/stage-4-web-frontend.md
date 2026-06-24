# Stage 4 — Web Frontend MVP

**Status:** ✅ Done · **Commit:** `Stage 4: web frontend MVP (React + Vite)`

## Goal

A real, usable web app on top of the Stage 2 (auth) and Stage 3 (properties &
listings) APIs: browse and search listings, view details on a map, sign in, and
manage your own properties.

## What was built

A new `apps/web` package — **React + TypeScript + Vite + Tailwind + TanStack
Query + Zustand + React Router + Leaflet**, consuming the shared
`@genuine-homes/shared` types and Zod schemas.

### Pages & routes

| Route | Access | What it does |
| ----- | ------ | ------------ |
| `/` | public | Search: facets, "near me" geolocation, result cards, map, pagination |
| `/listings/:id` | public | Listing detail: gallery, specs, amenities, map, the property's other listings |
| `/login`, `/register` | public | Auth forms validated with the shared Zod schemas |
| `/dashboard` | protected | Seller view: your properties + create-property / add-listing forms |

### Cross-cutting

- **Auth**: a persisted Zustand store holds the session; an Axios client attaches
  the access token and, on a 401, performs a **single-flight refresh-token
  rotation** then replays the request — falling back to logout if refresh fails.
- **Data**: TanStack Query for all fetching/caching, with `keepPreviousData` for
  smooth pagination.
- **Validation reuse**: the login/register/property/listing forms parse input
  with the **same Zod schemas the API mirrors** — the monorepo's single source
  of truth in action.
- **Maps**: Leaflet (OpenStreetMap tiles) renders result markers and a search
  radius; geolocation drives the "near me" search.
- **Design**: a small Tailwind design system (brand greens + gold) with
  reusable `.btn`/`.input`/`.card`/`chip` classes, matching the stage decks.

## Key decisions

> **Dev proxy instead of CORS juggling.** Vite proxies `/api` → the NestJS
> backend on `:3100`, so the SPA and API share an origin in development and the
> API client just uses a relative `/api` base URL.

> **Explicit re-exports in `@genuine-homes/shared`.** The package compiles to
> CommonJS (so the API and Jest can consume it). A bundler can't see names
> re-exported through `export *` from a CJS module, so the shared barrel now
> uses explicit `export { … }` re-exports — and Vite's commonjs plugin is told
> to include the workspace package (its real path is outside `node_modules`).

## Key files

```
apps/web/vite.config.ts                  # dev proxy + commonjs include for shared
apps/web/src/lib/apiClient.ts            # axios + 401 refresh rotation
apps/web/src/store/authStore.ts          # persisted session (Zustand)
apps/web/src/api/{auth,listings,properties}.ts
apps/web/src/pages/{HomePage,ListingDetailPage,LoginPage,RegisterPage,DashboardPage}.tsx
apps/web/src/components/{Layout,SearchFilters,ListingCard,ResultsMap,...}.tsx
```

## Verification

- `tsc` type check + `vite build` succeed (production bundle emitted).
- The API is unaffected: 34 backend unit tests still pass.
- **Live, end-to-end**: with the API + DB running, the Vite dev server was
  booted and the proxy exercised — `GET /api/health` and `GET /api/listings`
  (returned the 2 seeded listings) and `POST /api/auth/login` (returned a
  landlord token) all succeeded through `http://localhost:5173`, confirming the
  SPA → proxy → API → Postgres path. (Visual/interaction testing in a browser
  is still recommended.)

## How to run

```bash
pnpm install && pnpm build:shared
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev:api        # API on http://localhost:3100/api
pnpm dev:web        # web on http://localhost:5173  (proxies /api -> :3100)
# Log in with a seeded account: +256700000002 / Password123!
```
