# Genuine Homes — Remaining Work

Senior-dev review of what's missing, grouped by category. Severity: 🔴 critical · 🟠 important · 🟡 nice-to-have.

> **Status:** Section **A (Features)** was implemented on `master` (commits
> `0b0d1a1`…`7b0ae2f`, "Stage 7: …") and is checked off below. Sections **B–E**
> are the outstanding work.

---

## A. Features not built — ✅ DONE (Stage 7 commits)

Roadmap-deferred (expected — README says Stage 7+):

- [x] 🟠 **Verification module** — anti-fraud "verified badge". _Done: submit/review workflow + admin approval + owner notification (`6ca27e0`)._
- [x] 🟠 **Chat / messaging** — _Done: Socket.IO gateway (JWT handshake auth) + REST send + `/messages` UI; "Contact seller" wired (`7b0ae2f`)._
- [ ] 🟡 **Mobile app (React Native)** — not started; fine for now. **(still outstanding)**

Gaps inside "completed" scope:

- [x] 🔴 **Notifications module** — _Done: event listeners (payment success/fail, due-soon, overdue) write in-app notifications + pluggable senders (log now, Africa's Talking SMS when configured); nightly reminder sweep (`c9227d2`)._ FCM push is still a stub sender.
- [x] 🟠 **Rentals module** — _Done: agreement from rent listing, pay-rent via ledger, auto-activate on settle (`68b6058`)._
- [x] 🟠 **Admin panel + users module** — _Done: `/admin/overview` analytics + role-gated web page (queue, users); users profile + admin role/verify (`b1b2345`, `c30d632`)._
- [x] 🟠 **Favorites, reviews/ratings** — _Done (`0b0d1a1`, `2d4675f`)._ **Saved-search alerts & viewing scheduling still outstanding** (need new schema tables).
- [x] 🟡 **Payment history / receipts page** — _Done: ledger table + printable receipts (`7787896`)._
- [x] 🟡 **i18n** — _Done: react-i18next scaffolding; English complete, Swahili/Luganda partial w/ English fallback (`cb909c1`). Strings need native-speaker review._

**Still open in A:** mobile app · saved-search alerts · viewing scheduling · FCM push sender · full sw/lg translations.

---

## B. Correctness gaps in built modules

_(These matter most because they're in "done" code.)_

- [ ] 🔴 **No real end-to-end payment.** _Code-ready; the sandbox run itself still needs credentials._ Done so far: explicit `PAYMENT_GATEWAY` selection (production **refuses to boot** on the mock unless `PAYMENT_GATEWAY=mock` is set deliberately); successful webhooks are now **re-verified server-to-server** (`GET /v3/transactions/:id/verify` — status/tx_ref/currency/amount checked against the ledger before settling, mismatches audit-logged, never settled); runbook + scripted checker in `docs/payments-sandbox-runbook.md` and `scripts/payment-sandbox-smoke.mjs`. **Remaining:** obtain `FLWSECK_TEST-…` keys, run the runbook once, tick its checklist and record the transaction id here.
- [x] 🔴 **No scheduled jobs** → _partially addressed in A:_ a nightly `@nestjs/schedule` sweep now marks overdue installments `late` and emits due-soon/overdue reminders (`c9227d2`).
- [x] 🔴 **`defaulted` plan state is never reached.** — _Done. Policy:_ an installment `late` ≥ 30 days past due (`INSTALLMENT.DEFAULT_GRACE_DAYS`) escalates to `missed` in the nightly sweep; a plan with ≥ 3 missed installments (`DEFAULT_MISSED_THRESHOLD`) becomes **default-eligible** and surfaces in `GET /admin/installment-plans/default-eligible`. The transition itself stays an explicit, audited admin action: `POST /admin/installment-plans/:id/default` (reason required, buyer notified) with `POST …/:id/reinstate` to reverse after a negotiated recovery. Money already paid stays in the ledger; refund/forfeiture follows the signed agreement outside the state machine.
- [x] 🟠 **Redis configured but unused** — _Done:_ notification fan-out now runs through a durable **BullMQ** queue on Redis (5 attempts, 30s exponential backoff, worker in-process). `NOTIFICATIONS_QUEUE=inline` opts out; tests run inline automatically; a Redis outage degrades to inline delivery (bounded 3s wait) instead of losing reminders. (Response caching remains future work.)
- [x] 🟠 **No global exception filter / request logging / correlation IDs** — _Done:_ catch-all exception filter (500s never leak internals, every error response carries a `requestId`), pino structured request logging (`nestjs-pino`) with `X-Request-Id` correlation via AsyncLocalStorage, and an append-only **audit log** (`audit_logs` table + global `AuditService` + `GET /admin/audit-logs`) recording payment initiations/settlements, rejected webhooks, admin user updates and verification reviews.

---

## C. Production / DevOps (essentially absent — ~35% ready)

- [x] 🔴 **No CI/CD.** — _Done:_ `.github/workflows/ci.yml` — pnpm install → prisma generate → build → lint (tsc + eslint) → **`prisma migrate deploy` + seed against a real PostGIS service container** → tests (Redis service available for the queue), on every push/PR. _Note: repo has no GitHub remote yet — the pipeline runs on first push._
- [ ] 🔴 **No Dockerfiles.** `docker-compose.yml` is dev-only (Postgres+Redis). Add API + web Dockerfiles, a prod compose / Cloud Run / K8s manifest, and IaC.
- [x] 🟠 **No ESLint / Prettier / pre-commit hooks.** — _Done:_ workspace-wide flat-config ESLint (`eslint.config.mjs`: JS + typescript-eslint recommended, react-hooks for web, prettier-compat) with all findings fixed; Prettier (`.prettierrc.json`); husky pre-commit running lint-staged (eslint --fix + prettier on staged files). Root `pnpm lint` = per-package `tsc --noEmit` **+** `eslint .`.
- [ ] 🟠 **No observability** — no Sentry, no structured logging (pino/winston), no metrics/uptime. Spec calls Sentry "non-negotiable for catching payment failures."
- [ ] 🟠 **No backup/restore strategy** documented, and no migrate-on-deploy step.

---

## D. Quality & testing

- [ ] 🔴 **Zero frontend tests** — no Vitest/Testing Library, no Playwright/Cypress. (web `lint` is type-check only.)
- [ ] 🟠 **Backend tests are unit-only** (fake repos). No e2e tests, no controller tests, nothing exercising real Prisma or the payment webhook path against a DB.
      _Note: unit coverage grew to 16 suites / 101 tests across Stage 7, but it's still all unit-level._
- [ ] 🟡 **Frontend forms use raw `useState`**, not React Hook Form as specced (Zod is shared and used — good). Minor, but inconsistent with the blueprint.
- [ ] 🟡 **No image lazy-loading / optimization** — every `<img>` loads eagerly. Plan prioritizes low-data performance for the Ugandan market.
- [ ] 🟡 **No React error boundary**; Leaflet/OSM used instead of Mapbox/Google (fine, arguably better — just diverges from the doc).

---

## E. Security & compliance

- [ ] 🔴 **`apps/api/.env` is committed to git** (dev placeholder secrets). Gitignored going forward, but the tracked file must be removed (`git rm --cached apps/api/.env`) before any real secret lands.
- [ ] 🟠 **Uploaded files served publicly** at `/uploads/<uuid>` with no auth or expiry. Spec requires **private storage with signed, expiring URLs** for sensitive docs (land titles, IDs) — a real trust/legal issue.
- [ ] 🟠 **Refresh tokens in `localStorage`** (XSS-exposed). Move to an httpOnly refresh-token cookie for production.
- [x] ✅ **Genuinely solid:** helmet, CORS allowlist, rate limiting (tight on auth), argon2 hashing, env validation at boot, parameterized Prisma queries, constant-time login.

---

## Suggested order to tackle B–E

**Before payments can be called "done":**

1. Prove one real Flutterwave **sandbox** round-trip (B).
2. Define + implement the **`defaulted`** policy (B).
3. Remove `.env` from git history; move uploads to **private + signed URLs** (E).

**Before any deploy:** 4. CI pipeline (build/test/lint) + Dockerfiles + Sentry + structured logging (C). 5. ESLint/Prettier + a smoke-level **e2e test on the payment path** (C, D).

**Then:** audit log + Redis/BullMQ queue (B), frontend tests + image lazy-loading (D), httpOnly cookie + saved-search/viewing features (A/E).
