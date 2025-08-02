# Render Deployment Guide for EMA(5) Alert System

This guide will help you deploy your EMA(5) Alert System to Render.

## 🚀 Quick Deployment Steps

### 1. Prepare Your Repository

Make sure your code is pushed to GitHub with all the necessary files:
- `render.yaml` (deployment configuration)
- `package.json` (with correct dependencies)
- `bot.js` (main application with health endpoints)
- `Dockerfile` (optional, for containerized deployment)

### 2. Get Your API Keys

Before deploying, make sure you have:

1. **Upstox Access Token**: 
   - Log into your Upstox Developer account
   - Generate an access token for API access

2. **Telegram Bot Token**:
   - Create a bot via @BotFather on Telegram
   - Get your bot token

3. **Telegram Chat ID**:
   - Start a chat with your bot
   - Send a message to get your chat ID

### 3. Deploy to Render

#### Option A: Using Render Dashboard (Recommended)

1. **Sign up/Login to Render**: Go to [render.com](https://render.com)

2. **Connect GitHub**: Link your GitHub account

3. **Create New Web Service**:
   - Click "New" → "Web Service"
   - Connect your `ema5` repository
   - Choose your repository from the list

4. **Configure Deployment**:
   - **Name**: `ema5-alert-system`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Choose `Free` for testing

5. **Set Environment Variables**:
   Add these environment variables in Render dashboard:
   ```
   UPSTOX_ACCESS_TOKEN=your_upstox_access_token_here
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   TELEGRAM_CHAT_ID=your_telegram_chat_id_here
   INSTRUMENT_KEY=NSE_INDEX|NIFTY 50
   TIMEFRAME=5minute
   EMA_PERIOD=5
   LOG_LEVEL=info
   ALERT_COOLDOWN_MINUTES=2
   NODE_ENV=production
   PORT=10000
   ```

6. **Deploy**: Click "Create Web Service"

#### Option B: Using Render Blueprint (render.yaml)

1. **Fork/Upload** your repository to GitHub

2. **Create New Blueprint**:
   - In Render dashboard, click "New" → "Blueprint"
   - Connect your repository
   - Render will automatically detect the `render.yaml` file

3. **Set Environment Variables**:
   - Set the same environment variables as listed above
   - The `render.yaml` file already has the basic configuration

### 4. Monitor Your Deployment

1. **Check Logs**: 
   - Go to your service in Render dashboard
   - Click on "Logs" tab to monitor startup and runtime logs

2. **Health Check**:
   - Your service will be available at: `https://your-service-name.onrender.com`
   - Health endpoint: `https://your-service-name.onrender.com/health`

3. **Test Alerts**:
   - The system will start monitoring during Indian market hours (9:15 AM - 3:30 PM IST)
   - Check your Telegram for alerts

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `UPSTOX_ACCESS_TOKEN` | Your Upstox API access token | - | ✅ Yes |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | - | ✅ Yes |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | - | ✅ Yes |
| `INSTRUMENT_KEY` | Trading instrument | `NSE_INDEX\|NIFTY 50` | No |
| `TIMEFRAME` | Chart timeframe | `5minute` | No |
| `EMA_PERIOD` | EMA calculation period | `5` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `ALERT_COOLDOWN_MINUTES` | Alert cooldown period | `2` | No |
| `PORT` | Server port | `10000` | No |

### Strategy Settings

The system implements a two-stage strategy:

1. **Stage 1 - Alert Candle**: Detects candles where all OHLC values are above EMA(5)
2. **Stage 2 - PUT Signal**: Triggers when price breaks below the Alert Candle low

## 📊 Monitoring

### Health Endpoints

- **Main Page**: `https://your-service.onrender.com/`
- **Health Check**: `https://your-service.onrender.com/health`

### Logs

Monitor your application through:
- Render dashboard logs
- Telegram notifications
- Health endpoint status

## 🚨 Troubleshooting

### Common Issues

1. **Service Won't Start**:
   - Check environment variables are set correctly
   - Verify API tokens are valid
   - Check logs for specific error messages

2. **No Telegram Messages**:
   - Verify bot token and chat ID
   - Check if bot is blocked or removed
   - Ensure you've started a conversation with the bot

3. **API Errors**:
   - Check Upstox access token validity
   - Verify rate limits aren't exceeded
   - Ensure market hours are correct (IST timezone)

4. **Health Check Failing**:
   - Service should respond on port 10000
   - Check if the health endpoint returns 200 status

### Free Tier Limitations

Render's free tier has some limitations:
- Service may sleep after 15 minutes of inactivity
- 750 hours per month limit
- Service may take 30+ seconds to wake up

For production use, consider upgrading to a paid plan for always-on service.

## 🔄 Updates and Maintenance

### Updating Your Deployment

1. **Push Changes**: Commit and push changes to your GitHub repository
2. **Auto-Deploy**: Render will automatically redeploy when you push to the main branch
3. **Manual Deploy**: You can also trigger manual deploys from the Render dashboard

### Monitoring Performance

- Check service logs regularly
- Monitor alert frequency and accuracy
- Keep track of API rate limits
- Update access tokens when they expire

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review application logs in Render dashboard
3. Verify all environment variables are correct
4. Test API connections manually if needed

## 🎯 Next Steps

After successful deployment:
1. Monitor the system during market hours
2. Fine-tune alert parameters based on performance
3. Consider setting up alerting for system health
4. Upgrade to paid plan for production use

---

**⚠️ Important**: This system is for educational purposes only. Always practice proper risk management when trading.
