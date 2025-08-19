# Real-Time Nifty 50 Data Integration Guide

This document explains how to integrate real-time Nifty 50 data with your EMA(5) Alert System.

## 🚀 Available Data Sources

### Option 1: Upstox API (Recommended for Indian Markets)
- **File**: `bot.js`
- **Features**: Real-time WebSocket + Historical data
- **Cost**: Paid (requires Upstox account)
- **Data Quality**: High-quality Indian market data
- **Update Frequency**: Real-time (sub-second updates)

### Option 2: Alpha Vantage API (Free Alternative)
- **File**: `bot-alphavantage.js`
- **Features**: Real-time intraday data
- **Cost**: Free (with API limits)
- **Data Quality**: Good international coverage
- **Update Frequency**: Every minute

## 📋 Setup Instructions

### For Upstox (bot.js):

1. **Get Upstox API Access**:
   ```
   - Visit: https://upstox.com/developer/
   - Create developer account
   - Generate access token
   ```

2. **Install Dependencies**:
   ```powershell
   npm install ws
   ```

3. **Configure Environment**:
   ```bash
   # .env file
   UPSTOX_ACCESS_TOKEN=your_upstox_access_token
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   INSTRUMENT_KEY=NSE_INDEX|NIFTY 50
   TIMEFRAME=5minute
   EMA_PERIOD=5
   ```

4. **Run the Bot**:
   ```powershell
   npm start
   ```

### For Alpha Vantage (bot-alphavantage.js):

1. **Get Alpha Vantage API Key**:
   ```
   - Visit: https://www.alphavantage.co/support/#api-key
   - Get free API key (500 requests/day)
   ```

2. **Configure Environment**:
   ```bash
   # .env file
   ALPHA_VANTAGE_API_KEY=your_api_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   SYMBOL=NSEI
   TIMEFRAME=5min
   EMA_PERIOD=5
   ```

3. **Run the Alpha Vantage Bot**:
   ```powershell
   node bot-alphavantage.js
   ```

## 🔄 Real-Time Features

### Upstox WebSocket Features:
- ✅ Sub-second price updates
- ✅ Automatic reconnection
- ✅ Fallback to REST API
- ✅ Real-time candle formation
- ✅ Indian market hours optimization

### Alpha Vantage Features:
- ✅ Minute-by-minute updates
- ✅ Global quote for current price
- ✅ Free tier available
- ✅ No WebSocket complexity
- ✅ Reliable uptime

## 📊 Data Quality Comparison

| Feature | Upstox | Alpha Vantage |
|---------|--------|---------------|
| Real-time Updates | Sub-second | 1 minute |
| Indian Market Focus | ✅ Excellent | ⚠️ Good |
| Cost | 💰 Paid | 🆓 Free |
| API Limits | High | 500/day free |
| WebSocket Support | ✅ Yes | ❌ No |
| Reliability | ✅ High | ✅ High |

## 🛠️ Technical Implementation

### Upstox WebSocket Implementation:
```javascript
// Real-time WebSocket connection
const connectWebSocket = async () => {
    const wsResponse = await axios.get('https://api.upstox.com/v2/feed/market-data-feed/authorize');
    const wsUrl = wsResponse.data.data.authorizedRedirectUri;
    
    ws = new WebSocket(wsUrl);
    
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        // Process real-time price updates
        processRealTimePrice(message);
    });
};
```

### Alpha Vantage Implementation:
```javascript
// Fetch intraday data
const fetchRealTimeData = async () => {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${SYMBOL}&interval=${TIMEFRAME}&apikey=${API_KEY}`;
    
    const response = await axios.get(url);
    const timeSeries = response.data[`Time Series (${TIMEFRAME})`];
    
    // Process candle data
    processStrategy(candles);
};
```

## 🚨 Strategy Features (Both Implementations)

### Two-Stage Alert System:
1. **Stage 1 - Alert Candle Detection**:
   - All OHLC values above EMA(5)
   - Real-time monitoring
   - Telegram notification sent

2. **Stage 2 - Breakdown Signal**:
   - Price breaks below Alert Candle low
   - PUT signal triggered
   - Immediate notification

### Real-Time Enhancements:
- 🔄 Live price monitoring during Stage 2
- 📊 Dynamic candle updates
- ⚡ Faster signal generation
- 🎯 Improved entry timing

## 📱 Telegram Notifications

Both implementations send rich notifications:

```
✅ ALERT CANDLE DETECTED

📈 Nifty 50 - 5MIN Chart
🕐 Time: 19/08/2025, 14:25

📊 Candle Details:
   Open: 24,850.75
   High: 24,865.20
   Low: 24,845.30
   Close: 24,860.10

📉 EMA(5): 24,840.50

✅ Entire candle is ABOVE EMA(5)
🎯 Watching for breakdown below: 24,845.30

💡 Strong bullish momentum detected!
```

## 🔧 Troubleshooting

### Common Issues:

1. **WebSocket Connection Failed (Upstox)**:
   ```
   Solution: Check access token validity
   Fallback: System automatically uses REST API
   ```

2. **Alpha Vantage Rate Limit**:
   ```
   Error: "Thank you for using Alpha Vantage!"
   Solution: Wait for rate limit reset or upgrade plan
   ```

3. **No Data Received**:
   ```
   Check: Market hours (9:15 AM - 3:30 PM IST)
   Verify: Symbol/Instrument key is correct
   ```

## 🚀 Getting Started

1. **Choose your data source** based on budget and requirements
2. **Follow setup instructions** for your chosen option
3. **Test with demo mode** first
4. **Monitor logs** for successful connection
5. **Verify Telegram notifications** are working

## 📈 Performance Tips

- Use Upstox for professional trading (better latency)
- Use Alpha Vantage for learning/testing (free tier)
- Monitor during market hours for best results
- Enable debug logging initially: `LOG_LEVEL=debug`

## 🔒 Security Notes

- Never commit API keys to version control
- Use environment variables for all secrets
- Regularly rotate access tokens
- Monitor API usage limits

## 📞 Support

For technical issues:
1. Check logs first (`LOG_LEVEL=debug`)
2. Verify API credentials
3. Test network connectivity
4. Review market hours

Both implementations provide comprehensive real-time monitoring with professional-grade alerts for your Nifty 50 trading strategy!
