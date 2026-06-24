# Genuine Homes — Stage Documentation

Genuine Homes is a real estate **rental & ownership** platform for East Africa
(launching in Uganda): rent, buy outright, or buy in installments — backed by
listing verification, Mobile Money payments, and a transparent installment
ownership engine.

The project is built in **stages**, each one a git commit checkpoint. This
folder holds one document per stage. For the running progress log see
[`../DEVELOPMENT.md`](../DEVELOPMENT.md); for the high-level pitch and setup see
[`../README.md`](../README.md).

## Stages

| Stage | Title | Status | Document |
| ----- | ----- | ------ | -------- |
| 0 | Monorepo foundation | ✅ Done | [stage-0-monorepo-foundation.md](./stage-0-monorepo-foundation.md) |
| 1 | Database schema (Prisma + PostGIS) | ✅ Done | [stage-1-database-schema.md](./stage-1-database-schema.md) |
| 2 | Auth module (JWT + RBAC) | ✅ Done | [stage-2-auth-module.md](./stage-2-auth-module.md) |
| 3 | Properties & Listings (CRUD + search) | ✅ Done | [stage-3-properties-and-listings.md](./stage-3-properties-and-listings.md) |
| 4 | Web frontend MVP | ✅ Done | [stage-4-web-frontend.md](./stage-4-web-frontend.md) |
| 5 | Payments module (Flutterwave + ledger + webhooks) | ✅ Done | [stage-5-payments.md](./stage-5-payments.md) |
| 6 | Installment engine (plans, schedules, reminders) | ⬜ Next | _planned_ |
| 7+ | Verification, chat, mobile app | ⬜ Planned | _planned_ |

## Slide decks (PowerPoint)

Designed `.pptx` decks live in [`presentations/`](./presentations) — a project
overview plus one deck per completed stage, all sharing one design system
(cover, section header bar, gold accent, bullet/table/callout layouts).

| Deck | File |
| ---- | ---- |
| Project overview | [presentations/00-genuine-homes-overview.pptx](./presentations/00-genuine-homes-overview.pptx) |
| Stage 0 — Monorepo foundation | [presentations/stage-0-monorepo-foundation.pptx](./presentations/stage-0-monorepo-foundation.pptx) |
| Stage 1 — Database schema | [presentations/stage-1-database-schema.pptx](./presentations/stage-1-database-schema.pptx) |
| Stage 2 — Auth module | [presentations/stage-2-auth-module.pptx](./presentations/stage-2-auth-module.pptx) |
| Stage 3 — Properties & Listings | [presentations/stage-3-properties-and-listings.pptx](./presentations/stage-3-properties-and-listings.pptx) |
| Stage 4 — Web frontend | [presentations/stage-4-web-frontend.pptx](./presentations/stage-4-web-frontend.pptx) |
| Stage 5 — Payments | [presentations/stage-5-payments.pptx](./presentations/stage-5-payments.pptx) |

Regenerate them after editing the content/design in
[`../scripts/generate-presentations.mjs`](../scripts/generate-presentations.mjs):

```bash
pnpm slides
```

## Tech stack at a glance

| Layer | Choice |
| ----- | ------ |
| Web frontend | React + TypeScript + Vite + Tailwind + TanStack Query + Zustand |
| Backend | NestJS (TypeScript) + Prisma — modular monolith |
| Database | PostgreSQL (+ PostGIS) + Redis |
| Payments | Flutterwave (MTN MoMo, Airtel Money, cards) |
| Media | Cloudinary |
| Notifications | Firebase Cloud Messaging + Africa's Talking SMS |

## Repository layout

```
genuine-homes/
├── apps/
│   ├── api/        # NestJS modular-monolith backend
│   └── web/        # React + Vite web app (Stage 4)
├── packages/
│   └── shared/     # Types + Zod schemas shared by api and web
├── docs/           # Per-stage documentation (this folder)
└── docker-compose.yml   # Postgres (PostGIS) + Redis for local dev
```
