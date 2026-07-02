# Operations runbook

Deployment, migrations, backup/restore and observability for Genuine Homes.

## Deploying

### Docker (single host)

```bash
cp .env.production.example .env.production   # fill in real secrets
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

- Only the **web** container (nginx) is exposed; it serves the SPA and
  reverse-proxies `/api`, `/socket.io` and `/uploads` to the API container.
- The API container **applies pending Prisma migrations on start**
  (`prisma migrate deploy` in `apps/api/docker-entrypoint.sh`). Set
  `RUN_MIGRATIONS=false` on the service if a separate release job owns
  migrations (recommended once there is more than one API replica — two
  replicas racing `migrate deploy` is safe but noisy; one owner is cleaner).
- Production env validation fails fast: missing JWT secrets, or a mock
  payment gateway that wasn't explicitly chosen, stop the container at boot.

### Migrations

- **Never** run `prisma migrate dev` against production — it can reset data.
  Deploys use `prisma migrate deploy` only (applies committed migrations,
  no schema diffing).
- New migrations are validated in CI against a fresh PostGIS container
  (migrate deploy + seed) before they can merge.
- Roll-forward only: to undo a bad migration, write a new migration that
  reverses it. Restore from backup only for data corruption.

## Backups

### What to back up

| Data                                 | Where                    | How                                                                                |
| ------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------- |
| PostgreSQL (everything that matters) | `postgres` volume        | `pg_dump` (below)                                                                  |
| Uploaded files (local-storage mode)  | `gh_prod_uploads` volume | file copy / rsync                                                                  |
| Redis                                | `gh_prod_redisdata`      | _not_ backed up — queue jobs are transient; reminders re-emit on the nightly sweep |

### Nightly dump

```bash
# scripts/backup-db.sh — run from cron on the host, e.g.:
#   0 3 * * * /path/to/repo/scripts/backup-db.sh /var/backups/genuine-homes
./scripts/backup-db.sh /var/backups/genuine-homes
```

The script writes a compressed custom-format dump
(`genuine_homes-YYYYMMDD-HHMMSS.dump`), prunes dumps older than 14 days, and
exits non-zero on failure (wire the cron job to your alerting). Ship the dump
directory offsite (object storage, e.g. S3/GCS with lifecycle rules) — a
backup on the same disk as the database is not a backup.

### Restore

```bash
# 1. Stop the API so nothing writes during restore
docker compose -f docker-compose.prod.yml stop api

# 2. Restore (drops + recreates objects in the target DB)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U genuine -d genuine_homes --clean --if-exists --no-owner \
  < /var/backups/genuine-homes/genuine_homes-<timestamp>.dump

# 3. Start the API (entrypoint re-applies any migrations newer than the dump)
docker compose -f docker-compose.prod.yml start api
```

**Drill this quarterly**: restore the latest dump into a scratch database and
run the API's smoke checks against it. An untested backup is a hope, not a
strategy.

### Point-in-time recovery

`pg_dump` gives you "as of last night". If the business can't lose a day of
payment records (it can't, eventually), move to a managed Postgres with WAL
archiving/PITR (Cloud SQL, RDS, Neon) or add `wal-g` to the self-hosted setup.
Tracked as future work.

## Observability

- **Structured logs**: pino JSON on stdout, one line per request with an
  `X-Request-Id` correlation id (echoed on every response, accepted from
  upstream proxies). `docker logs` or any log shipper picks them up.
  `LOG_LEVEL` tunes verbosity.
- **Sentry**: set `SENTRY_DSN` (API) / `VITE_SENTRY_DSN` (web, build-time).
  Unhandled exceptions, 5xx responses and notification-queue delivery
  failures are captured with the request id attached. No DSN → disabled, zero
  overhead.
- **Audit trail**: `GET /api/admin/audit-logs` (admin) — payment events, admin
  actions, rejected webhooks. Append-only table `audit_logs`.
- **Health**: `GET /api/health` — liveness (used by the CI smoke and suitable
  for uptime monitors, e.g. UptimeRobot / Better Stack pointing at
  `https://<host>/api/health`).

## Payment incident quick-reference

1. Find the payment: `GET /api/payments/:id` (admin) or the ledger table.
2. Trace it: filter logs by the `requestId` from the audit row; audit actions
   `payment.initiated → payment.settled` (or `payment.verification_mismatch` /
   `payment.webhook_rejected` — investigate those as potential fraud).
3. A webhook Flutterwave says it sent but we never settled: re-send it from
   the Flutterwave dashboard — settlement is idempotent, replays are safe.
