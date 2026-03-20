#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONFIG_FILE="$ROOT_DIR/release/build-config.env"
if [[ -f "$CONFIG_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  set +a
fi

VERSION_CODE="${VERSION_CODE:-4}"
VERSION_NAME="${VERSION_NAME:-1.0.1}"
MIN_SDK_VERSION="${MIN_SDK_VERSION:-24}"
ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS="${ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS:-true}"
EXPECTED_SHA1="${EXPECTED_UPLOAD_SHA1:-DF:38:D8:51:51:3E:10:8C:D6:6C:DC:2C:7B:95:93:32:04:7D:3A:3E}"
EAS_CLI_VERSION="${EAS_CLI_VERSION:-18.4.0}"

export VERSION_CODE VERSION_NAME MIN_SDK_VERSION ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS
export EAS_LOCAL_BUILD_SKIP_CLEANUP="${EAS_LOCAL_BUILD_SKIP_CLEANUP:-0}"
# Keep local EAS temp output outside the app workspace so Metro doesn't watch gigantic build trees.
export EAS_LOCAL_BUILD_WORKINGDIR="${EAS_LOCAL_BUILD_WORKINGDIR:-/tmp/nearhub-eas-local-$(date +%Y%m%d-%H%M%S)}"
export ALLOW_DEBUG_RELEASE_SIGNING=true

echo "Release config:"
echo "  VERSION_CODE=$VERSION_CODE"
echo "  VERSION_NAME=$VERSION_NAME"
echo "  MIN_SDK_VERSION=$MIN_SDK_VERSION"
echo "  MINIFY=$ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS"

echo "Starting Expo local production AAB build..."
npx --yes "eas-cli@${EAS_CLI_VERSION}" build --platform android --profile production --local --non-interactive

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

MAPPING_SOURCE="$EAS_LOCAL_BUILD_WORKINGDIR/build/app/android/app/build/outputs/mapping/release/mapping.txt"
MAPPING_DEST="${LATEST_AAB%.aab}-mapping.txt"
if [[ -f "$MAPPING_SOURCE" ]]; then
  cp "$MAPPING_SOURCE" "$MAPPING_DEST"
  sha256sum "$MAPPING_DEST" > "${MAPPING_DEST}.sha256"
fi

echo "Build complete."
echo "AAB: $LATEST_AAB"
echo "SHA256: ${LATEST_AAB}.sha256"
echo "Signing SHA1: $ACTUAL_SHA1"
if [[ -f "$MAPPING_DEST" ]]; then
  echo "Mapping: $MAPPING_DEST"
  echo "Mapping SHA256: ${MAPPING_DEST}.sha256"
fi
