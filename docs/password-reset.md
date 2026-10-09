# Password Reset (Forgot Password)

**Status:** ✅ Done · **Date:** 2026-07-16 · Extends the Stage 2 auth module
([stage-2-auth-module.md](./stage-2-auth-module.md)).

## Goal

Let a locked-out user regain access safely: request a reset link with the email
or phone they registered with, follow the link, choose a new password. The flow
must not leak which accounts exist, must never persist the reset secret, and
must end every live session when the password changes.

## User flow

1. **Login page** → "Forgot password?" → `/forgot-password`: the user enters
   their email or phone.
2. The API always answers success. If the account exists, a reset link is sent
   out-of-band: in development it appears in the API log (look for the
   `[password_reset]` line); in production it goes by SMS once Africa's Talking
   credentials are configured.
3. The link opens `/reset-password?token=…`, where the user sets a new password
   (same rules as registration: 8+ chars, a letter and a number) and is
   redirected to the login page.

## Endpoints (`/api/auth`)

| Method & path | Auth | Purpose |
| ------------- | ---- | ------- |
| `POST /forgot-password` | public | Request a reset link (always 200 — never reveals accounts) |
| `POST /reset-password` | public | Set a new password with a single-use token |

Both share the tight credential throttle (5 req/min/IP), like register/login.

## Security model

- **No account enumeration**: `forgot-password` returns the same `{ success:
  true }` whether or not the identifier matches an account.
- **Token**: 32 random bytes, base64url (URL-safe), minted in `TokenService`.
  Only its **SHA-256 hash** is stored (`password_reset_tokens`); the raw token
  exists solely inside the delivered link. Delivery bypasses the in-app
  notifications table (`NotificationsService.dispatch`) so the secret is never
  written to the database.
- **Lifetime**: 30 minutes, single-use. Requesting a new link retires any
  outstanding ones — only the latest works.
- **On reset** (one transaction): set the new argon2id hash, mark the token
  used, and **revoke every refresh token** for the user — a session stolen
  before the reset dies with it.
- **One generic error** ("invalid or expired") for every failure mode: unknown
  token, already used, expired, or deleted account.

## Configuration

| Env var | Purpose |
| ------- | ------- |
| `PUBLIC_WEB_URL` | Absolute origin of the web app used in reset links. Optional — defaults to the first `CORS_ORIGINS` entry, so dev needs no config. |

## Data model

`password_reset_tokens` (migration `20260716000000_password_reset_tokens`):
`id`, `user_id` (FK, cascade), `token_hash` (unique), `expires_at`, `used_at`,
`created_at`. The migration also adds the `password_reset` value to the
`NotificationType` enum.

## Key files

```
apps/api/src/auth/auth.controller.ts             # the two endpoints
apps/api/src/auth/auth.service.ts                # forgotPassword / resetPassword
apps/api/src/auth/auth.repository.ts             # reset-token data access + atomic consume
apps/api/src/auth/token.service.ts               # mintResetToken / hashToken
apps/api/src/auth/dto/forgot-password.dto.ts     # request DTOs
apps/api/src/auth/dto/reset-password.dto.ts
apps/api/src/notifications/notifications.service.ts  # dispatch() — outbound-only delivery
packages/shared/src/schemas/auth.ts              # forgotPasswordSchema / resetPasswordSchema
apps/web/src/pages/ForgotPasswordPage.tsx        # /forgot-password
apps/web/src/pages/ResetPasswordPage.tsx         # /reset-password?token=…
apps/api/prisma/migrations/20260716000000_password_reset_tokens/
```

## Verification

Type checks pass on api and web; the full API suite is green (148 tests,
including 6 new `AuthService` cases: link issued with only the hash stored,
unknown identifier stays silent, full reset round-trip with session revocation
and single-use enforcement, older link retired by a newer one, garbage token
rejected, expired token rejected).

## How to try it

1. Start the stack (`docker compose up -d`, `pnpm dev`) and open the login
   page → "Forgot password?".
2. Enter a seeded account's phone (e.g. `+256700000003`) and submit.
3. Copy the link from the API console output and open it in the browser.
4. Set a new password — you land on the login page; the old password and all
   previous sessions are dead.
