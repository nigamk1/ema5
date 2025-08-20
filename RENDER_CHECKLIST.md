<!-- 
# 🚀 RENDER ONE-TIME SETUP CHECKLIST

## 📋 STEP 1: SET ENVIRONMENT VARIABLES

Login to [Render Dashboard](https://dashboard.render.com) and add these variables:

### ✅ Copy & Paste These Exact Values:

| Variable Name | Value |
|--------------|-------|
| `UPSTOX_CLIENT_ID` | `a3747484-832d-4601-8e49-610e8b7f9eb2` |
| `UPSTOX_CLIENT_SECRET` | `2u8mvmovmd` |
| `UPSTOX_REDIRECT_URI` | `https://ema5-alert-system.onrender.com/callback` |
| `TELEGRAM_BOT_TOKEN` | `7081191913:AAFtW8vR6AXsavzKw7RmuYgiSTFLcOhb7gg` |
| `TELEGRAM_CHAT_ID` | `801765025` |
| `INSTRUMENT_KEY` | `NSE_INDEX|Nifty 50` |
| `TIMEFRAME` | `5minute` |
| `EMA_PERIOD` | `5` |
| `LOG_LEVEL` | `info` |
| `ALERT_COOLDOWN_MINUTES` | `2` |
| `NODE_ENV` | `production` |

---

## 📋 STEP 2: DEPLOY & VERIFY

### After adding variables:
- [ ] Click "Save Changes" on Render
- [ ] Wait for automatic redeploy (2-3 minutes)
- [ ] Visit: https://ema5-alert-system.onrender.com/health
- [ ] Should see: `{"status":"healthy"}`

---

## 📋 STEP 3: ONE-TIME TOKEN SETUP

### Do this ONCE only:
- [ ] Visit: https://ema5-alert-system.onrender.com/auth
- [ ] Click "Authorize with Upstox"
- [ ] Login to Upstox and approve
- [ ] Should see: "Token setup successful"

---

## 📋 STEP 4: FINAL VERIFICATION

### Check these URLs work:
- [ ] Health: https://ema5-alert-system.onrender.com/health
- [ ] Token Status: https://ema5-alert-system.onrender.com/token-status
- [ ] Should show token expiry time

---

## ✅ COMPLETED SETUP

After completing all steps:
- ✅ No more daily token updates needed
- ✅ System runs automatically 24/7
- ✅ Auto-refresh handles everything
- ✅ Alerts work during market hours
- ✅ Zero maintenance required

## 🎯 RESULT: FULLY AUTOMATED SYSTEM! 🚀

-->

# RENDER SETUP CHECKLIST

## ✅ ENVIRONMENT VARIABLES SETUP

Go to [Render Dashboard](https://dashboard.render.com) → Your Service → Environment Tab

### Add these 11 variables:

```
UPSTOX_CLIENT_ID = a3747484-832d-4601-8e49-610e8b7f9eb2
UPSTOX_CLIENT_SECRET = 2u8mvmovmd  
UPSTOX_REDIRECT_URI = https://ema5-alert-system.onrender.com/callback
TELEGRAM_BOT_TOKEN = 7081191913:AAFtW8vR6AXsavzKw7RmuYgiSTFLcOhb7gg
TELEGRAM_CHAT_ID = 801765025
INSTRUMENT_KEY = NSE_INDEX|Nifty 50
TIMEFRAME = 5minute
EMA_PERIOD = 5
LOG_LEVEL = info
ALERT_COOLDOWN_MINUTES = 2
NODE_ENV = production
```

## ✅ ONE-TIME TOKEN AUTHORIZATION

**After deployment, visit ONCE:**
https://ema5-alert-system.onrender.com/auth

Click "Authorize" → Login to Upstox → Done!

## ✅ VERIFICATION URLS

- **Health**: https://ema5-alert-system.onrender.com/health  
- **Token Status**: https://ema5-alert-system.onrender.com/token-status

## 🎉 RESULT: 100% AUTOMATED SYSTEM!
