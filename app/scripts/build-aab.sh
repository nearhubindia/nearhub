#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EXPECTED_SHA1="${EXPECTED_UPLOAD_SHA1:-DF:38:D8:51:51:3E:10:8C:D6:6C:DC:2C:7B:95:93:32:04:7D:3A:3E}"

echo "Starting Expo local production AAB build..."
ALLOW_DEBUG_RELEASE_SIGNING=true npx eas build --platform android --profile production --local --non-interactive

LATEST_AAB="$(ls -1t "$ROOT_DIR"/build-*.aab | head -n 1)"
if [[ -z "${LATEST_AAB:-}" || ! -f "$LATEST_AAB" ]]; then
  echo "No build artifact found in app/build-*.aab"
  exit 1
fi

echo "Verifying signing certificate on: $LATEST_AAB"
ACTUAL_SHA1="$(keytool -printcert -jarfile "$LATEST_AAB" | sed -n 's/.*SHA1: //p' | head -n 1 | tr '[:lower:]' '[:upper:]')"
if [[ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]]; then
  echo "Signing SHA1 mismatch."
  echo "Expected: $EXPECTED_SHA1"
  echo "Actual:   $ACTUAL_SHA1"
  exit 1
fi

sha256sum "$LATEST_AAB" > "${LATEST_AAB}.sha256"

echo "Build complete."
echo "AAB: $LATEST_AAB"
echo "SHA256: ${LATEST_AAB}.sha256"
echo "Signing SHA1: $ACTUAL_SHA1"
