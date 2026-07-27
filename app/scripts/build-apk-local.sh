#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_CONFIG_FILE="$ROOT_DIR/release/build-config.env"
LEGACY_CONFIG_FILE="$ROOT_DIR/.env.local-apk"
if [[ -f "$LEGACY_CONFIG_FILE" ]]; then
  DEFAULT_CONFIG_FILE="$LEGACY_CONFIG_FILE"
fi
CONFIG_FILE="${APK_BUILD_CONFIG_FILE:-$DEFAULT_CONFIG_FILE}"
if [[ -f "$CONFIG_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
  set +a
fi

VERSION_CODE="${VERSION_CODE:-69}"
VERSION_NAME="${VERSION_NAME:-1.3.16}"
MIN_SDK_VERSION="${MIN_SDK_VERSION:-24}"
ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS="${ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS:-true}"
EXPECTED_SHA1="${EXPECTED_UPLOAD_SHA1:-DF:38:D8:51:51:3E:10:8C:D6:6C:DC:2C:7B:95:93:32:04:7D:3A:3E}"
EAS_CLI_VERSION="${EAS_CLI_VERSION:-18.4.0}"

export VERSION_CODE VERSION_NAME MIN_SDK_VERSION ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS
export EAS_LOCAL_BUILD_SKIP_CLEANUP="${EAS_LOCAL_BUILD_SKIP_CLEANUP:-0}"
# Keep local EAS temp output outside the app workspace so Metro doesn't watch gigantic build trees.
export EAS_LOCAL_BUILD_WORKINGDIR="${EAS_LOCAL_BUILD_WORKINGDIR:-/tmp/nearhub-eas-local-apk-$(date +%Y%m%d-%H%M%S)}"
export ALLOW_DEBUG_RELEASE_SIGNING="${ALLOW_DEBUG_RELEASE_SIGNING:-true}"

BUILD_STAMP="$(mktemp)"
touch "$BUILD_STAMP"

EAS_CMD=()
if [[ -n "${EAS_CLI_BIN:-}" ]]; then
  IFS=' ' read -r -a EAS_CMD <<< "$EAS_CLI_BIN"
elif command -v eas >/dev/null 2>&1; then
  EAS_CMD=("$(command -v eas)")
elif [[ -x "$ROOT_DIR/node_modules/.bin/eas" ]]; then
  EAS_CMD=("$ROOT_DIR/node_modules/.bin/eas")
else
  EAS_CMD=(npx --yes "eas-cli@${EAS_CLI_VERSION}")
fi

echo "Starting Expo local APK build..."
"${EAS_CMD[@]}" build --platform android --profile local-apk --local --non-interactive

LATEST_APK="$(find "$ROOT_DIR" -maxdepth 1 -type f -name 'build-*.apk' -newer "$BUILD_STAMP" | sort | tail -n 1)"
rm -f "$BUILD_STAMP"

if [[ -z "${LATEST_APK:-}" || ! -f "$LATEST_APK" ]]; then
  echo "No fresh APK artifact was produced by this build."
  exit 1
fi

find_apksigner() {
  if command -v apksigner >/dev/null 2>&1; then
    command -v apksigner
    return
  fi

  local sdk_root=""
  if [[ -n "${ANDROID_HOME:-}" ]]; then
    sdk_root="$ANDROID_HOME"
  elif [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    sdk_root="$ANDROID_SDK_ROOT"
  fi

  if [[ -n "$sdk_root" && -d "$sdk_root/build-tools" ]]; then
    local latest
    latest="$(ls -1 "$sdk_root/build-tools" | sort -V | tail -n 1)"
    if [[ -n "$latest" && -x "$sdk_root/build-tools/$latest/apksigner" ]]; then
      echo "$sdk_root/build-tools/$latest/apksigner"
      return
    fi
  fi
}

extract_apk_sha1() {
  local apk_path="$1"
  local signer_tool=""
  signer_tool="$(find_apksigner || true)"
  if [[ -n "$signer_tool" ]]; then
    "$signer_tool" verify --print-certs "$apk_path" 2>/dev/null \
      | sed -n 's/^Signer #1 certificate SHA-1 digest: //p' \
      | head -n 1 \
      | tr '[:lower:]' '[:upper:]'
    return
  fi

  keytool -printcert -jarfile "$apk_path" 2>/dev/null \
    | sed -n 's/.*SHA1: //p' \
    | head -n 1 \
    | tr '[:lower:]' '[:upper:]'
}

ACTUAL_SHA1="$(extract_apk_sha1 "$LATEST_APK")"
if [[ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]]; then
  if [[ -z "$ACTUAL_SHA1" ]]; then
    echo "Warning: Could not determine APK signing SHA1 on this machine."
  elif [[ "${ALLOW_DEBUG_RELEASE_SIGNING:-false}" == "true" ]]; then
    echo "Warning: APK SHA1 does not match upload certificate."
    echo "Expected: $EXPECTED_SHA1"
    echo "Actual:   $ACTUAL_SHA1"
  else
    echo "Signing SHA1 mismatch."
    echo "Expected: $EXPECTED_SHA1"
    echo "Actual:   $ACTUAL_SHA1"
    exit 1
  fi
fi

sha256sum "$LATEST_APK" > "${LATEST_APK}.sha256"

echo "Build complete."
echo "APK: $LATEST_APK"
echo "SHA256: ${LATEST_APK}.sha256"
echo "Signing SHA1: $ACTUAL_SHA1"
