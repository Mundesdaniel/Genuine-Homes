# Genuine Homes — Security Hardening Plan

Audit date: 2026-07-14 (post Stage 9). Full-codebase review across auth/authz, input
handling & web, infrastructure/config, and payments/webhooks.

**Overall posture: strong.** Verified in this audit and *not* re-planned below:
every controller correctly guarded (role + ownership checks on all `:id` routes — no
IDOR found); JWT rotation with reuse detection; argon2 + constant-time login; global
`ValidationPipe` (whitelist + forbid unknown); parameterized SQL only; timing-safe HMAC
on signed doc URLs and Flutterwave webhooks; server-to-server re-verification before
settling; idempotent settlement (`UPDATE … WHERE status='pending'`); Decimal(14,2)
money columns; pino redaction of auth headers/cookies; non-root containers; CORS
allowlist; httpOnly path-scoped refresh cookie.

The plan is three phases: **P0** blocks production deploy, **P1** is near-term
hardening, **P2** is ongoing process.

---

## P0 — Fix before first production deploy

### P0-1 Trust-proxy configuration (rate limiting is broken behind nginx)
`apps/api/src/main.ts` never sets `trust proxy`. In the prod compose topology every
request reaches the API from the nginx container's IP, so the throttler
(100/min global, 5/min auth) keys **all clients to one bucket** — trivially DoS-able
and the brute-force limit on `/auth/login` protects nothing per-attacker.

- Add `app.set('trust proxy', 1)` (exactly one hop — never `true`, which lets clients
  spoof `X-Forwarded-For`).
- Confirm the throttler and `request-context.ts:35` then see the real client IP.
- Add the missing `proxy_set_header X-Real-IP / X-Forwarded-For / X-Forwarded-Proto`
  to the `/socket.io/` and `/uploads/` blocks in `apps/web/nginx.conf` (only `/api/`
  has them today) so websocket auth failures and document fetches audit the real IP.

### P0-2 Chat gateway accepts any Origin
`apps/api/src/chat/chat.gateway.ts:18` — `cors: { origin: true, credentials: true }`.
Auth uses a handshake token (not cookies), so this isn't account takeover, but any
website can currently open sockets against the gateway (connection-slot exhaustion,
and it becomes serious if cookie/query auth is ever added).
→ Inject config and reuse the same `CORS_ORIGINS` allowlist the HTTP layer uses.

### P0-3 nginx: security headers + body-size limit
`apps/web/nginx.conf` serves the SPA with **no security headers at all**:

- `Content-Security-Policy` for the SPA (start report-only, then enforce; the app is
  Vite-built with no inline scripts, so a tight policy is feasible — allow Sentry DSN
  origin and tile server for Leaflet).
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), a minimal
  `Permissions-Policy`.
- `client_max_body_size 12m;` — explicit, aligned with the API's 10 MB document limit
  (nginx's silent 1 MB default currently 413s larger uploads anyway; make it deliberate).
- HSTS belongs at the TLS terminator — document that in `docs/operations.md` alongside
  the TLS setup (there is no TLS config in-repo yet; the plan assumes a terminating
  proxy or managed LB in front).

### P0-4 Webhook amount/currency strictness
`apps/api/src/payments/payments.service.ts:147` settles when
`verified.amount >= payment.amount` — an over-paid (or gateway-misreported) amount
settles silently with the surplus untracked.

- Require exact match; treat `>` as a mismatch that audit-logs
  (`payment.verification_mismatch`) with an explicit `overpayment` reason so ops can
  refund/reconcile manually. (Already-good: `<`, wrong currency, wrong tx_ref all
  refuse to settle.)
- In `initiate-payment.dto.ts`, make `currency` validated against the referenced
  plan/agreement rather than free-choice of UGX/KES/TZS.

### P0-5 Secrets posture for production
- Set `UPLOADS_SIGNING_SECRET` explicitly in prod (today it derives from
  `JWT_ACCESS_SECRET` when unset — `url-signer.service.ts:21` — which couples doc-URL
  validity to JWT secret rotation). Consider warning at boot in production when unset.
- Add a `NODE_ENV === 'production'` refusal at the top of `apps/api/prisma/seed.ts`
  (it creates users with the shared dev password `Password123!`).

---

## Admin identity & session hardening (added 2026-07-14)

Admins currently authenticate exactly like ordinary users: password only, same
30-day refresh session, role read from the JWT payload (`jwt-auth.guard.ts:49`).
For a platform moving real money, admin accounts are the highest-value target —
one phished admin password today yields a month-long session that can default
plans, change roles, and read every audit log. In rough priority order:

### A-1 Mandatory TOTP for admin accounts — **treat as P0 for real-money launch**
- Schema: `mfaSecret` (encrypted at rest) + `mfaEnabledAt` on `User`; hashed
  single-use recovery codes.
- Flow: login returns a short-lived `mfa_pending` token instead of the real pair
  when the account has MFA; `POST /auth/mfa/verify` (throttled like login) exchanges
  it + a valid TOTP code for the normal token pair.
- Enforcement: refuse to *issue* admin-role tokens for accounts without enrolled MFA
  (grace flag for initial rollout). Optionally offer opt-in TOTP to sellers/agents
  later; the mechanism is the same.
- WebAuthn/passkeys are the better long-term answer; TOTP first because it needs no
  new client platform work.

### A-2 Step-up re-auth for destructive admin actions
`POST /admin/installment-plans/:id/default`, `…/reinstate`, and role changes should
require *fresh* authentication, not just a live session: include an `auth_time` claim
in the access token and add a `@FreshAuth(maxAgeMinutes)` guard that 403s with a
distinct code the web app answers by prompting for password/TOTP again.

### A-3 Shorter admin sessions
30-day refresh is fine for buyers, not for admins. Issue role-dependent refresh TTLs
(e.g. 12–24 h for `ADMIN`). Access token stays 15 min. Note the existing (acceptable)
window: role comes from the JWT, so a demoted admin keeps admin power for up to
15 min — refresh re-reads the user, so it self-heals; document it, or add a
denylist check for high-value routes if that window ever matters.

### A-4 Admin-role grants: two-person rule or loud alerting
Self-role-change is already blocked and grants are audit-logged (good), but a single
compromised admin can still mint more admins. Minimum: real-time alert (Sentry/SMS)
on any `user.role_changed` where the new role is `admin`. Better: pending-approval
flow requiring a second admin to confirm.

### A-5 Production admin bootstrap
The only admin today comes from the dev seed (shared password). Add a one-time CLI
(`pnpm admin:create`) that creates the first admin with a generated password +
forced MFA enrollment on first login, and document it in `docs/operations.md`.
Admins should be dedicated accounts, not someone's buyer/seller login.

### A-6 Network-level belt-and-braces (optional)
If admin staff are few and static: restrict `/api/admin/*` and `/api/users` (admin
verbs) to a VPN/IP allowlist at nginx. Cheap, and it turns a credential leak into a
non-event.

### A-7 National ID (NIN) identity verification for admins — ✅ Phase 1 SHIPPED (2026-07-14)
_Implemented for seller roles (landlord/agent/developer) as the first mandatory
cohort: `identity` module (submit → admin four-eyes review → approval stamps
`user.identityVerifiedAt`), publication gate in `PropertiesService`
(unverified sellers cannot set a property `active`; drafting stays open),
masked+HMAC-hashed NIN storage (raw NIN never persisted — verified against the
live DB), duplicate-NIN blocking, audit logging, notifications, seller web page
(`/identity`) + admin queue on the admin page. Registry integration (phase 2)
and gating *admin role activation* on it remain open._
MFA proves *possession of a device*; it does not prove *who the admin is*. For a
platform whose brand is anti-fraud and which will move real money, every admin
account should be bound to a verified natural person via their Ugandan National ID
(NIN, issued by NIRA) before the role is granted.

**Important scoping note:** the NIN is identity *proofing*, not an authentication
factor. It is quasi-public data — never use it as a login secret or a recovery
credential. It answers "who is this admin", MFA (A-1) answers "is it really them
logging in".

- **Flow (ties into A-5 bootstrap):** admin enrollment collects legal name + NIN +
  photos of the ID card + a selfie; the role is only activatable once
  `identityVerifiedAt` is set. Re-run on any re-grant after revocation.
- **Verification back-end, two phases:**
  1. *Manual now:* reuse the existing verifications-module pattern — documents go
     through the private-uploads store (signed 15-min URLs, already built), a
     *second* admin reviews and approves (four-eyes; an admin never approves their
     own identity), decision audit-logged.
  2. *Registry later:* integrate a NIRA-accredited verification provider (NIRA's
     third-party verification service directly, or a KYC vendor covering Uganda —
     e.g. Smile ID / YouVerify class; evaluate cost, uptime, and accreditation
     status at build time) to match NIN + name + DOB against the registry and add
     selfie liveness. Store the provider's reference, not their raw response.
- **Schema sketch:** `identity_verifications` table — `userId`, `ninMasked` (last 4
  only), `ninHash` (HMAC with a dedicated secret, for dedup without storing the
  number), `documentKeys[]`, `provider`, `providerRef`, `status`, `verifiedAt`,
  `reviewedById`.
- **Data protection (Uganda Data Protection and Privacy Act, 2019):** NIN + ID
  images are sensitive PII. Consent + purpose statement at collection; store the
  full NIN only if a registry check genuinely needs it (prefer hash + mask);
  column-level encryption if stored; access to the documents audit-logged (signed
  URL minting already is); retention policy (delete ID images after verification
  decision + statutory period); register the processing purpose with the PDPO
  before launch.
- **Natural extension (product, not just security):** the same rail gives
  person-level KYC for sellers/agents — a "verified person" badge to complement the
  existing property verification, which is squarely the platform's anti-fraud
  mission. Build the table/flow user-generic from day one; admins are simply the
  first mandatory cohort.

### A-8 Role matrix: who gets verified, with what, gated where
Same rail (A-7 table + flows), different policy per role. Landlord/agent/developer
are **self-assignable at registration today** (`SELF_ASSIGNABLE_ROLES`,
`packages/shared/src/schemas/auth.ts:19-23`) with zero vetting — keep signup
friction-free, but gate the *high-trust actions*, not the account.

| Role | Identity check | Extra documents | Enforcement point |
|---|---|---|---|
| **Admin** | NIN, mandatory | — | Role is inert until verified (blocks token issuance with admin role) |
| **Landlord** | NIN, mandatory | Ownership/title docs (already part of property verification) | Listing cannot go **live** (or receive payments) until the person is verified — registration and drafting stay open |
| **Agent** | NIN, mandatory | Optional: professional accreditation (e.g. AREA membership) as an extra badge, not a gate | Same as landlord: gate listing publication |
| **Developer** | **KYB, not just KYC** — verify the company: URSB certificate of incorporation + TIN, plus the NIN of the authorized representative/director | Company docs via the same private-uploads store | Gate listing publication; badge shows the company name, rep verified behind the scenes |
| **User (buyer/tenant)** | None at signup | — | Require NIN verification only when entering a **rental agreement or installment plan** (real money + enforceable contract; also the AML-sensible point) |

Notes:
- Developer ≈ company means one verified rep can act for one org; model an
  `organizationId` on the verification row rather than pretending a company has a
  NIN.
- The enforcement points matter more than the checks: verifying at *publication /
  money-movement* keeps the funnel open while ensuring no unverified person can
  actually transact — which is the fraud surface that matters.
- Re-verification: on role change, on verification revocation (fraud finding), and
  consider expiry (e.g. re-confirm rep for developers annually).

---

## P1 — Near-term hardening

### P1-1 Upload abuse limits
`uploads.controller.ts` endpoints ride the global 100/min throttle only. Add a tight
`@Throttle` (e.g. 10/min) on both upload routes, and consider a per-user storage
quota — cheap DoS on disk otherwise.

### P1-2 Staging webhook forgery (mock gateway)
`mock.gateway.ts` `verifySignature()` returns `true` — anyone who can reach a
staging/dev deployment running `PAYMENT_GATEWAY=mock` can settle arbitrary payments
with one curl. Production refuses the mock (good). Fix: require an
`X-Mock-Signature: <MOCK_WEBHOOK_SECRET>` header even in mock mode.

### P1-3 Money math in mappers
`apps/api/src/common/mappers.ts:226-234` sums installment amounts as JS floats for
`paidAmount`/`remainingAmount`. Storage is Decimal (correct); do the summation in
Decimal too before converting for display, so totals reconcile exactly.

### P1-4 Database-level financial invariants
Belt-and-braces constraints via a migration:
- `CHECK (amount > 0)` on `payments` (and installment amounts).
- Unique index on `installment_payments.payment_ref` so one payment can never mark
  two installments paid.
- Make `audit_logs` append-only in the DB itself:
  `REVOKE UPDATE, DELETE ON audit_logs FROM <app role>` (today "append-only" is
  convention in the service layer only).

### P1-5 Webhook forensics
On rejected webhooks (`payment.webhook_rejected`, `payment.verification_mismatch`),
record source IP + user-agent in the audit metadata, and add a modest per-IP throttle
on `POST /payments/webhook` (Flutterwave retries are low-volume; 60/min is plenty).

### P1-6 Account enumeration on register
`auth.service.ts:38-43` returns 409 for an existing email/phone (login is already
enumeration-safe). Real tradeoff with UX — a common resolution is to keep the 409 but
rate-limit register tightly (already 5/min) and add CAPTCHA later if abuse appears.
Decide and document; don't leave it implicit.

### P1-7 Missing account-lifecycle flows (build securely when added)
There is **no password reset and no enforced email/phone verification**. These are
product gaps, but each is a classic security hole when bolted on quickly. When built:
single-use tokens, hashed at rest, 15-min expiry, no account-existence leak in
responses, and notification to the old address on change.

### P1-8 Small fixes
- `chat.gateway`/`auth.service.ts:25`: `await` the decoy hash at module init
  (`onModuleInit`) so the first-ever login can't short-circuit the constant-time path.
- `uploads.controller.ts:146`: build `Content-Disposition` with
  `filename*=UTF-8''${encodeURIComponent(key)}` — the key regex already prevents
  injection; this is defense-in-depth.
- Log refresh-token reuse detection at `error` (it's a theft signal), and page on it
  once alerting exists.
- Make Express body limits explicit (`json({ limit: '100kb' })`) rather than default.
- Assess `ownerId` in public `PropertySummary` (`packages/shared/src/schemas/property.ts:74`):
  it's needed for contact-seller/chat, and UUIDs are low-risk — either accept
  explicitly or replace with an opaque contact route.

---

## P2 — Process & ongoing

1. **Dependency hygiene in CI** (`.github/workflows/ci.yml`): add `pnpm audit --prod`
   (non-blocking at first), enable Dependabot/Renovate once the repo has a remote,
   pin third-party actions to SHAs.
2. **Secret scanning**: gitleaks (or GitHub secret scanning) in CI — the `.env`
   incident was a near-miss; make it structural.
3. **Static analysis**: CodeQL / `eslint-plugin-security` pass in CI.
4. **API container healthcheck** in `docker-compose.prod.yml` (curl `/api/health`),
   so web waits on a live API.
5. **Security regression tests** (folds into REMAINING_WORK section D): e2e tests for
   the highest-value invariants — webhook with bad signature is rejected, tampered
   signed URL 403s, user B cannot read user A's payment/plan/thread, refresh reuse
   revokes the session family. These lock in what the audit verified by hand.
6. **Alerting**: Sentry is wired; add alert rules for spikes in
   `payment.webhook_rejected`, `payment.verification_mismatch`, and refresh-reuse
   events.
7. **Ops**: TLS termination + HSTS documented and tested; encrypt/off-site the
   nightly `pg_dump`s (they contain PII + financial data — currently plaintext on
   local disk, `scripts/backup-db.sh`); keep the quarterly restore drill.
8. **Pre-launch**: one external (or at least fresh-eyes) pen test focused on the
   payment path and document storage before real money flows.

---

## Explicitly assessed and NOT planned (false alarms)

- **CSRF on payment/rental POSTs** — auth is Bearer-header-only on those routes;
  browsers never attach it cross-site. The refresh cookie is path-scoped to
  `/api/auth` with SameSite=Lax. No CSRF token needed today. (Revisit if any
  state-changing route ever authenticates via cookie.)
- **JSON body DoS** — Express default limit is 100 KB; multer enforces file caps.
  P1-8 just makes it explicit.
- **Signed-URL key path traversal** — `KEY_PATTERN` restricts keys to
  UUID-dot-extension; no `..` possible.
- **Swagger in production** — already disabled by `NODE_ENV` check (`main.ts:75`).
