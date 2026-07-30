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
REQUIRE_CLEAN_GIT="${REQUIRE_CLEAN_GIT:-true}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-nearhub}"
COMPOSE_FILE_NAME="${COMPOSE_FILE_NAME:-docker-compose.prod.yml}"
DOCKERFILE_NAME="${DOCKERFILE_NAME:-Dockerfile.prod}"
SYSTEMD_UNIT_NAME="${SYSTEMD_UNIT_NAME:-nearhub-stack.service}"
DISK_CLEANUP_SERVICE_NAME="${DISK_CLEANUP_SERVICE_NAME:-nearhub-disk-cleanup.service}"
DISK_CLEANUP_TIMER_NAME="${DISK_CLEANUP_TIMER_NAME:-nearhub-disk-cleanup.timer}"

load_env_file() {
  local file_path="$1"

  if [ ! -f "$file_path" ]; then
    return 0
  fi

  while IFS= read -r raw_line || [ -n "$raw_line" ]; do
    local line="${raw_line#"${raw_line%%[![:space:]]*}"}"

    if [ -z "$line" ] || [ "${line#\#}" != "$line" ]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    if [ "$key" = "$line" ] || [ -z "$key" ]; then
      continue
    fi

    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if [ "${value#\"}" != "$value" ] && [ "${value%\"}" != "$value" ]; then
      value="${value#\"}"
      value="${value%\"}"
    elif [ "${value#\'}" != "$value" ] && [ "${value%\'}" != "$value" ]; then
      value="${value#\'}"
      value="${value%\'}"
    fi

    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$file_path"
}

hydrate_deploy_env() {
  load_env_file "$ROOT_DIR/server/.env.deploy"
  load_env_file "$ROOT_DIR/server/.env.deploy.local"
  load_env_file "$ROOT_DIR/.env"
  load_env_file "$ROOT_DIR/.env.local"
  load_env_file "$ROOT_DIR/server/.env"
  load_env_file "$ROOT_DIR/server/.env.local"
}

if [ "$REQUIRE_CLEAN_GIT" = "true" ]; then
  if [ -n "$(git -C "$ROOT_DIR" status --porcelain)" ]; then
    echo "Refusing deploy: working tree has uncommitted changes." >&2
    echo "Please commit/stash changes before running deploy." >&2
    exit 1
  fi
fi

hydrate_deploy_env

if [ ! -f "$EC2_KEY_PATH" ]; then
  echo "Missing EC2 key: $EC2_KEY_PATH" >&2
  exit 1
fi

RELEASE_DIR="$(mktemp -d /tmp/nearhub-release.XXXXXX)"
BUILD_DIR="$(mktemp -d /tmp/nearhub-server-build.XXXXXX)"
ARCHIVE_PATH="/tmp/nearhub-server-release.tgz"

cleanup() {
  rm -rf "$RELEASE_DIR"
  rm -rf "$BUILD_DIR"
  rm -f "$ARCHIVE_PATH"
}
trap cleanup EXIT

tar -C "$SERVER_DIR" \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=coverage \
  -cf - . | tar -C "$BUILD_DIR" -xf -

cp "$ROOT_DIR/$DOCKERFILE_NAME" "$BUILD_DIR/"
cp "$ROOT_DIR/$COMPOSE_FILE_NAME" "$BUILD_DIR/"
cp "$ROOT_DIR/ops/systemd/$SYSTEMD_UNIT_NAME" "$BUILD_DIR/"
cp "$ROOT_DIR/ops/systemd/$DISK_CLEANUP_SERVICE_NAME" "$BUILD_DIR/"
cp "$ROOT_DIR/ops/systemd/$DISK_CLEANUP_TIMER_NAME" "$BUILD_DIR/"

cd "$BUILD_DIR"
npm ci
npm run type-check
npm run build

cp package.json package-lock.json "$RELEASE_DIR/"
cp -R dist migrations scripts "$RELEASE_DIR/"
cp drizzle.config.js "$RELEASE_DIR/"
cp "$DOCKERFILE_NAME" "$RELEASE_DIR/"
cp "$COMPOSE_FILE_NAME" "$RELEASE_DIR/"
cp "$SYSTEMD_UNIT_NAME" "$RELEASE_DIR/"
cp "$DISK_CLEANUP_SERVICE_NAME" "$RELEASE_DIR/"
cp "$DISK_CLEANUP_TIMER_NAME" "$RELEASE_DIR/"
if [ -d data ]; then
  cp -R data "$RELEASE_DIR/"
fi
{
  echo "mode=manual_ec2_docker"
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
else
  echo "Missing required env file: $ENV_FILE" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Missing Docker on EC2 host" >&2
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "Docker Compose is not available on EC2 host" >&2
  exit 1
fi

if [ ! -f "\$RELEASE_DIR/$COMPOSE_FILE_NAME" ] || [ ! -f "\$RELEASE_DIR/$DOCKERFILE_NAME" ]; then
  echo "Production Docker files are missing from the release artifact" >&2
  exit 1
fi

export GIT_COMMIT="\$(sed -n 's/^commit_sha=//p' "\$RELEASE_DIR/DEPLOYMENT_MANIFEST")"
export BUILD_TIME="\$(sed -n 's/^built_at_utc=//p' "\$RELEASE_DIR/DEPLOYMENT_MANIFEST")"
if [ ! -f "\$RELEASE_DIR/$SYSTEMD_UNIT_NAME" ]; then
  echo "Systemd unit is missing from the release artifact" >&2
  exit 1
fi
if [ ! -f "\$RELEASE_DIR/$DISK_CLEANUP_SERVICE_NAME" ] || [ ! -f "\$RELEASE_DIR/$DISK_CLEANUP_TIMER_NAME" ]; then
  echo "Disk cleanup systemd units are missing from the release artifact" >&2
  exit 1
fi

sudo docker-compose -p "$COMPOSE_PROJECT_NAME" -f "\$RELEASE_DIR/$COMPOSE_FILE_NAME" build server
sudo docker-compose -p "$COMPOSE_PROJECT_NAME" -f "\$RELEASE_DIR/$COMPOSE_FILE_NAME" up -d redis
sudo docker-compose -p "$COMPOSE_PROJECT_NAME" -f "\$RELEASE_DIR/$COMPOSE_FILE_NAME" run --rm --no-deps server npm run db:migrate
sudo docker-compose -p "$COMPOSE_PROJECT_NAME" -f "\$RELEASE_DIR/$COMPOSE_FILE_NAME" up -d --force-recreate --remove-orphans server

rm -rf "$APP_DIR/current"
ln -sfn "\$RELEASE_DIR" "$APP_DIR/current"

sudo install -m 644 "\$RELEASE_DIR/$SYSTEMD_UNIT_NAME" /etc/systemd/system/$SYSTEMD_UNIT_NAME
sudo install -m 644 "\$RELEASE_DIR/$DISK_CLEANUP_SERVICE_NAME" /etc/systemd/system/$DISK_CLEANUP_SERVICE_NAME
sudo install -m 644 "\$RELEASE_DIR/$DISK_CLEANUP_TIMER_NAME" /etc/systemd/system/$DISK_CLEANUP_TIMER_NAME
sudo systemctl daemon-reload
sudo systemctl enable --now $SYSTEMD_UNIT_NAME
sudo systemctl enable --now $DISK_CLEANUP_TIMER_NAME

sudo docker-compose -p "$COMPOSE_PROJECT_NAME" -f "\$RELEASE_DIR/$COMPOSE_FILE_NAME" ps
curl -fsS http://127.0.0.1:5000/api/health
version_response="\$(curl -fsS http://127.0.0.1:5000/api/version)"
echo "Deployed version: \$version_response"

current_release="\$(readlink -f "$APP_DIR/current")"
previous_release="\$(ls -1dt "$APP_DIR/releases"/* 2>/dev/null | grep -vx "\$current_release" | head -n 1 || true)"
for release_path in "$APP_DIR"/releases/*; do
  [ -d "\$release_path" ] || continue
  if [ "\$release_path" = "\$current_release" ] || [ "\$release_path" = "\$previous_release" ]; then
    continue
  fi
  rm -rf "\$release_path"
done

sudo docker container prune -f
sudo docker image prune -af
EOF
