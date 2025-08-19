# Automatic Token Refresh Setup Guide

This guide will help you set up automatic token refresh for your Upstox EMA(5) Alert System, so you never have to manually update tokens again!

## 🎯 Overview

The system uses Upstox OAuth 2.0 flow to automatically refresh your access tokens. Once configured, it will:
- ✅ Check token expiry every 30 minutes
- ✅ Automatically refresh tokens before they expire
- ✅ Update your `.env` file with new tokens
- ✅ Continue running without interruption

## 📋 Prerequisites

1. **Upstox Developer Account**: You need access to Upstox Developer Console
2. **App Credentials**: Client ID and Client Secret from your Upstox app

## 🚀 One-Time Setup

### Step 1: Get Your Upstox App Credentials

1. Visit [Upstox Developer Console](https://api.upstox.com/developer-console)
2. Login to your account
3. Create a new app or use existing one
4. Configure your app:
   - **App Name**: Any name (e.g., "EMA5 Alert System")
   - **Redirect URI**: `http://localhost:3000/callback`
   - **Description**: Optional
5. Save and copy your **Client ID** and **Client Secret**

### Step 2: Run the Setup Script

```bash
npm run setup-tokens
```

The script will:
1. Ask for your Client ID and Client Secret
2. Save them to your `.env` file
3. Generate an authorization URL
4. Guide you through the OAuth flow
5. Exchange the authorization code for tokens
6. Set up automatic refresh

### Step 3: Complete Authorization

1. The script will show you an authorization URL
2. Open this URL in your browser
3. Login to Upstox and authorize your app
4. You'll be redirected to `http://localhost:3000/callback?code=XXXX...`
5. Copy the `code` parameter from the URL
6. Paste it back into the script

### Step 4: Done! 🎉

Your system is now configured for automatic token refresh!

## 📁 Files Created

- **`token-manager.js`**: Core token management functionality
- **`setup-tokens.js`**: Interactive setup script
- **`upstox-tokens.json`**: Stores refresh tokens (auto-created)

## 🔧 Available Commands

```bash
# Complete setup (run once)
npm run setup-tokens

# Check current token status
npm run check-token

# Manually refresh token
npm run refresh-token

# Start your bot (with auto-refresh)
npm start
```

## 📊 How It Works

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Your Bot      │    │  Token Manager   │    │  Upstox API     │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ 1. Starts up    │───▶│ 2. Check token   │───▶│ 3. Validate     │
│                 │    │    expiry        │    │    token        │
│                 │    │                  │    │                 │
│ 6. Continues    │◀───│ 5. Update .env   │◀───│ 4. Refresh if   │
│    running      │    │    with new      │    │    needed       │
│                 │    │    token         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## ⚙️ Configuration

Your `.env` file should include:

```env
# Regular Upstox token (will be auto-updated)
UPSTOX_ACCESS_TOKEN=your_access_token

# OAuth credentials (for auto-refresh)
UPSTOX_CLIENT_ID=your_client_id
UPSTOX_CLIENT_SECRET=your_client_secret
UPSTOX_REDIRECT_URI=http://localhost:3000/callback

# Other configurations...
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 🔍 Monitoring & Troubleshooting

### Check Token Status
```bash
npm run check-token
```

Sample output:
```
🔍 Current Token Status:
Expired: ✅ NO
Needs Refresh: ✅ NO
Expires At: 19/8/2025, 11:30:00 pm
Time Until Expiry: 8h 45m
```

### Manual Refresh
```bash
npm run refresh-token
```

### Bot Logs
When running your bot, you'll see:
```
✅ Token is valid for 8h 45m
🔄 Starting automatic token refresh system...
```

Or when refreshing:
```
🔄 Token expires soon, refreshing proactively...
✅ Access token refreshed successfully!
✅ Updated .env file with new access token
```

## 🚨 Error Handling

### "Missing OAuth credentials"
- Make sure you've run `npm run setup-tokens`
- Check that `UPSTOX_CLIENT_ID` and `UPSTOX_CLIENT_SECRET` are in your `.env`

### "No refresh token available"
- Run `npm run setup-tokens` again to re-authorize
- This happens if the refresh token expires (very rare)

### "Invalid authorization code"
- Make sure you copied the full code from the redirect URL
- The code should be quite long (50+ characters)
- Try the authorization flow again

### "Token refresh failed"
- Check your internet connection
- Verify your Client ID and Secret are correct
- The refresh token might have expired - re-run setup

## 🔒 Security Notes

1. **Never commit tokens**: `.env` and `upstox-tokens.json` are in `.gitignore`
2. **Secure your credentials**: Keep Client ID and Secret safe
3. **Rotate regularly**: While auto-refresh handles daily tokens, consider rotating OAuth credentials periodically

## 🎯 Benefits

- ✅ **Zero downtime**: Bot continues running during token refresh
- ✅ **Proactive refresh**: Tokens refreshed before expiry
- ✅ **Automatic updates**: `.env` file updated automatically
- ✅ **Error resilience**: Retries and fallback mechanisms
- ✅ **No manual work**: Set it once, forget it forever

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your Upstox app configuration
3. Ensure your redirect URI is exactly: `http://localhost:3000/callback`
4. Try running the setup again: `npm run setup-tokens`

## 🔄 Migration from Manual Tokens

If you were manually updating tokens before:

1. Keep your current token in `.env` (it will be replaced after first refresh)
2. Run `npm run setup-tokens` once
3. Your bot will automatically handle all future token updates
4. You can delete any old token management scripts

---

**That's it!** Your EMA(5) Alert System will now run continuously without manual token updates! 🚀
