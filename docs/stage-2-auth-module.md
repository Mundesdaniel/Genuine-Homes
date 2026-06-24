# Stage 2 — Auth Module (JWT + RBAC)

**Status:** ✅ Done · **Commit:** `Stage 2: auth module (JWT + RBAC)`

## Goal

Authentication and authorization for the whole platform: register/login,
session management, and role-based access control that later modules can lean
on by default.

## What was built

Located in `apps/api/src/auth`.

### Endpoints (`/api/auth`)

| Method & path | Auth | Purpose |
| ------------- | ---- | ------- |
| `POST /register` | public | Create an account and start a session |
| `POST /login` | public | Log in with email **or** phone + password |
| `POST /refresh` | public | Exchange a refresh token for a new pair |
| `POST /logout` | bearer | Revoke a refresh token (log out) |
| `GET /me` | bearer | Get the current authenticated user |

### Security model

- **Passwords**: argon2id hashing (`@node-rs/argon2`). Login runs a *decoy*
  verify when the account doesn't exist, so response timing can't be used to
  enumerate users; all credential errors are deliberately generic.
- **Tokens**: a short-lived **access** JWT + a long-lived **refresh** JWT, both
  signed in a dedicated `TokenService` (the only place the secrets are read).
  Each payload carries a `type` (`access`/`refresh`) so the two can never be
  swapped.
- **Refresh rotation + reuse detection**: refresh tokens are stored only as a
  **SHA-256 hash** in `refresh_tokens`. Each refresh revokes the old row and
  issues a new one; replaying an already-rotated token revokes **every** session
  for that user (stolen-token response).
- **RBAC**: a **global `JwtAuthGuard`** means every route is protected unless
  marked `@Public()`, and a **global `RolesGuard`** enforces `@Roles(...)`.
  `@CurrentUser()` injects the authenticated user. `admin` can never be
  self-assigned at registration.
- **Rate limiting**: `@nestjs/throttler` — 100 req/min/IP by default, tightened
  to 5/min on register & login and 10/min on refresh.

### Validation

Shared Zod schemas (`registerSchema`, `loginSchema`) live in
`@genuine-homes/shared`; the API's class-validator DTOs mirror them, keeping API
and (future) web validation in lockstep.

## Key decision

> **Build the JWT guards directly on `@nestjs/jwt`** rather than pulling in
> Passport — fewer dependencies, full control over refresh-token rotation, and
> simpler to unit test. `JwtAuthGuard` is **global with a `@Public()` opt-out**
> so every future endpoint is secure by default (a good fit for a financial
> platform); the health probe is marked `@Public()`.

## Key files

```
apps/api/src/auth/auth.controller.ts        # the 5 endpoints
apps/api/src/auth/auth.service.ts           # register/login/refresh/logout/me
apps/api/src/auth/auth.repository.ts        # users + refresh tokens via Prisma
apps/api/src/auth/token.service.ts          # JWT sign/verify + refresh hashing
apps/api/src/auth/guards/jwt-auth.guard.ts  # global authentication
apps/api/src/auth/guards/roles.guard.ts     # global @Roles enforcement
apps/api/src/auth/decorators/              # @Public, @Roles, @CurrentUser
packages/shared/src/schemas/auth.ts         # shared Zod schemas + types
```

## Verification

`nest build` + type check pass; 16 unit tests green — `AuthService` (register,
duplicate phone, login by phone/email, wrong-password & unknown-user rejection,
refresh rotation, reuse detection, logout), `RolesGuard`, and an `AppModule` DI
smoke test that boots the whole graph with Prisma stubbed (no database needed).

## How to try it

```bash
pnpm db:up && pnpm dev:api    # seeded dev password = Password123!
curl -XPOST localhost:3100/api/auth/login -H 'content-type: application/json' \
     -d '{"emailOrPhone":"+256700000003","password":"Password123!"}'
curl localhost:3100/api/auth/me -H "authorization: Bearer <accessToken>"
```
