# 🚀 RENDER.COM ENVIRONMENT SETUP GUIDE
# One-Time Setup for EMA(5) Alert System

## 📋 ENVIRONMENT VARIABLES TO SET ON RENDER

Copy and paste these EXACT values in your Render dashboard:

### 🔑 UPSTOX API CONFIGURATION
```
UPSTOX_CLIENT_ID=a3747484-832d-4601-8e49-610e8b7f9eb2
UPSTOX_CLIENT_SECRET=2u8mvmovmd
UPSTOX_REDIRECT_URI=https://ema5-alert-system.onrender.com/callback
```

### 📱 TELEGRAM BOT CONFIGURATION  
```
TELEGRAM_BOT_TOKEN=7081191913:AAFtW8vR6AXsavzKw7RmuYgiSTFLcOhb7gg
TELEGRAM_CHAT_ID=801765025
```

### 📊 TRADING CONFIGURATION
```
INSTRUMENT_KEY=NSE_INDEX|Nifty 50
TIMEFRAME=5minute
EMA_PERIOD=5
```

### ⚙️ SYSTEM CONFIGURATION
```
LOG_LEVEL=info
ALERT_COOLDOWN_MINUTES=2
NODE_ENV=production
```

---

## 🎯 IMPORTANT: ACCESS TOKEN SETUP

**DO NOT** set `UPSTOX_ACCESS_TOKEN` manually on Render!

The system will automatically:
1. Generate the token when you visit: https://ema5-alert-system.onrender.com/auth
2. Save it securely on the server
3. Auto-refresh it every day

---

## 📝 STEP-BY-STEP RENDER SETUP

### 1. Login to Render Dashboard
- Go to: https://dashboard.render.com
- Open your `ema5-alert-system` service

### 2. Navigate to Environment Variables
- Click on your service
- Go to "Environment" tab on the left sidebar

### 3. Add Environment Variables
- Click "Add Environment Variable"
- Copy each variable from above (Name = Value)
- **Example:**
  ```
  Name: UPSTOX_CLIENT_ID
  Value: a3747484-832d-4601-8e49-610e8b7f9eb2
  ```

### 4. Deploy Changes
- Click "Save Changes"
- Wait for automatic redeploy (2-3 minutes)

---

## ✅ VERIFICATION STEPS

### After setting variables:

1. **Check Health**: Visit https://ema5-alert-system.onrender.com/health
2. **Setup Token**: Visit https://ema5-alert-system.onrender.com/auth (ONE TIME ONLY)
3. **Test Alerts**: System will start automatically during market hours

---

## 🔄 TOKEN REFRESH PROCESS

### Automatic Setup (Recommended):
1. Visit: https://ema5-alert-system.onrender.com/auth
2. Click "Authorize" 
3. Done! Token will auto-refresh forever

### Manual Setup (If needed):
1. Get authorization code from Upstox
2. Visit: https://ema5-alert-system.onrender.com/setup-token?code=YOUR_CODE
3. Done!

---

## 🛡️ SECURITY NOTES

- ✅ Client ID/Secret: Safe to store in Render
- ✅ Telegram Token: Safe to store in Render  
- ✅ Chat ID: Safe to store in Render
- ❌ Access Token: Auto-generated, don't set manually

---

## 📞 SUPPORT COMMANDS

### Check Token Status:
```bash
curl https://ema5-alert-system.onrender.com/token-status
```

### Force Token Refresh:
```bash
curl https://ema5-alert-system.onrender.com/refresh-token
```

### System Health:
```bash
curl https://ema5-alert-system.onrender.com/health
```

---

## 🎉 FINAL RESULT

After this one-time setup:
- ✅ No daily token updates needed
- ✅ No manual intervention required  
- ✅ System runs 24/7 automatically
- ✅ Auto-refresh handles everything
- ✅ Real-time alerts during market hours

**Your system will be completely hands-off!** 🚀
