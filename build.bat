@echo off
echo 🚀 Building EMA(5) Alert System for Deployment...

echo 📦 Installing dependencies...
call npm ci --production

echo 🧪 Testing configuration...
call node test-config.js

if %ERRORLEVEL% EQU 0 (
    echo ✅ Build completed successfully!
    echo 📊 Ready for deployment to Render
    echo.
    echo 📋 Deployment checklist:
    echo    ✅ Dependencies installed
    echo    ✅ Configuration validated
    echo    ✅ Telegram bot connected
    echo    ✅ Health endpoint ready
    echo.
    echo 🔗 Deploy to Render using:
    echo    1. Push to GitHub
    echo    2. Connect to Render service
    echo    3. Set environment variables
) else (
    echo ❌ Build failed. Please check the configuration.
    exit /b 1
)
