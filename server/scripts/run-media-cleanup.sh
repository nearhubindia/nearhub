#!/bin/bash

# Media Cleanup Cron Job
# Automatically deletes videos/images from expired listings that haven't been renewed for 60+ days
# Add to crontab to run daily at midnight:
# 0 0 * * * /path/to/run-media-cleanup.sh

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
ADMIN_SECRET="${ADMIN_SECRET_KEY:-your-secret-key-here}"
MEDIA_DELETE_AFTER_DAYS="${MEDIA_DELETE_AFTER_DAYS:-60}"

# Run the cleanup API endpoint
echo "[$(date)] Starting media cleanup job..."

response=$(curl -s -X POST "$API_URL/api/media/cleanup/run-scheduled" \
  -H "Content-Type: application/json" \
  -d "{
    \"adminKey\": \"$ADMIN_SECRET\",
    \"mediaDeleteAfterDays\": $MEDIA_DELETE_AFTER_DAYS
  }")

# Log response
echo "[$(date)] Response: $response"

# Check if cleanup was successful
if echo "$response" | grep -q '"success":true'; then
  echo "[$(date)] Media cleanup completed successfully"
  exit 0
else
  echo "[$(date)] Media cleanup failed"
  exit 1
fi
