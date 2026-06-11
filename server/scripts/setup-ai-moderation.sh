#!/bin/bash

# AI Content Moderation Setup Script
# Sets up LLaVA-Phi3 for image/video content moderation

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  NearHub AI Content Moderation Setup                    ║"
echo "║  Setting up LLaVA-Phi3 (2.2GB)                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed!"
    echo ""
    echo "Please install Ollama first:"
    echo "  Linux: curl -fsSL https://ollama.com/install.sh | sh"
    echo "  macOS: brew install ollama"
    echo ""
    exit 1
fi

echo "✓ Ollama is installed"
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "⚠️  Ollama is not running. Starting Ollama..."
    ollama serve &
    OLLAMA_PID=$!
    sleep 3
    echo "✓ Ollama started (PID: $OLLAMA_PID)"
else
    echo "✓ Ollama is running"
fi
echo ""

# Check current models
echo "📦 Current models:"
ollama list
echo ""

# Pull LLaVA-Phi3 if not already present
if ollama list | grep -q "llava-phi3"; then
    echo "✓ LLaVA-Phi3 is already installed"
else
    echo "⬇️  Downloading LLaVA-Phi3 (2.2GB)..."
    echo "   This may take a few minutes..."
    ollama pull llava-phi3
    echo "✓ LLaVA-Phi3 downloaded successfully"
fi
echo ""

# Test the model
echo "🧪 Testing LLaVA-Phi3..."
TEST_RESPONSE=$(echo "What is content moderation in 10 words?" | ollama run llava-phi3 2>/dev/null | head -n 1)
if [ ! -z "$TEST_RESPONSE" ]; then
    echo "✓ Model test successful!"
    echo "   Response: $TEST_RESPONSE"
else
    echo "⚠️  Model test failed, but model is installed"
fi
echo ""

# Display final status
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup Complete!                                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Model Information:"
echo "  • Name: LLaVA-Phi3"
echo "  • Size: 2.2 GB"
echo "  • Type: Vision + Language"
echo "  • Capabilities: Text, Image, Video moderation"
echo ""
echo "Next Steps:"
echo "  1. Start your server: npm run dev"
echo "  2. Upload endpoint will automatically validate content"
echo "  3. Check logs for moderation results"
echo ""
echo "Documentation:"
echo "  📖 See AI_MODERATION_SETUP.md for details"
echo ""
echo "Test the API:"
echo "  curl -X POST http://localhost:3001/api/subscriptions/create-listing \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d @test-listing.json"
echo ""
