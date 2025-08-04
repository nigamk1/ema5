require('dotenv').config();
const axios = require('axios');

// Configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;
const INSTRUMENT_KEY = encodeURIComponent(process.env.INSTRUMENT_KEY || 'NSE_INDEX|NIFTY 50');
const TIMEFRAME = process.env.TIMEFRAME || '5minute';
const EMA_PERIOD = parseInt(process.env.EMA_PERIOD) || 5;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const ALERT_COOLDOWN_MINUTES = parseInt(process.env.ALERT_COOLDOWN_MINUTES) || 2;

// Global state variables for two-stage strategy
let isRunning = false;
let lastAlertTime = null;
let alertCandle = null; // Stores the current alert candle info
let isWaitingForBreakdown = false; // Flag to track if we're monitoring for breakdown

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
    const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'UPSTOX_ACCESS_TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        log.error(`Missing required environment variables: ${missing.join(', ')}`);
        log.error('Please check your .env file. Use .env.example as a template.');
        process.exit(1);
    }
    
    log.info('Configuration validated successfully');
};

const fetchCandles = async () => {
    if (isRunning) {
        log.debug('Previous fetch still running, skipping...');
        return;
    }
    
    isRunning = true;
    
    try {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        const url = `https://api.upstox.com/v2/historical-candle/${INSTRUMENT_KEY}/${TIMEFRAME}/${today}/${today}`;
        
        log.debug(`Fetching ${TIMEFRAME} candles from: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            timeout: 10000 // 10 second timeout
        });

        const candles = response.data.data.candles;
        
        if (!candles || candles.length < (EMA_PERIOD + 1)) {
            log.info(`Not enough candle data. Available: ${candles?.length || 0}, Required: ${EMA_PERIOD + 1}`);
            return;
        }

        log.debug(`Processing ${candles.length} ${TIMEFRAME} candles`);
        
        // Process the two-stage strategy
        await processStrategy(candles);

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            log.error('Request timeout - Upstox API took too long to respond');
        } else if (error.response?.status === 401) {
            log.error('Authentication failed - Please check your Upstox access token');
        } else if (error.response?.status === 429) {
            log.error('Rate limit exceeded - Too many requests to Upstox API');
        } else {
            log.error(`Error fetching OHLC: ${error.response?.data?.message || error.message}`);
        }
    } finally {
        isRunning = false;
    }
};

const processStrategy = async (candles) => {
    try {
        // Get enough candles for EMA calculation plus current candle
        const minRequired = EMA_PERIOD + 10; // Extra buffer for accurate EMA
        if (candles.length < minRequired) {
            log.info(`Not enough candle data. Available: ${candles.length}, Required: ${minRequired}`);
            return;
        }
        
        // Get recent candles for EMA calculation
        const recentCandles = candles.slice(-minRequired);
        
        // Extract close prices for EMA calculation (all except the very latest)
        const closePrices = recentCandles.slice(0, -1).map(candle => parseFloat(candle[4]));
        
        // Calculate EMA(5) - we need the EMA value for the period before current candle
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
            // If we already have an alert candle, replace it with the new one
            if (alertCandle) {
                log.info(`New Alert Candle detected, replacing previous Alert Candle`);
            } else {
                log.info(`First Alert Candle detected for monitoring`);
            }
            
            // Set new Alert Candle (always replace with latest)
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
                log.info(`Alert Candle detected but within cooldown period (${ALERT_COOLDOWN_MINUTES}min). Last alert: ${lastAlertTime.toLocaleTimeString()}`);
            }
            
        } else if (isWaitingForBreakdown && alertCandle) {
            // Stage 2: Monitor for breakdown below Alert Candle low
            
            if (latestCandle.low < alertCandle.lowToWatch) {
                // Breakdown detected - PUT signal triggered
                log.signal(`🔻 PUT Signal triggered! Breakdown detected`);
                log.signal(`Current Low: ${latestCandle.low} < Alert Candle Low: ${alertCandle.lowToWatch}`);
                
                await sendPutSignalNotification(latestCandle, alertCandle);
                
                // Reset the state after PUT signal is sent
                isWaitingForBreakdown = false;
                alertCandle = null;
                lastAlertTime = new Date(); // Reset cooldown after PUT signal
                
                log.success(`PUT Signal sent and state reset`);
                
            } else {
                log.debug(`Monitoring: Current Low ${latestCandle.low} > Alert Low ${alertCandle.lowToWatch} (No breakdown yet)`);
            }
        } else {
            // No alert candle conditions met
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
    
    const k = 2 / (period + 1); // Smoothing factor
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

📈 *Nifty 50 - ${TIMEFRAME.toUpperCase()} Chart*
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
    const message = `🔻 *PUT SIGNAL TRIGGERED*

📉 *Nifty 50 Breakdown Alert*
🕐 Signal Time: ${currentCandle.timestamp}

💥 *Breakdown Details:*
   Current Low: ${currentCandle.low.toFixed(2)}
   Alert Candle Low: ${alertCandle.lowToWatch.toFixed(2)}
   Breakdown Amount: ${(alertCandle.lowToWatch - currentCandle.low).toFixed(2)} points

⏰ *Alert Candle Details:*
   Time: ${alertCandle.timestamp}
   OHLC: ${alertCandle.open.toFixed(2)} | ${alertCandle.high.toFixed(2)} | ${alertCandle.low.toFixed(2)} | ${alertCandle.close.toFixed(2)}

� *Current Candle:*
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
    
    // Market opens at 9:15 AM (915) and closes at 3:30 PM (1530)
    return currentTime >= 915 && currentTime <= 1530;
};

// Graceful shutdown handler
const gracefulShutdown = () => {
    log.info('Received shutdown signal. Cleaning up...');
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        log.info('Monitoring interval cleared');
    }
    
    // Reset strategy state
    alertCandle = null;
    isWaitingForBreakdown = false;
    
    log.info('EMA(5) Alert System for Nifty 50 stopped');
    process.exit(0);
};

// Main execution function
const main = async () => {
    log.info('🚀 Starting EMA(5) Alert System for Nifty 50');
    log.info(`📊 Monitoring: ${decodeURIComponent(INSTRUMENT_KEY)} (${TIMEFRAME})`);
    log.info(`📈 Strategy: EMA(${EMA_PERIOD}) Alert Candle + PUT Breakdown Signal`);
    log.info(`⏰ Alert cooldown: ${ALERT_COOLDOWN_MINUTES} minutes`);
    
    // Validate configuration
    validateConfig();
    
    // Test Telegram connection
    await testTelegramConnection();
    
    // Initial fetch
    log.info('Running initial candle fetch...');
    await fetchCandles();
    
    // Set up monitoring interval (matches the timeframe)
    const intervalMinutes = parseInt(TIMEFRAME.replace('minute', ''));
    const intervalMs = intervalMinutes * 60 * 1000;
    
    const monitoringInterval = setInterval(async () => {
        if (!isMarketHours()) {
            log.debug('Outside market hours, skipping fetch');
            return;
        }
        
        log.debug(`Running scheduled ${TIMEFRAME} candle fetch...`);
        await fetchCandles();
    }, intervalMs);
    
    log.info(`🔄 Monitoring started - running every ${intervalMinutes} minutes during market hours`);
    log.info('📱 Stage 1: Alert Candle detection (all OHLC > EMA)');
    log.info('📱 Stage 2: PUT signal on breakdown below Alert Candle low');
    
    return monitoringInterval;
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

// Handle process signals for graceful shutdown
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught exceptions
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
main().then((interval) => {
    monitoringInterval = interval;
}).catch((error) => {
    log.error(`Failed to start application: ${error.message}`);
    process.exit(1);
});
