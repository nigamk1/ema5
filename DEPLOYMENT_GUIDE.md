# Render Deployment Guide - EMA(5) Alert System

## 🚀 Deployment Steps Fixed

### 1. **Files Updated for Deployment**
- ✅ `package.json` - Removed unused dependency, updated Node version
- ✅ `.npmrc` - Added npm configuration for Render
- ✅ `render.yaml` - Improved build configuration
- ✅ `Dockerfile` - Enhanced for production deployment
- ✅ `.dockerignore` - Optimized build context

### 2. **Key Changes Made**

#### **package.json**
```json
{
  "dependencies": {
    "axios": "^1.11.0",
    "dotenv": "^17.2.1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

#### **.npmrc** (New file)
```
registry=https://registry.npmjs.org/
audit=false
fund=false
optional=false
save-exact=true
package-lock=true
progress=true
loglevel=warn
```

#### **render.yaml**
```yaml
services:
  - type: web
    name: ema5-alert-system
    runtime: node
    plan: free
    buildCommand: npm ci --production
    startCommand: npm start
    healthCheckPath: /health
    autoDeploy: false
```

### 3. **Deployment Process**

#### **Step 1: Push to GitHub**
```bash
git add .
git commit -m "Fix deployment configuration for Render"
git push origin main
```

#### **Step 2: Configure Render Service**
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `nigamk1/ema5`
4. Configure the service:
   - **Name**: `ema5-alert-system`
   - **Region**: Singapore (closest to Indian markets)
   - **Branch**: `production` or `main`
   - **Build Command**: `npm ci --production`
   - **Start Command**: `npm start`

#### **Step 3: Set Environment Variables**
In Render dashboard, add these environment variables:

**Required Variables:**
```
UPSTOX_ACCESS_TOKEN=your_upstox_token_here
TELEGRAM_BOT_TOKEN=7081191913:AAFtW8vR6AXsavzKw7RmuYgiSTFLcOhb7gg
TELEGRAM_CHAT_ID=801765025
```

**Optional Variables (already set in render.yaml):**
```
NODE_ENV=production
INSTRUMENT_KEY=NSE_INDEX|NIFTY 50
TIMEFRAME=5minute
EMA_PERIOD=5
LOG_LEVEL=info
ALERT_COOLDOWN_MINUTES=2
PORT=10000
```

### 4. **Verification Steps**

#### **After Deployment:**
1. **Check Build Logs**: Ensure no npm errors
2. **Health Check**: Visit `https://your-app.onrender.com/health`
3. **Service Status**: Should show "healthy" status
4. **Telegram Test**: Bot should be connected

#### **Expected Health Response:**
```json
{
  "status": "healthy",
  "service": "EMA(5) Alert System",
  "timestamp": "2025-08-04T07:30:00.000Z",
  "uptime": 120,
  "isMarketHours": false,
  "alertCandle": "None",
  "waitingForBreakdown": false
}
```

### 5. **Troubleshooting**

#### **If Build Fails:**
- Check that all dependencies are in `package.json`
- Verify Node version compatibility (>=18.0.0)
- Check `.npmrc` configuration

#### **If Runtime Fails:**
- Verify all environment variables are set
- Check Upstox token is valid and not expired
- Ensure Telegram bot token is correct

#### **If No Alerts:**
- Check market hours (9:15 AM - 3:30 PM IST)
- Verify Upstox API connectivity
- Check logs for strategy execution

### 6. **Monitoring**

#### **Health Endpoint:**
- URL: `https://your-app.onrender.com/health`
- Method: GET
- Response: JSON with service status

#### **Service Dashboard:**
- URL: `https://your-app.onrender.com/`
- Shows: Current status, uptime, market hours

#### **Logs:**
- Render dashboard → Your service → Logs
- Real-time monitoring of strategy execution

### 7. **Cost & Limitations**

#### **Render Free Tier:**
- ✅ 750 hours/month (sufficient for 24/7 operation)
- ✅ Automatic sleep after 15 min inactivity (wakes on request)
- ✅ Health checks keep service active during market hours
- ⚠️ May sleep outside market hours (this is fine)

### 8. **Alternative: Docker Deployment**

If Render continues to have issues, you can deploy using Docker:

```bash
# Build Docker image
docker build -t ema5-alert-system .

# Run locally for testing
docker run -p 10000:10000 --env-file .env ema5-alert-system
```

## 🎯 Next Steps

1. **Immediate**: Push the updated code to GitHub
2. **Deploy**: Follow Render deployment steps above
3. **Test**: Verify health endpoint works
4. **Monitor**: Check during market hours for live alerts

Your EMA(5) Alert System is now properly configured for production deployment! 🚀
