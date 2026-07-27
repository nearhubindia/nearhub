#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/.." && pwd)"
cd "$ROOT_DIR"

CONFIG_FILE="$ROOT_DIR/release/build-config.env"
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
ANDROID_RELEASE_ABIS="${ANDROID_RELEASE_ABIS:-armeabi-v7a,arm64-v8a}"
EXPECTED_SHA1="${EXPECTED_UPLOAD_SHA1:-DF:38:D8:51:51:3E:10:8C:D6:6C:DC:2C:7B:95:93:32:04:7D:3A:3E}"
export VERSION_CODE VERSION_NAME MIN_SDK_VERSION ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS ANDROID_RELEASE_ABIS
export ALLOW_DEBUG_RELEASE_SIGNING="${ALLOW_DEBUG_RELEASE_SIGNING:-false}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$REPO_ROOT/.gradle-local}"

WRAPPER_CACHE_SRC="${HOME}/.gradle/wrapper/dists"
WRAPPER_CACHE_DEST="$GRADLE_USER_HOME/wrapper/dists"
if [[ -d "$WRAPPER_CACHE_SRC" ]]; then
  mkdir -p "$WRAPPER_CACHE_DEST"
  if [[ ! -d "$WRAPPER_CACHE_DEST/gradle-8.14.3-bin/cv11ve7ro1n3o1j4so8xd9n66/gradle-8.14.3" ]]; then
    cp -a "$WRAPPER_CACHE_SRC/." "$WRAPPER_CACHE_DEST/"
  fi
fi

echo "Release config:"
echo "  VERSION_CODE=$VERSION_CODE"
echo "  VERSION_NAME=$VERSION_NAME"
echo "  MIN_SDK_VERSION=$MIN_SDK_VERSION"
echo "  MINIFY=$ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS"
echo "  RELEASE_ABIS=$ANDROID_RELEASE_ABIS"
echo "  GRADLE_USER_HOME=$GRADLE_USER_HOME"

echo "Starting local Android App Bundle build..."
(
  cd "$ROOT_DIR/android"
  ./gradlew --no-daemon :app:bundleRelease "-PreactNativeArchitectures=$ANDROID_RELEASE_ABIS"
)

AAB_SOURCE="$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB_SOURCE" ]]; then
  echo "No bundle artifact found at $AAB_SOURCE"
  exit 1
fi

LATEST_AAB="$ROOT_DIR/build-${VERSION_NAME}-${VERSION_CODE}.aab"
cp "$AAB_SOURCE" "$LATEST_AAB"

echo "Verifying signing certificate on: $LATEST_AAB"
ACTUAL_SHA1="$(keytool -printcert -jarfile "$LATEST_AAB" | sed -n 's/.*SHA1: //p' | head -n 1 | tr '[:lower:]' '[:upper:]')"
if [[ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]]; then
  echo "Signing SHA1 mismatch."
  echo "Expected: $EXPECTED_SHA1"
  echo "Actual:   $ACTUAL_SHA1"
  exit 1
fi

sha256sum "$LATEST_AAB" > "${LATEST_AAB}.sha256"

MAPPING_SOURCE="$ROOT_DIR/android/app/build/outputs/mapping/release/mapping.txt"
MAPPING_DEST="${LATEST_AAB%.aab}-mapping.txt"
if [[ -f "$MAPPING_SOURCE" ]]; then
  cp "$MAPPING_SOURCE" "$MAPPING_DEST"
  sha256sum "$MAPPING_DEST" > "${MAPPING_DEST}.sha256"
fi

echo "Build complete."
echo "AAB: $LATEST_AAB"
echo "SHA256: ${LATEST_AAB}.sha256"
echo "Signing SHA1: $ACTUAL_SHA1"
if [[ -f "${MAPPING_DEST:-}" ]]; then
  echo "Mapping: $MAPPING_DEST"
  echo "Mapping SHA256: ${MAPPING_DEST}.sha256"
fi
