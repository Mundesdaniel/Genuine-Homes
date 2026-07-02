# Genuine Homes — Web App

The React single-page app for Genuine Homes: browse & search listings (with a
map), sign in, manage properties, and run the installment-ownership journey with
live charts.

> The web app is a **frontend to the Genuine Homes API**. To run it for real you
> also need the API and its database running — this guide covers the whole
> thing. (You can run the UI alone, but every screen that loads data will be
> empty until the API is up.)

---

## Tech

React · TypeScript · Vite · Tailwind CSS · TanStack Query · Zustand ·
React Router · Leaflet (maps) · Recharts (charts) · react-hot-toast.

## Prerequisites

| Tool           | Version    | Notes                                        |
| -------------- | ---------- | -------------------------------------------- |
| Node.js        | **22+**    | see `.nvmrc`                                 |
| pnpm           | **10+**    | `npm i -g pnpm`                              |
| Docker Desktop | any recent | runs PostgreSQL + Redis; **must be running** |

All commands below are run from the **repository root** unless noted.

---

## Quick start (full stack)

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Build the shared package (the web app imports its types & schemas)
pnpm build:shared

# 3. Start PostgreSQL + Redis (Docker Desktop must be running)
pnpm db:up

# 4. Apply migrations and load demo data
pnpm db:migrate
pnpm db:seed

# 5. Start the API  (http://localhost:3100/api)
pnpm dev:api

# 6. In a second terminal, start the web app  (http://localhost:5173)
pnpm dev:web
```

Then open **http://localhost:5173**.

The Vite dev server proxies `/api` → the API on port `3100`, so the SPA and API
share an origin in development — no CORS setup needed.

### Demo accounts

All seeded users share the password **`Password123!`**:

| Login                       | Role      | Good for                                       |
| --------------------------- | --------- | ---------------------------------------------- |
| `roro@gmail.com`            | buyer     | the dashboard charts + a live installment plan |
| `daniel@gmail.com`          | developer | listing properties (seller dashboard)          |
| `sarah.landlord@example.ug` | landlord  | seller dashboard                               |
| `+256700000003`             | tenant    | a plain buyer account                          |
| `admin@genuinehomes.ug`     | admin     | full access                                    |

> You can log in with either the **email or the phone** in the "Email or phone"
> field.

---

## What you can do

- **Browse / search** (`/`) — filter by district, type, price, bedrooms; click
  **📍 Search near me** for a PostGIS radius search shown on the map.
- **Listing detail** (`/listings/:id`) — gallery, amenities, map, and (for
  installment listings) a **Buy on installment** panel.
- **Sign up / log in** — `/register`, `/login`.
- **Dashboard** (`/dashboard`) — live charts (payments over time, properties by
  status, plan progress), your installment plans, and (for sellers) create
  property / add listing.
- **Installment plan** (`/plans/:id`) — schedule, progress, and **Pay** buttons.

### Paying in development (mock gateway)

No real payment keys are needed. When you pay a deposit or installment, the app
opens a **simulated checkout** page — click **Approve** and the payment settles,
which (via a backend event) activates/advances your plan in real time. The
charts and plan update on their own (polled every 15s).

To use real Flutterwave instead, set `FLUTTERWAVE_SECRET_KEY` and
`FLUTTERWAVE_WEBHOOK_HASH` in `apps/api/.env` and restart the API.

---

## Configuration

The web app needs no config for local dev (the proxy handles `/api`). For other
environments, copy the example and set the API URL:

```bash
cp apps/web/.env.example apps/web/.env
# VITE_API_URL=https://api.your-domain.com/api
```

---

## Scripts (run inside `apps/web`, or via `pnpm --filter @genuine-homes/web <script>`)

| Script         | What it does                          |
| -------------- | ------------------------------------- |
| `pnpm dev`     | Start the Vite dev server (port 5173) |
| `pnpm build`   | Type-check then build to `dist/`      |
| `pnpm preview` | Serve the production build locally    |
| `pnpm lint`    | Type-check only (`tsc --noEmit`)      |

---

## Production build

```bash
pnpm build:shared
pnpm --filter @genuine-homes/web build      # outputs apps/web/dist/
pnpm --filter @genuine-homes/web preview     # optional local preview
```

Deploy `apps/web/dist/` to any static host and point `VITE_API_URL` at your
deployed API.

---

## Troubleshooting

- **Screens are empty / network errors** — the API isn't running or the DB is
  down. Check `pnpm dev:api` is up and `docker ps` shows `gh_postgres` healthy.
- **`Can't reach database server at localhost:5432`** (API logs) — start Docker
  Desktop, then `pnpm db:up`.
- **Port already in use** — something is on `5173` or `3100`. Stop it, or change
  the web port in `apps/web/vite.config.ts` and the API port via `PORT` in
  `apps/api/.env`.
- **Login works but lists 401 / log out unexpectedly** — your access token
  expired and the refresh token was revoked; just log in again.
- **Type errors after pulling changes** — rebuild the shared package:
  `pnpm build:shared`.

```

```
