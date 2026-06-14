#!/bin/bash

# NearHub - Start Metro Bundler for Development
# Run this once and keep it running while developing

set -e

echo "🚀 Starting Metro bundler..."
echo "📱 Once Metro starts, reload the app on your device (r key or shake device)"
echo "🔌 For USB-connected phones, keep adb reverse tcp:8081 tcp:8081 active."
echo ""
echo "Your device should connect to: http://127.0.0.1:8081"
echo ""

# Pin the Metro port so Expo CLI doesn't try to walk the port range.
export RCT_METRO_PORT=8081

# Start Metro bundler for the dev client over USB/localhost.
npx expo start --clear --localhost --port 8081 --dev-client
