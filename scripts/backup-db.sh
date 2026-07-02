#!/bin/sh
# Nightly PostgreSQL backup for the docker-compose.prod.yml stack.
#
# Usage:  ./scripts/backup-db.sh [BACKUP_DIR]
# Cron:   0 3 * * * /path/to/repo/scripts/backup-db.sh /var/backups/genuine-homes
#
# Writes a compressed custom-format dump and prunes dumps older than
# $RETENTION_DAYS (default 14). Exits non-zero on failure — alert on that.
set -eu

BACKUP_DIR="${1:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_USER="${POSTGRES_USER:-genuine}"
DB_NAME="${POSTGRES_DB:-genuine_homes}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/${DB_NAME}-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[backup] dumping $DB_NAME -> $OUT"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --compress=9 > "$OUT"

# A zero-byte dump means something went wrong even if pg_dump exited 0.
[ -s "$OUT" ] || { echo "[backup] ERROR: dump is empty" >&2; rm -f "$OUT"; exit 1; }

echo "[backup] pruning dumps older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "${DB_NAME}-*.dump" -mtime "+$RETENTION_DAYS" -delete

echo "[backup] done: $(du -h "$OUT" | cut -f1) $OUT"
