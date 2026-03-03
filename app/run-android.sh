#!/bin/bash

# NearHub - Start Metro Bundler for Development
# Run this once and keep it running while developing

set -e

echo "🚀 Starting Metro bundler..."
echo "📱 Once Metro starts, reload the app on your device (r key or shake device)"
echo ""
echo "Your device should connect to: http://192.168.29.58:8081"
echo ""

# Start Metro bundler (it will stay in foreground)
npx expo start --clear --lan
