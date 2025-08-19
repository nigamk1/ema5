# Production Deployment Guide - Render.com

This guide will help you set up your EMA(5) Alert System on Render.com with **automatic token refresh** that will work forever without manual intervention.

## 🎯 Production URL
Your app is deployed at: **https://ema5-alert-system.onrender.com**

## 🚀 One-Time Setup (Set Once, Forget Forever)

### Step 1: Update Upstox App Settings

1. **Visit Upstox Developer Console**: https://api.upstox.com/developer-console
2. **Edit your existing app** (or create new one if needed)
3. **Update Redirect URI** to: `https://ema5-alert-system.onrender.com/callback`
4. **Save changes**

### Step 2: Set Environment Variables in Render

1. **Go to your Render Dashboard** 
2. **Navigate to your service**: ema5-alert-system
3. **Go to Environment tab**
4. **Add/Update these variables**:

```env
# Upstox OAuth Credentials (for automatic refresh)
UPSTOX_CLIENT_ID=a3747484-832d-4601-8e49-610e8b7f9eb2
UPSTOX_CLIENT_SECRET=2u8mvmovmd
UPSTOX_REDIRECT_URI=https://ema5-alert-system.onrender.com/callback

# Current access token (will be auto-updated)
UPSTOX_ACCESS_TOKEN=your_current_token

# Telegram Configuration
TELEGRAM_BOT_TOKEN=7081191913:AAFtW8vR6AXsavzKw7RmuYgiSTFLcOhb7gg
TELEGRAM_CHAT_ID=801765025

# Trading Configuration
INSTRUMENT_KEY=NSE_INDEX|Nifty 50
TIMEFRAME=5minute
EMA_PERIOD=5
LOG_LEVEL=info
ALERT_COOLDOWN_MINUTES=2

# Production Settings
NODE_ENV=production
PORT=10000
```

### Step 3: Deploy and Authorize (ONE TIME ONLY)

1. **Deploy your updated code** to Render
2. **Wait for deployment to complete**
3. **Visit this authorization URL** (replace with actual URL from logs):

   ```
   https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=a3747484-832d-4601-8e49-610e8b7f9eb2&redirect_uri=https://ema5-alert-system.onrender.com/callback&state=upstox_auth_1755584921
   ```

4. **Login to Upstox** and authorize your app
5. **You'll be redirected** to: `https://ema5-alert-system.onrender.com/callback?code=XXXX...`
6. **Success page will confirm** authorization completed

### Step 4: Verify Setup

1. **Check your app logs** in Render dashboard
2. **Look for these messages**:
   ```
   🔄 Starting production automatic token refresh system...
   ✅ Production scheduler active (checking every 20 minutes)
   ✅ Token is valid for 8h 45m
   ```

3. **Visit health endpoint**: https://ema5-alert-system.onrender.com/health
4. **Check main page**: https://ema5-alert-system.onrender.com/

## 🔄 How It Works in Production

### Automatic Token Refresh
- ✅ **Checks every 20 minutes** for token expiry
- ✅ **Refreshes proactively** 30 minutes before expiry
- ✅ **Updates environment** automatically
- ✅ **Never stops running** during token refresh
- ✅ **Handles failures gracefully** with retries

### Production Features
- 🔧 **Enhanced error handling** for production environment
- 📊 **Detailed logging** for monitoring
- 🔄 **Graceful fallbacks** if refresh fails temporarily
- 📈 **Health monitoring** endpoints
- 🚨 **Continuous operation** during token updates

## 📊 Monitoring Your App

### Health Check Endpoints

**Main Health**: https://ema5-alert-system.onrender.com/health
```json
{
  "status": "healthy",
  "service": "EMA(5) Real-time Alert System",
  "timestamp": "2025-08-19T10:30:00.000Z",
  "uptime": 3600,
  "isMarketOpen": true,
  "isConnected": true,
  "useRestFallback": false,
  "candlesGenerated": 42,
  "lastCandle": "19/08/2025, 14:30"
}
```

**Main Page**: https://ema5-alert-system.onrender.com/
- Shows current status
- Market hours
- Connection status
- Uptime information

### Log Messages to Watch

**Successful Token Refresh**:
```
🔄 Token expires soon, refreshing proactively...
✅ Access token refreshed successfully!
✅ Updated .env file with new access token
🔄 Production token refresh completed successfully
```

**Normal Operation**:
```
✅ Token is valid for 8h 45m
📊 Real-time tick: ₹24850.50 at 19/8/2025, 14:30:00
🕯️ ===== 5-MINUTE CANDLE COMPLETED =====
```

## 🎉 Benefits of This Setup

### ✅ Lifetime Operation
- **Set once, forget forever** - No manual intervention ever needed
- **Automatic token refresh** every 24 hours
- **Production-grade reliability** with error handling

### ✅ Zero Downtime
- **Continuous operation** during token refresh
- **Graceful fallbacks** if temporary issues occur
- **No service interruption** for token updates

### ✅ Production Ready
- **Enhanced error handling** for production environment
- **Monitoring endpoints** for health checks
- **Detailed logging** for troubleshooting
- **Optimized refresh schedule** (every 20 minutes vs 30)

## 🔧 Troubleshooting

### Token Refresh Issues

**Check Environment Variables**:
```bash
# In Render dashboard, verify these are set:
UPSTOX_CLIENT_ID=a3747484-832d-4601-8e49-610e8b7f9eb2
UPSTOX_CLIENT_SECRET=2u8mvmovmd
UPSTOX_REDIRECT_URI=https://ema5-alert-system.onrender.com/callback
```

**Check Logs for**:
- `❌ Production token refresh failed`
- `❌ Missing required environment variables`
- `🔄 Starting production automatic token refresh system...`

### Re-authorization (Rare)

If refresh tokens expire (very rare), you'll need to:

1. **Visit**: https://ema5-alert-system.onrender.com/ (check logs for auth URL)
2. **Re-authorize** once
3. **System will resume** automatic operation

### Health Check Fails

- **Check**: https://ema5-alert-system.onrender.com/health
- **Verify**: Environment variables are set correctly
- **Review**: Render logs for error messages

## 📈 Production Optimization

### Environment Variables Set
- ✅ `NODE_ENV=production` - Enables production optimizations
- ✅ `UPSTOX_REDIRECT_URI` - Points to your production domain
- ✅ OAuth credentials - Enable automatic refresh

### Monitoring
- ✅ Health endpoint available at `/health`
- ✅ Main status page at `/`
- ✅ OAuth callback at `/callback`
- ✅ Detailed logging in Render dashboard

## 🎯 Summary

**What you've achieved:**
1. ✅ **Automatic daily token refresh** - No manual updates ever
2. ✅ **Production-grade deployment** - Reliable and monitored
3. ✅ **Zero-downtime operation** - Continuous trading alerts
4. ✅ **Set once, forget forever** - Lifetime automation

**Your app will now:**
- 🔄 Automatically refresh tokens every 24 hours
- 📊 Generate real-time 5-minute candles
- 🚨 Send immediate EMA(5) alerts via Telegram
- 📈 Run continuously without manual intervention
- 🎯 Operate reliably in production environment

**You can now forget about token management forever!** 🚀

---

## 🆘 Emergency Contacts

- **Render Support**: If deployment issues occur
- **Upstox Support**: If API access issues persist
- **Health Check**: https://ema5-alert-system.onrender.com/health
- **App Status**: https://ema5-alert-system.onrender.com/
