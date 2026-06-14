#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nearhub-server}"
JOURNAL_MAX_SIZE="${JOURNAL_MAX_SIZE:-50M}"

log() {
  printf '[DiskCleanup] %s\n' "$*"
}

prune_releases() {
  if [ ! -d "$APP_DIR/releases" ]; then
    return 0
  fi

  local current_release=""
  local previous_release=""
  if [ -e "$APP_DIR/current" ]; then
    current_release="$(readlink -f "$APP_DIR/current" || true)"
  fi

  previous_release="$(ls -1dt "$APP_DIR/releases"/* 2>/dev/null | grep -vx "${current_release:-}" | head -n 1 || true)"

  for release_path in "$APP_DIR"/releases/*; do
    [ -d "$release_path" ] || continue
    if [ "$release_path" = "$current_release" ] || [ "$release_path" = "$previous_release" ]; then
      continue
    fi
    rm -rf "$release_path"
    log "Removed old release: $release_path"
  done
}

prune_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log 'docker not available, skipping docker cleanup'
    return 0
  fi

  docker container prune -f || true
  docker image prune -af || true
}

clean_apt_and_logs() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get clean || true
    rm -rf /var/lib/apt/lists/* || true
  fi

  if command -v journalctl >/dev/null 2>&1; then
    journalctl --vacuum-size="$JOURNAL_MAX_SIZE" || true
  fi
}

log 'Starting maintenance cleanup'
prune_releases
prune_docker
clean_apt_and_logs
log 'Cleanup finished'
