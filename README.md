# Genuine Homes

A real estate **rental & ownership** platform for East Africa (launching in Uganda).
Genuine Homes lets people **rent, buy outright, or buy in installments** — backed by
listing **verification**, **Mobile Money** payments (MTN MoMo / Airtel Money), and a
transparent **installment ownership** engine.

> Built from the project specification in
> `GenuineHome Documentation.docx` and the engineering blueprint in
> `GenuineHomesTechnicalArchitecture&DesignPatterns.docx`.

## Tech stack

| Layer            | Choice                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Web frontend     | React + TypeScript + Vite + Tailwind + TanStack Query + Zustand        |
| Mobile (later)   | React Native (Expo) — Android first                                    |
| Backend          | NestJS (TypeScript) + Prisma — **modular monolith**                    |
| Database         | PostgreSQL (+ PostGIS) + Redis                                          |
| Payments         | Flutterwave (MTN MoMo, Airtel Money, cards)                            |
| Media            | Cloudinary                                                             |
| Notifications    | Firebase Cloud Messaging + Africa's Talking SMS                        |
| Core patterns    | Layered architecture · Repository · Strategy (payments) · State machine (plans) · Event-driven notifications · RBAC |

## Repository layout (pnpm monorepo)

```
genuine-homes/
├── apps/
│   ├── api/        # NestJS modular-monolith backend
│   └── web/        # React + Vite web app
├── packages/
│   └── shared/     # Types + Zod schemas shared by api and web
├── docker-compose.yml   # Postgres (PostGIS) + Redis for local dev
└── pnpm-workspace.yaml
```

## Getting started

```bash
# 1. Install dependencies (from the repo root)
pnpm install

# 2. Start local infrastructure (Postgres + Redis)
pnpm db:up

# 3. Configure the API environment
cp apps/api/.env.example apps/api/.env   # then edit secrets

# 4. Run database migrations + generate the Prisma client
pnpm db:migrate

# 5. Start the backend (and, later, the web app)
pnpm dev:api
pnpm dev:web
```

## Build roadmap

Following the architecture doc's recommended build order:

- [x] **Stage 0** — Monorepo foundation (workspace, Docker, configs)
- [x] **Stage 1** — Database schema (Prisma + PostGIS), PrismaModule, seed
- [x] **Stage 2** — Auth module (JWT + RBAC, refresh rotation, rate limiting)
- [x] **Stage 3** — Properties & Listings (CRUD + PostGIS search, RBAC, soft delete)
- [x] **Stage 4** — Web frontend MVP (search, map, auth, seller dashboard)
- [x] **Stage 5** — Payments module (gateway strategy + ledger + idempotent webhooks)
- [ ] **Stage 6** — Installment engine (plans, schedules, reminders)
- [ ] **Stage 7+** — Verification, chat, mobile app

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for stage-by-stage progress notes.
