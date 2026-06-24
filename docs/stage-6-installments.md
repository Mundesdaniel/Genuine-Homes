# Stage 6 — Installment Engine (+ web charts & yellow theme)

**Status:** ✅ Done · **Commit:** `Stage 6: installment engine + web charts/theme`

## Goal

The platform's headline feature: turn an installment listing into a **plan**
(deposit + monthly schedule), drive its **state machine**, and react to settled
payments automatically. Plus a livelier, yellow-themed web app with live charts
and the in-browser installment journey.

## Backend — the engine (`apps/api/src/installments`)

### Endpoints (`/api/installment-plans`)

| Method & path | Purpose |
| ------------- | ------- |
| `POST /` | Create a plan from a listing (deposit % + months) |
| `GET /mine` | Your plans (with schedule + progress) |
| `GET /:id` | One plan: schedule + progress totals |
| `POST /:id/deposit` | Start the deposit payment |
| `POST /:id/installments/:installmentId/pay` | Pay a scheduled installment |
| `POST /:id/cancel` | Cancel a plan still awaiting its deposit |

### How it works

- **Plan creation** computes the deposit and an **exact monthly schedule** with
  `Decimal` math — the final installment absorbs any rounding remainder, so the
  installments sum to the financed amount to the cent.
- **State machine**: `pending_deposit → active → completed` (with `cancelled` /
  `defaulted`), transitions enforced server-side.
- **Event-driven**: paying the deposit/installment goes through the Stage 5
  payments module. When a payment settles, `PaymentsService` emits
  `payment.succeeded` (via `@nestjs/event-emitter`) and the installments module
  **activates the plan** (deposit) or **marks the schedule item paid and
  completes the plan** (final installment) — no circular module dependency.

## Web — lively, yellow, charted (`apps/web`)

- **Yellow theme**: Tailwind brand recoloured to a deep golden yellow + bright
  gold accent (readable contrast kept).
- **Interactivity**: `react-hot-toast` on every action, entrance animations
  (fade/slide), card hover-lift, skeleton loaders, gradient hero.
- **Live charts** (`recharts`): a **payments-over-time** area chart and a
  **properties-by-status** bar chart on the dashboard, and a **paid-vs-remaining
  donut** on each plan — all polled (15s) so they update without a refresh.
- **Installment journey**: a "Buy on installment" panel (deposit slider + term)
  on installment listings → plan detail (schedule, progress, pay buttons) → a
  dev **mock checkout** page that simulates the gateway approval and settles the
  payment, which (via the event) advances the plan in real time.

## Seed

Two requested users added — **daniel@gmail.com** (developer) and
**roro@gmail.com** (buyer) — plus a live 24-month plan for Roro with the first
four months paid and matching ledger rows, so the charts have real data on first
run. Dev password remains `Password123!`.

## Verification

- `nest build` + `tsc` + `vite build` pass; **59 backend unit tests** green
  (incl. plan math, ownership, and the event handler activating/completing a
  plan).
- **Live (mock gateway + Docker Postgres)**: logged in as Roro → saw the seeded
  plan (4/24 paid) → created a new 30%/12-month plan (`pending_deposit`,
  deposit 24,000,000, monthly 4,666,666.66) → paid the deposit → webhook → the
  **plan auto-activated** → paid installment #1 → webhook → **1/12 paid**. The
  web dev proxy served the plans + 7 payments that drive the charts.

## Key files

```
apps/api/src/installments/installments.service.ts   # plan math + @OnEvent handler
apps/api/src/installments/installments.repository.ts # plan + schedule (Decimal)
apps/api/src/payments/payment-events.ts              # payment.succeeded contract
apps/web/src/components/charts.tsx                   # recharts (area/bar/donut)
apps/web/src/components/InstallmentPanel.tsx         # buy-on-installment
apps/web/src/pages/PlanDetailPage.tsx                # schedule + progress + pay
apps/web/src/pages/MockCheckoutPage.tsx              # dev gateway simulation
apps/api/prisma/seed.ts                              # daniel + roro + demo plan
```

## How to run

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev:api && pnpm dev:web
# Log in as roro@gmail.com / Password123!, open the dashboard for the charts,
# or open an installment listing and choose "Buy on installment".
```
