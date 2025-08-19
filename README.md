# EMA(5) Alert System for Nifty 50 (Two-Stage Strategy)

A sophisticated Node.js-based automated trading alert system that monitors Nifty 50 index in real-time using 5-minute timeframe data. The system implements a two-stage strategy: **Alert Candle Detection** followed by **PUT Entry Signal** based on breakdown patterns, all powered by EMA(5) technical analysis.

## 🎯 Features

- **Two-Stage Strategy**: Alert Candle detection + PUT breakdown signals
- **Real-time Monitoring**: Fetches 5-minute OHLC data from Upstox API  
- **EMA(5) Calculation**: Calculates 5-period Exponential Moving Average
- **Stage 1 - Alert Candle**: Identifies candles with all OHLC values above EMA(5)
- **Stage 2 - PUT Signal**: Triggers when price breaks below Alert Candle low
- **Telegram Integration**: Sends formatted alerts for both stages
- **Market Hours Aware**: Only operates during Indian market hours (9:15 AM - 3:30 PM IST)
- **Smart State Management**: Tracks Alert Candles and monitors breakdowns
- **Alert Cooldown**: Prevents spam with configurable cooldown periods
- **Robust Error Handling**: Comprehensive error management and logging
- **Production Ready**: Built for deployment with PM2 or Windows services System for Nifty Futures

A Node.js-based automated alert system that monitors Nifty 50 Futures in real-time and generates trading signals based on EMA(5) technical analysis. The system sends instant alerts via Telegram when specific candlestick conditions are met.

## 🎯 Features

- **Real-time Monitoring**: Fetches 1-minute OHLC data from Upstox API
- **EMA(5) Calculation**: Calculates 5-period Exponential Moving Average
- **Signal Detection**: Identifies candles with all OHLC values above EMA(5)
- **Telegram Alerts**: Sends formatted alerts to your Telegram chat
- **Market Hours Aware**: Only operates during Indian market hours (9:15 AM - 3:30 PM IST)
- **Alert Cooldown**: Prevents spam with configurable cooldown periods
- **Error Handling**: Robust error handling with detailed logging
- **Graceful Shutdown**: Clean process termination

## 📋 Prerequisites

- Node.js 14.0.0 or higher
- Upstox Developer Account with API access
- Telegram Bot Token
- Basic understanding of financial markets and EMA indicators

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Navigate to your project directory
cd "c:\Users\nigkumar\Desktop\Project\Personal Project\Ema5"

# Install dependencies
npm install
```

### 2. Environment Setup

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` file with your credentials:
   ```env
   # Upstox API Configuration
   UPSTOX_ACCESS_TOKEN=your_upstox_access_token_here
   
   # Telegram Bot Configuration
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   TELEGRAM_CHAT_ID=your_telegram_chat_id_here
   
   # Instrument Configuration (Nifty 50 Index - 5 minute timeframe)
   INSTRUMENT_KEY=NSE_INDEX|NIFTY 50
   TIMEFRAME=5minute
   EMA_PERIOD=5
   
   # Optional Settings
   LOG_LEVEL=info
   ALERT_COOLDOWN_MINUTES=2
   ```

### 3. Setup Instructions

#### Option A: Automatic Token Refresh (Recommended)

**Set up once and never worry about token expiry again!**

1. **Get OAuth Credentials**:
   - Visit [Upstox Developer Console](https://api.upstox.com/developer-console)
   - Create a new app or use existing one
   - Set Redirect URI: `http://localhost:3000/callback`
   - Copy your Client ID and Client Secret

2. **Run Setup Script**:
   ```bash
   npm run setup-tokens
   ```
   
3. **Follow the prompts**:
   - Enter your Client ID and Client Secret
   - Open the authorization URL in your browser
   - Complete OAuth flow and get authorization code
   - Paste the code back into the script

4. **Done!** Your tokens will now automatically refresh every day.

#### Option B: Manual Token Updates (Not Recommended)

1. Register at [Upstox Developer Console](https://api.upstox.com/)
2. Create a new app and get your API credentials
3. Generate an access token using the OAuth flow
4. Add the access token to your `.env` file
5. **Note**: You'll need to manually update tokens daily

#### Telegram Bot Setup:
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot with `/newbot` command
3. Copy the bot token to your `.env` file
4. Get your chat ID:
   - Add your bot to a group/channel, or
   - Use [@userinfobot](https://t.me/userinfobot) to get your personal chat ID
5. Add the chat ID to your `.env` file

### 4. Run the Application

```bash
# Start the application
npm start

# For development with debug logs
LOG_LEVEL=debug npm start
```

## 🔧 Token Management Commands

With automatic token refresh enabled, you have these commands available:

```bash
# Complete setup for automatic token refresh (run once)
npm run setup-tokens

# Check current token status and expiry
npm run check-token

# Manually refresh token if needed
npm run refresh-token

# Test your configuration
npm run test-config
```

**Example token status check:**
```
🔍 Current Token Status:
Expired: ✅ NO
Needs Refresh: ✅ NO
Expires At: 19/8/2025, 11:30:00 pm
Time Until Expiry: 8h 45m
```

## 📊 How It Works

### Two-Stage Strategy Logic:

#### **Stage 1: Alert Candle Detection**
1. **Data Collection**: Fetches the latest 6 five-minute candles from Upstox
2. **EMA Calculation**: Calculates EMA(5) using the first 5 candles' close prices  
3. **Alert Candle Check**: Verifies if the 6th candle has ALL OHLC values above EMA(5)
4. **Alert Generation**: Sends "Alert Candle Detected" notification via Telegram
5. **State Management**: Records the Alert Candle's low for Stage 2 monitoring

#### **Stage 2: PUT Entry Signal**
1. **Continuous Monitoring**: Watches subsequent 5-minute candles after Alert Candle
2. **Breakdown Detection**: Checks if any new candle's low breaks below Alert Candle low
3. **PUT Signal**: Triggers "PUT Signal Triggered" notification when breakdown occurs
4. **State Reset**: Clears monitoring state after PUT signal or new Alert Candle

### Mathematical Conditions:

**Alert Candle Criteria:**
```
Open > EMA(5) AND
High > EMA(5) AND  
Low > EMA(5) AND
Close > EMA(5)
```

**PUT Entry Criteria:**
```
Current Candle Low < Alert Candle Low
```

### Alert Formats:

#### Stage 1 - Alert Candle:
```
✅ ALERT CANDLE DETECTED

📈 Nifty 50 - 5MINUTE Chart
🕐 Time: 02/08/2025, 14:30
📊 OHLC: 24850.50 | 24865.75 | 24845.25 | 24860.00
📉 EMA(5): 24835.42

✅ All OHLC values are above EMA(5)
🎯 Watching for breakdown below: 24845.25

💡 Strong bullish momentum detected!
🔻 Monitoring for PUT entry signal...
```

#### Stage 2 - PUT Signal:
```
🔻 PUT SIGNAL TRIGGERED

📉 Nifty 50 Breakdown Alert  
🕐 Entry Time: 02/08/2025, 14:45
💥 Entry Price: 24840.50
📍 Alert Candle Low: 24845.25
⏰ Alert Time: 02/08/2025, 14:30

🔻 Nifty 50 broke below Alert Candle low
🎯 PUT Entry Opportunity Detected
```

## ⚙️ Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `UPSTOX_ACCESS_TOKEN` | Required | Your Upstox API access token |
| `TELEGRAM_BOT_TOKEN` | Required | Your Telegram bot token |
| `TELEGRAM_CHAT_ID` | Required | Telegram chat/group ID for alerts |
| `INSTRUMENT_KEY` | `NSE_INDEX\|NIFTY 50` | Trading instrument to monitor |
| `TIMEFRAME` | `5minute` | Candlestick timeframe (5minute recommended) |
| `EMA_PERIOD` | `5` | EMA period for calculation |
| `LOG_LEVEL` | `info` | Logging level (info/debug/error) |
| `ALERT_COOLDOWN_MINUTES` | `2` | Minutes between duplicate alerts |## 🔧 Production Deployment

### Using PM2 (Recommended):

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start bot.js --name "ema5-alerts"

# Monitor logs
pm2 logs ema5-alerts

# Auto-restart on system reboot
pm2 startup
pm2 save
```

### Windows Service:

```bash
# Install node-windows (run as administrator)
npm install -g node-windows

# Create a service script (service.js)
# Then install as Windows service
```

## 📝 Logs and Monitoring

The application provides detailed logging:

- `ℹ️` Info: General application status
- `🔍` Debug: Detailed execution information (LOG_LEVEL=debug)
- `✅` Success: Successful operations
- `❌` Error: Error conditions and failures

## ⚠️ Important Notes

### Risk Disclaimer:
- This tool is for **educational purposes only**
- **Not financial advice** - always do your own research
- Use proper risk management and position sizing
- Test thoroughly before using with real money

### Technical Considerations:
- Runs only during market hours (9:15 AM - 3:30 PM IST)
- Requires stable internet connection
- API rate limits may apply
- Market data delays may occur

### Data Requirements:
- Minimum 6 five-minute candles needed for analysis
- EMA calculation requires 5 historical close prices  
- Alert Candle detection uses the most recent complete candle
- PUT signal monitoring continues until breakdown or new Alert Candle

### Strategy Rules:
- **Alert Candle Replacement**: New Alert Candle replaces previous one
- **State Management**: PUT signal resets the monitoring state  
- **Cooldown Protection**: Prevents duplicate notifications within timeframe
- **Market Hours Only**: Operates during Indian market hours (9:15 AM - 3:30 PM IST)
- **5-Minute Timeframe**: Optimized for 5-minute Nifty 50 index data

## 🔄 Future Enhancements

- [ ] **Multiple Timeframes**: Support for 1-minute, 15-minute, 30-minute candles
- [ ] **Stop Loss Integration**: Automatic stop-loss calculations for PUT signals  
- [ ] **Multiple Instruments**: Monitor multiple stocks/indices simultaneously
- [ ] **Backtesting Module**: Historical strategy performance analysis
- [ ] **Web Dashboard**: Real-time monitoring interface with charts
- [ ] **Advanced Filters**: Volume, volatility, and momentum-based filtering  
- [ ] **Position Sizing**: Dynamic position size calculations
- [ ] **Database Logging**: Store all signals and performance metrics
- [ ] **Mobile App**: Native mobile application for alerts
- [ ] **Paper Trading**: Simulate trades based on signals without real money

## 🛠️ Troubleshooting

### Common Issues:

**"Authentication failed"**
- Check your Upstox access token
- Ensure token hasn't expired
- Verify API permissions

**"Not enough candle data"**
- Wait for market hours
- Check if instrument key is correct
- Verify market is open

**"Telegram alert failed"**
- Verify bot token is correct
- Check if bot is added to the group/chat
- Ensure chat ID is accurate

**"Rate limit exceeded"**
- Reduce monitoring frequency
- Check Upstox API rate limits
- Consider using WebSocket for real-time data

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs for error messages
3. Verify all environment variables
4. Test with debug logging enabled

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Disclaimer**: This software is provided "as is" without warranty. The authors are not responsible for any financial losses incurred through the use of this tool. Always trade responsibly and within your risk tolerance.
