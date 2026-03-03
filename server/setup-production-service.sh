#!/bin/bash
# Quick Setup Script for Production Service

set -e

echo "🚀 Setting up Production-Ready Listing & Subscription Service"
echo "=============================================================="

# Navigate to server directory
cd "$(dirname "$0")"

echo ""
echo "Step 1: Running database migrations..."
echo "----------------------------------------"
PGPASSWORD='Synvide@123' psql -h localhost -U postgres -d nearhub -f migrations/0003_performance_indexes.sql

echo ""
echo "✅ Database indexes created successfully!"

echo ""
echo "Step 2: Building server..."
echo "----------------------------------------"
npm run build

echo ""
echo "✅ Server built successfully!"

echo ""
echo "=============================================================="
echo "✨ Setup Complete!"
echo ""
echo "To start the server with background workers:"
echo "  npm run dev"
echo ""
echo "Background workers will automatically start:"
echo "  ✓ Subscription Expiration (every 1 hour)"
echo "  ✓ Listing Expiration (every 30 minutes)"
echo ""
echo "Monitor workers:"
echo "  curl http://localhost:5000/api/workers/status"
echo ""
echo "View statistics:"
echo "  curl http://localhost:5000/api/workers/subscriptions/stats"
echo "  curl http://localhost:5000/api/workers/listings/stats"
echo ""
echo "📖 Full documentation: ../PRODUCTION_SERVICE_GUIDE.md"
echo "=============================================================="
