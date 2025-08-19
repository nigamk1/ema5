require('dotenv').config();
const axios = require('axios');
const http = require('http');

// Configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const SYMBOL = process.env.SYMBOL || 'NSEI'; // Nifty 50 symbol
const TIMEFRAME = process.env.TIMEFRAME || '5min';
const EMA_PERIOD = parseInt(process.env.EMA_PERIOD) || 5;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const ALERT_COOLDOWN_MINUTES = parseInt(process.env.ALERT_COOLDOWN_MINUTES) || 2;
const PORT = process.env.PORT || 10000;

// Global state variables for two-stage strategy
let isRunning = false;
let lastAlertTime = null;
let alertCandle = null;
let isWaitingForBreakdown = false;
let candleData = [];

// Logging utility
const log = {
    info: (msg) => console.log(`ℹ️ [${new Date().toISOString()}] ${msg}`),
    debug: (msg) => LOG_LEVEL === 'debug' && console.log(`🔍 [${new Date().toISOString()}] ${msg}`),
    error: (msg) => console.error(`❌ [${new Date().toISOString()}] ${msg}`),
    success: (msg) => console.log(`✅ [${new Date().toISOString()}] ${msg}`),
    signal: (msg) => console.log(`🚨 [${new Date().toISOString()}] ${msg}`)
};

// Validate required environment variables
const validateConfig = () => {
    const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ALPHA_VANTAGE_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        log.error(`Missing required environment variables: ${missing.join(', ')}`);
        log.error('Please check your .env file. Add ALPHA_VANTAGE_API_KEY=your_key_here');
        process.exit(1);
    }
    
    log.info('Configuration validated successfully');
};

// Fetch real-time data from Alpha Vantage
const fetchRealTimeData = async () => {
    if (isRunning) {
        log.debug('Previous fetch still running, skipping...');
        return;
    }
    
    isRunning = true;
    
    try {
        // Alpha Vantage intraday data API
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${SYMBOL}&interval=${TIMEFRAME}&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=compact`;
        
        log.debug(`Fetching ${TIMEFRAME} data from Alpha Vantage: ${SYMBOL}`);
        
        const response = await axios.get(url, {
            timeout: 15000 // 15 second timeout
        });

        const data = response.data;
        
        if (data['Error Message']) {
            log.error(`Alpha Vantage API Error: ${data['Error Message']}`);
            return;
        }
        
        if (data['Note']) {
            log.error(`Alpha Vantage API Limit: ${data['Note']}`);
            return;
        }
        
        const timeSeries = data[`Time Series (${TIMEFRAME})`];
        
        if (!timeSeries) {
            log.error('No time series data received from Alpha Vantage');
            return;
        }

        // Convert Alpha Vantage data to our candle format
        const candles = Object.entries(timeSeries)
            .sort(([a], [b]) => new Date(a) - new Date(b)) // Sort by time ascending
            .map(([timestamp, ohlcv]) => [
                new Date(timestamp).toISOString(),
                parseFloat(ohlcv['1. open']),
                parseFloat(ohlcv['2. high']),
                parseFloat(ohlcv['3. low']),
                parseFloat(ohlcv['4. close'])
            ]);

        if (!candles || candles.length < (EMA_PERIOD + 1)) {
            log.info(`Not enough candle data. Available: ${candles?.length || 0}, Required: ${EMA_PERIOD + 1}`);
            return;
        }

        log.debug(`Processing ${candles.length} ${TIMEFRAME} candles from Alpha Vantage`);
        
        // Store candle data
        candleData = candles;
        
        // Process the two-stage strategy
        await processStrategy(candles);

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            log.error('Request timeout - Alpha Vantage API took too long to respond');
        } else if (error.response?.status === 429) {
            log.error('Rate limit exceeded - Too many requests to Alpha Vantage API');
        } else {
            log.error(`Error fetching data: ${error.response?.data?.message || error.message}`);
        }
    } finally {
        isRunning = false;
    }
};

// Get current price from Alpha Vantage Global Quote
const getCurrentPrice = async () => {
    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${SYMBOL}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        
        const response = await axios.get(url, {
            timeout: 10000
        });

        const quote = response.data['Global Quote'];
        
        if (quote && quote['05. price']) {
            const currentPrice = parseFloat(quote['05. price']);
            log.debug(`Current price from Alpha Vantage: ${currentPrice}`);
            return currentPrice;
        }
        
        return null;
    } catch (error) {
        log.error(`Error fetching current price: ${error.message}`);
        return null;
    }
};

const processStrategy = async (candles) => {
    try {
        // Get enough candles for EMA calculation plus current candle
        const minRequired = EMA_PERIOD + 10;
        if (candles.length < minRequired) {
            log.info(`Not enough candle data. Available: ${candles.length}, Required: ${minRequired}`);
            return;
        }
        
        // Get recent candles for EMA calculation
        const recentCandles = candles.slice(-minRequired);
        
        // Extract close prices for EMA calculation (all except the very latest)
        const closePrices = recentCandles.slice(0, -1).map(candle => parseFloat(candle[4]));
        
        // Calculate EMA(5)
        const emaValues = calculateEMA(closePrices, EMA_PERIOD);
        const currentEMA = emaValues[emaValues.length - 1];
        
        // Get the latest completed candle for analysis
        const [timestamp, open, high, low, close] = recentCandles[recentCandles.length - 1];
        const latestCandle = {
            timestamp: new Date(timestamp).toLocaleString('en-IN', { 
                timeZone: 'Asia/Kolkata',
                hour12: false,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            rawTimestamp: timestamp,
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close)
        };
        
        log.debug(`Latest candle: O:${latestCandle.open} H:${latestCandle.high} L:${latestCandle.low} C:${latestCandle.close}`);
        log.debug(`Current EMA(${EMA_PERIOD}): ${currentEMA.toFixed(2)}`);
        
        // TWO-STAGE STRATEGY IMPLEMENTATION
        
        // Stage 1: Check for Alert Candle (ALL OHLC completely above EMA)
        const isAlertCandle = latestCandle.open > currentEMA && 
                             latestCandle.high > currentEMA && 
                             latestCandle.low > currentEMA && 
                             latestCandle.close > currentEMA;
        
        if (isAlertCandle) {
            if (alertCandle) {
                log.info(`New Alert Candle detected, replacing previous Alert Candle`);
            } else {
                log.info(`First Alert Candle detected for monitoring`);
            }
            
            alertCandle = {
                ...latestCandle,
                emaValue: currentEMA,
                lowToWatch: latestCandle.low
            };
            
            isWaitingForBreakdown = true;
            
            // Send Alert Candle notification (with cooldown)
            const now = new Date();
            if (!lastAlertTime || (now - lastAlertTime) >= (ALERT_COOLDOWN_MINUTES * 60 * 1000)) {
                await sendAlertCandleNotification(alertCandle);
                lastAlertTime = now;
                log.signal(`✅ Alert Candle notification sent! Low to watch: ${alertCandle.lowToWatch}`);
            } else {
                log.info(`Alert Candle detected but within cooldown period (${ALERT_COOLDOWN_MINUTES}min)`);
            }
            
        } else if (isWaitingForBreakdown && alertCandle) {
            // Stage 2: Monitor for breakdown below Alert Candle low
            // Get real-time price for more accurate breakdown detection
            const currentPrice = await getCurrentPrice();
            
            if (currentPrice && currentPrice < alertCandle.lowToWatch) {
                // Breakdown detected with real-time price
                log.signal(`🔻 PUT Signal triggered! Real-time breakdown detected`);
                log.signal(`Current Price: ${currentPrice} < Alert Candle Low: ${alertCandle.lowToWatch}`);
                
                await sendPutSignalNotification({...latestCandle, currentPrice}, alertCandle);
                
                // Reset the state after PUT signal is sent
                isWaitingForBreakdown = false;
                alertCandle = null;
                lastAlertTime = new Date();
                
                log.success(`PUT Signal sent and state reset`);
                
            } else if (latestCandle.low < alertCandle.lowToWatch) {
                // Breakdown detected with candle data
                log.signal(`🔻 PUT Signal triggered! Candle breakdown detected`);
                log.signal(`Current Low: ${latestCandle.low} < Alert Candle Low: ${alertCandle.lowToWatch}`);
                
                await sendPutSignalNotification(latestCandle, alertCandle);
                
                // Reset the state
                isWaitingForBreakdown = false;
                alertCandle = null;
                lastAlertTime = new Date();
                
                log.success(`PUT Signal sent and state reset`);
                
            } else {
                log.debug(`Monitoring: Current Low ${latestCandle.low} > Alert Low ${alertCandle.lowToWatch} (No breakdown yet)`);
            }
        } else {
            log.debug(`No Alert Candle: O:${latestCandle.open > currentEMA ? '✓' : '✗'} H:${latestCandle.high > currentEMA ? '✓' : '✗'} L:${latestCandle.low > currentEMA ? '✓' : '✗'} C:${latestCandle.close > currentEMA ? '✓' : '✗'} vs EMA:${currentEMA.toFixed(2)}`);
        }
        
        // Log current monitoring state
        if (isWaitingForBreakdown && alertCandle) {
            log.info(`📊 Status: Monitoring breakdown below ${alertCandle.lowToWatch} (Alert from ${alertCandle.timestamp})`);
        } else {
            log.debug(`📊 Status: Waiting for new Alert Candle (all OHLC > EMA)`);
        }

    } catch (error) {
        log.error(`Error in strategy processing: ${error.message}`);
        log.error(error.stack);
    }
};

const calculateEMA = (prices, period) => {
    if (!prices || prices.length < period) {
        throw new Error(`Insufficient data for EMA calculation. Required: ${period}, Available: ${prices?.length || 0}`);
    }
    
    const k = 2 / (period + 1);
    let emaArray = [];
    
    // Initialize with SMA for the first period
    let sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    emaArray[period - 1] = sma;

    // Calculate EMA for remaining periods
    for (let i = period; i < prices.length; i++) {
        const ema = prices[i] * k + emaArray[i - 1] * (1 - k);
        emaArray[i] = ema;
    }
    
    return emaArray;
};

const sendAlertCandleNotification = async (candle) => {
    const message = `✅ *ALERT CANDLE DETECTED*

📈 *Nifty 50 - ${TIMEFRAME.toUpperCase()} Chart* (Alpha Vantage)
🕐 Time: ${candle.timestamp}

📊 *Candle Details:*
   Open: ${candle.open.toFixed(2)}
   High: ${candle.high.toFixed(2)}
   Low: ${candle.low.toFixed(2)}
   Close: ${candle.close.toFixed(2)}

📉 EMA(${EMA_PERIOD}): ${candle.emaValue.toFixed(2)}

✅ *Entire candle is ABOVE EMA(${EMA_PERIOD})*
🎯 *Watching for breakdown below: ${candle.lowToWatch.toFixed(2)}*

💡 Strong bullish momentum detected!
🔻 Will alert when price breaks below ${candle.lowToWatch.toFixed(2)}

⚠️ This is for educational purposes only`;

    await sendTelegramMessage(message);
    log.success(`Alert Candle notification sent`);
};

const sendPutSignalNotification = async (currentCandle, alertCandle) => {
    const currentPrice = currentCandle.currentPrice || currentCandle.close;
    const breakdownAmount = alertCandle.lowToWatch - currentPrice;
    
    const message = `🔻 *PUT SIGNAL TRIGGERED*

📉 *Nifty 50 Breakdown Alert* (Alpha Vantage)
🕐 Signal Time: ${currentCandle.timestamp}

💥 *Breakdown Details:*
   Current Price: ${currentPrice.toFixed(2)}
   Alert Candle Low: ${alertCandle.lowToWatch.toFixed(2)}
   Breakdown Amount: ${breakdownAmount.toFixed(2)} points

⏰ *Alert Candle Details:*
   Time: ${alertCandle.timestamp}
   OHLC: ${alertCandle.open.toFixed(2)} | ${alertCandle.high.toFixed(2)} | ${alertCandle.low.toFixed(2)} | ${alertCandle.close.toFixed(2)}

📊 *Current Candle:*
   OHLC: ${currentCandle.open.toFixed(2)} | ${currentCandle.high.toFixed(2)} | ${currentCandle.low.toFixed(2)} | ${currentCandle.close.toFixed(2)}

🎯 *PUT Entry Opportunity*
💡 Consider buying PUT options at current levels

⚠️ This is for educational purposes only`;

    await sendTelegramMessage(message);
    log.success(`PUT Signal notification sent`);
};

const sendTelegramMessage = async (message) => {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    try {
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        }, {
            timeout: 5000
        });
        
        if (response.data.ok) {
            log.debug(`Message sent successfully to Telegram`);
        } else {
            log.error(`Telegram API error: ${response.data.description}`);
        }
        
    } catch (error) {
        if (error.response?.status === 400) {
            log.error('Invalid Telegram bot token or chat ID');
        } else if (error.response?.status === 403) {
            log.error('Bot was blocked by the user or removed from the group');
        } else {
            log.error(`Telegram message failed: ${error.message}`);
        }
        throw error;
    }
};

// Market hours check (Indian market: 9:15 AM to 3:30 PM IST)
const isMarketHours = () => {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    return currentTime >= 915 && currentTime <= 1530;
};

// Create HTTP server for health checks
const createHealthServer = () => {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                service: 'EMA(5) Alert System - Alpha Vantage',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                isMarketHours: isMarketHours(),
                alertCandle: alertCandle ? 'Active' : 'None',
                waitingForBreakdown: isWaitingForBreakdown,
                dataSource: 'Alpha Vantage'
            }));
        } else if (req.url === '/' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <head><title>EMA(5) Alert System - Alpha Vantage</title></head>
                    <body>
                        <h1>🚀 EMA(5) Alert System for Nifty 50</h1>
                        <p><strong>Data Source:</strong> Alpha Vantage</p>
                        <p><strong>Status:</strong> Running</p>
                        <p><strong>Market Hours:</strong> ${isMarketHours() ? 'Open' : 'Closed'}</p>
                        <p><strong>Alert Candle:</strong> ${alertCandle ? 'Active' : 'None'}</p>
                        <p><strong>Waiting for Breakdown:</strong> ${isWaitingForBreakdown ? 'Yes' : 'No'}</p>
                        <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
                        <hr>
                        <p>Real-time Nifty 50 monitoring with Alpha Vantage API</p>
                        <p>Symbol: ${SYMBOL} | Timeframe: ${TIMEFRAME}</p>
                    </body>
                </html>
            `);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    server.listen(PORT, () => {
        log.info(`🌐 Health server running on port ${PORT}`);
        log.info(`🏥 Health check available at: http://localhost:${PORT}/health`);
    });

    return server;
};

// Test Telegram connection
const testTelegramConnection = async () => {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data.ok) {
            log.success(`Telegram bot connected: @${response.data.result.username}`);
        } else {
            throw new Error('Invalid bot token');
        }
    } catch (error) {
        log.error('Failed to connect to Telegram bot. Please check your bot token.');
        throw error;
    }
};

// Graceful shutdown handler
const gracefulShutdown = () => {
    log.info('Received shutdown signal. Cleaning up...');
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        log.info('Monitoring interval cleared');
    }
    
    if (healthServer) {
        healthServer.close(() => {
            log.info('Health server closed');
        });
    }
    
    alertCandle = null;
    isWaitingForBreakdown = false;
    candleData = [];
    
    log.info('EMA(5) Alert System stopped');
    process.exit(0);
};

// Main execution function
const main = async () => {
    log.info('🚀 Starting EMA(5) Alert System for Nifty 50 with Alpha Vantage');
    log.info(`📊 Monitoring: ${SYMBOL} (${TIMEFRAME})`);
    log.info(`📈 Strategy: EMA(${EMA_PERIOD}) Alert Candle + PUT Breakdown Signal`);
    log.info(`⏰ Alert cooldown: ${ALERT_COOLDOWN_MINUTES} minutes`);
    
    validateConfig();
    
    const healthServer = createHealthServer();
    
    await testTelegramConnection();
    
    log.info('Fetching initial data from Alpha Vantage...');
    await fetchRealTimeData();
    
    // Set up monitoring interval - Alpha Vantage updates every minute
    const intervalMs = 60 * 1000; // 1 minute for real-time monitoring
    
    const monitoringInterval = setInterval(async () => {
        if (!isMarketHours()) {
            log.debug('Outside market hours, skipping fetch');
            return;
        }
        
        log.debug(`Running scheduled Alpha Vantage data fetch...`);
        await fetchRealTimeData();
    }, intervalMs);
    
    log.info(`🔄 Real-time monitoring started - Alpha Vantage data every minute`);
    log.info('📱 Stage 1: Alert Candle detection (all OHLC > EMA)');
    log.info('📱 Stage 2: PUT signal on breakdown below Alert Candle low');
    
    return { monitoringInterval, healthServer };
};

// Handle process signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (error) => {
    log.error(`Uncaught Exception: ${error.message}`);
    log.error(error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

// Start the application
let monitoringInterval;
let healthServer;
main().then((services) => {
    monitoringInterval = services.monitoringInterval;
    healthServer = services.healthServer;
}).catch((error) => {
    log.error(`Failed to start application: ${error.message}`);
    process.exit(1);
});
