#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
APP_DIR="${APP_DIR:-/opt/nearhub-server}"
ENV_FILE="${ENV_FILE:-/etc/nearhub/server.env}"
EC2_HOST="${EC2_HOST:-65.2.151.47}"
EC2_USER="${EC2_USER:-admin}"
EC2_PORT="${EC2_PORT:-22}"
EC2_KEY_PATH="${EC2_KEY_PATH:-$ROOT_DIR/nearhub-debian-key-20260524-015812.pem}"
PM2_APP_NAME="${PM2_APP_NAME:-nearhub-server}"
REQUIRE_CLEAN_GIT="${REQUIRE_CLEAN_GIT:-true}"

if [ ! -f "$EC2_KEY_PATH" ]; then
  echo "Missing EC2 key: $EC2_KEY_PATH" >&2
  exit 1
fi

if [ "$REQUIRE_CLEAN_GIT" = "true" ]; then
  if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
    echo "Refusing deploy: working tree has uncommitted changes." >&2
    echo "Please commit/stash changes before running deploy." >&2
    exit 1
  fi
fi

RELEASE_DIR="$(mktemp -d /tmp/nearhub-release.XXXXXX)"
ARCHIVE_PATH="/tmp/nearhub-server-release.tgz"

cleanup() {
  rm -rf "$RELEASE_DIR"
  rm -f "$ARCHIVE_PATH"
}
trap cleanup EXIT

cd "$SERVER_DIR"
npm ci
npm run type-check
npm run build

cp package.json package-lock.json "$RELEASE_DIR/"
cp -R dist migrations scripts "$RELEASE_DIR/"
cp drizzle.config.js "$RELEASE_DIR/"
if [ -d data ]; then
  cp -R data "$RELEASE_DIR/"
fi
{
  echo "mode=manual_ec2_artifact"
  echo "commit_sha=$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "built_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$RELEASE_DIR/DEPLOYMENT_MANIFEST"

tar -C "$RELEASE_DIR" -czf "$ARCHIVE_PATH" .

scp -i "$EC2_KEY_PATH" -P "$EC2_PORT" -o StrictHostKeyChecking=no \
  "$ARCHIVE_PATH" "$EC2_USER@$EC2_HOST:/tmp/server-release.tgz"

ssh -i "$EC2_KEY_PATH" -p "$EC2_PORT" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" <<EOF
set -euo pipefail
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
RELEASE_DIR="$APP_DIR/releases/\$(date +%Y%m%d%H%M%S)"
mkdir -p "\$RELEASE_DIR"
tar -xzf /tmp/server-release.tgz -C "\$RELEASE_DIR"
rm -f /tmp/server-release.tgz
if [ -f "$ENV_FILE" ]; then
  ln -sfn "$ENV_FILE" "\$RELEASE_DIR/.env"
  mkdir -p "\$RELEASE_DIR/server"
  ln -sfn "$ENV_FILE" "\$RELEASE_DIR/server/.env"
else
  echo "Missing required env file: $ENV_FILE" >&2
  exit 1
fi
cd "\$RELEASE_DIR"
npm ci
npm run db:migrate
npm prune --omit=dev
rm -rf "$APP_DIR/current"
ln -sfn "\$RELEASE_DIR" "$APP_DIR/current"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  pm2 start "$APP_DIR/current/dist/index.js" --name "$PM2_APP_NAME" --cwd "$APP_DIR/current" --time
fi
pm2 save
curl -fsS http://127.0.0.1:5000/api/health
EOF
