#!/bin/sh
# Migrate-on-deploy: apply pending Prisma migrations, then start the API.
# Set RUN_MIGRATIONS=false to skip (e.g. when a separate job owns migrations).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] prisma migrate deploy"
  ./node_modules/.bin/prisma migrate deploy
fi

exec node dist/main.js
