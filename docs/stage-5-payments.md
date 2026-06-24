# Stage 5 — Payments Module

**Status:** ✅ Done · **Commit:** `Stage 5: payments module (gateway strategy + ledger + webhooks)`

## Goal

The first stage where money moves: let users pay (deposits, rent, etc.) through
a payment gateway, and record every movement in the unified ledger — safely and
idempotently.

## What was built

Located in `apps/api/src/payments`, following Controller → Service → Repository.

### Endpoints (`/api/payments`)

| Method & path | Auth | Purpose |
| ------------- | ---- | ------- |
| `POST /initiate` | bearer | Create a pending payment + get a checkout URL |
| `GET /mine` | bearer | List your payments (paginated) |
| `GET /:id` | bearer (owner/admin) | One payment's status |
| `POST /webhook` | gateway signature | Settle a payment (idempotent) |

### Gateway Strategy

A `PaymentGateway` interface with two implementations, selected at startup:

- **`FlutterwaveGateway`** — used when `FLUTTERWAVE_SECRET_KEY` is set. Starts a
  Flutterwave hosted checkout, verifies the webhook `verif-hash` header
  (timing-safe), and normalises the callback.
- **`MockGateway`** — used when no key is configured. Returns a fake checkout URL
  and accepts a simple `{ tx_ref, status }` webhook, so the **whole flow works
  end-to-end locally without real credentials**.

### Idempotency (the important bit)

- Each payment's own id is used as the gateway `tx_ref`.
- The webhook only ever transitions a **still-`pending`** payment
  (`updateMany where status = 'pending'`), so a **duplicate or out-of-order
  webhook is a no-op**.
- The unique `provider_ref` column (from Stage 1) is the second line of defence
  against recording the same gateway transaction twice.

## Key decisions

> **Strategy pattern for the gateway** (per the architecture doc). Swapping
> Flutterwave for another provider — or running the mock in dev/CI — is just a
> different implementation behind one interface, chosen by a factory provider.

> **Mock gateway as the default** when unconfigured. Stage 5 is fully usable and
> testable without Flutterwave sandbox keys; dropping a key in flips it to the
> real gateway with no code change.

> **A settlement hook, not yet wired.** `onPaymentSucceeded()` is the single
> place Stage 6 (installment engine) and rentals will react to a successful
> payment — kept as an explicit extension point for now.

## Key files

```
apps/api/src/payments/payments.controller.ts          # initiate / mine / :id / webhook
apps/api/src/payments/payments.service.ts             # initiate + idempotent webhook
apps/api/src/payments/payments.repository.ts          # ledger writes; settle()
apps/api/src/payments/gateway/payment-gateway.interface.ts
apps/api/src/payments/gateway/flutterwave.gateway.ts  # real gateway + verif-hash
apps/api/src/payments/gateway/mock.gateway.ts         # dev/test gateway
packages/shared/src/schemas/payment.ts                # shared schema + types
```

## Verification

- `nest build` + type check pass; **51 unit tests** green (incl. payments
  service: initiate, gateway-failure handling, webhook signature rejection,
  settlement, **idempotent duplicate**, ownership; and Flutterwave
  signature/parse units).
- **Live, end-to-end (mock gateway, Docker Postgres)**: tenant login → initiate
  a 16,000,000 UGX deposit (got a pending row + mock checkout URL) → webhook
  settled it **successful** (`providerRef` recorded) → a **duplicate webhook
  saying "failed" was ignored** (status stayed successful) → `GET /:id` without
  a token returned **401** → `mine` listed it.

## How to try it

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev:api
TOKEN=...   # from POST /api/auth/login  (+256700000003 / Password123!)
# Start a payment (mock gateway returns a fake checkout URL):
curl -XPOST localhost:3100/api/payments/initiate -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"purpose":"deposit","amount":16000000,"provider":"mtn_momo"}'
# Simulate the gateway callback (use the returned payment id as tx_ref):
curl -XPOST localhost:3100/api/payments/webhook -H 'content-type: application/json' \
  -d '{"tx_ref":"<paymentId>","status":"successful","id":"demo-1"}'
```

To use real Flutterwave, set `FLUTTERWAVE_SECRET_KEY` and
`FLUTTERWAVE_WEBHOOK_HASH` in `apps/api/.env`.
