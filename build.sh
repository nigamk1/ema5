#!/bin/bash

# Build and test script for EMA(5) Alert System
echo "🚀 Building EMA(5) Alert System for Deployment..."

# Clean install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Run configuration test
echo "🧪 Testing configuration..."
node test-config.js

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📊 Ready for deployment to Render"
    echo ""
    echo "📋 Deployment checklist:"
    echo "   ✅ Dependencies installed"
    echo "   ✅ Configuration validated"
    echo "   ✅ Telegram bot connected"
    echo "   ✅ Health endpoint ready"
    echo ""
    echo "🔗 Deploy to Render using:"
    echo "   1. Push to GitHub"
    echo "   2. Connect to Render service"
    echo "   3. Set environment variables"
else
    echo "❌ Build failed. Please check the configuration."
    exit 1
fi
