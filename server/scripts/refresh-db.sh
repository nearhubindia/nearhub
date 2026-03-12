#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! compgen -G "$ROOT_DIR/migrations/*.sql" > /dev/null; then
  echo "[db:refresh] No SQL migration files found in $ROOT_DIR/migrations"
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-nearhub}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [[ -z "$DB_PASSWORD" && -f "$ROOT_DIR/.env" ]]; then
  DB_LINE="$(grep '^DATABASE_URL=' "$ROOT_DIR/.env" | head -n1 || true)"
  DB_URL="${DB_LINE#DATABASE_URL=}"
  if [[ -n "$DB_URL" ]]; then
    URL_NO_PROTO="${DB_URL#*://}"
    CREDS_PART="${URL_NO_PROTO%@*}"
    HOST_PART="${URL_NO_PROTO##*@}"

    DB_USER="${CREDS_PART%%:*}"
    DB_PASSWORD="${CREDS_PART#*:}"

    DB_HOST="${HOST_PART%%:*}"
    HOST_REST="${HOST_PART#*:}"
    DB_PORT="${HOST_REST%%/*}"
    DB_NAME="${HOST_REST#*/}"
  fi
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo "[db:refresh] DB password is required. Set DB_PASSWORD or valid DATABASE_URL in server/.env"
  exit 1
fi

echo "[db:refresh] Resetting schema on ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

export PGPASSWORD="$DB_PASSWORD"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA drizzle;
CREATE SCHEMA public;
SQL

echo "[db:refresh] Applying migrations with Drizzle..."
npx drizzle-kit migrate --config=drizzle.config.js

echo "[db:refresh] Ensuring default admin settings row..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c 'INSERT INTO admin_settings DEFAULT VALUES;'

echo "[db:refresh] Seeding subscription tiers..."
npx tsx scripts/seed-subscription-tiers.ts

echo "[db:refresh] Done"
