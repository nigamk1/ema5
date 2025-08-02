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
        // Get the most recent candles for analysis
        const recentCandles = candles.slice(-(EMA_PERIOD + 1)); // EMA_PERIOD + 1 for current candle
        
        // Extract close prices for EMA calculation (excluding the latest candle)
        const closePrices = recentCandles.slice(0, EMA_PERIOD).map(candle => parseFloat(candle[4]));
        
        // Calculate EMA(5)
        const emaValue = calculateEMA(closePrices, EMA_PERIOD);
        const currentEMA = emaValue[emaValue.length - 1];
        
        // Get the latest candle for analysis
        const [timestamp, open, high, low, close] = recentCandles[EMA_PERIOD];
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
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close)
        };
        
        log.debug(`Latest candle: O:${latestCandle.open} H:${latestCandle.high} L:${latestCandle.low} C:${latestCandle.close}`);
        log.debug(`Current EMA(${EMA_PERIOD}): ${currentEMA.toFixed(2)}`);
        
        // TWO-STAGE STRATEGY IMPLEMENTATION
        
        // Stage 1: Check for Alert Candle (all OHLC above EMA)
        const isAlertCandle = latestCandle.open > currentEMA && 
                             latestCandle.high > currentEMA && 
                             latestCandle.low > currentEMA && 
                             latestCandle.close > currentEMA;
        
        if (isAlertCandle && !isWaitingForBreakdown) {
            // New Alert Candle detected
            alertCandle = {
                ...latestCandle,
                emaValue: currentEMA,
                lowToWatch: latestCandle.low
            };
            
            isWaitingForBreakdown = true;
            
            // Check alert cooldown for Alert Candle notifications
            const now = new Date();
            if (!lastAlertTime || (now - lastAlertTime) >= (ALERT_COOLDOWN_MINUTES * 60 * 1000)) {
                await sendAlertCandleNotification(alertCandle);
                lastAlertTime = now;
            } else {
                log.info(`Alert Candle detected but within cooldown period. Last alert: ${lastAlertTime.toLocaleTimeString()}`);
            }
            
            log.signal(`Alert Candle identified! Low to watch: ${alertCandle.lowToWatch}`);
            
        } else if (isWaitingForBreakdown && alertCandle) {
            // Stage 2: Monitor for breakdown of Alert Candle low
            
            if (isAlertCandle) {
                // New Alert Candle found, replace the previous one
                log.info(`New Alert Candle detected, replacing previous one`);
                alertCandle = {
                    ...latestCandle,
                    emaValue: currentEMA,
                    lowToWatch: latestCandle.low
                };
                
                const now = new Date();
                if (!lastAlertTime || (now - lastAlertTime) >= (ALERT_COOLDOWN_MINUTES * 60 * 1000)) {
                    await sendAlertCandleNotification(alertCandle);
                    lastAlertTime = now;
                }
                
                log.signal(`New Alert Candle identified! Low to watch: ${alertCandle.lowToWatch}`);
                
            } else if (latestCandle.low < alertCandle.lowToWatch) {
                // Breakdown detected - PUT signal triggered
                await sendPutSignalNotification(latestCandle, alertCandle);
                
                // Reset the state after PUT signal
                isWaitingForBreakdown = false;
                alertCandle = null;
                
                log.signal(`PUT Signal triggered! Breakdown at: ${latestCandle.low}`);
                
            } else {
                log.debug(`Monitoring breakdown - Current low: ${latestCandle.low}, Alert low: ${alertCandle.lowToWatch}`);
            }
        } else {
            log.debug('No signal conditions met - normal market condition');
        }
        
        // Log current state
        if (isWaitingForBreakdown && alertCandle) {
            log.info(`Status: Waiting for breakdown below ${alertCandle.lowToWatch} (Alert Candle from ${alertCandle.timestamp})`);
        }

    } catch (error) {
        log.error(`Error in strategy processing: ${error.message}`);
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
📊 OHLC: ${candle.open} | ${candle.high} | ${candle.low} | ${candle.close}
📉 EMA(${EMA_PERIOD}): ${candle.emaValue.toFixed(2)}

✅ *All OHLC values are above EMA(${EMA_PERIOD})*
🎯 *Watching for breakdown below: ${candle.lowToWatch}*

💡 Strong bullish momentum detected!
🔻 Monitoring for PUT entry signal...

⚠️ This is for educational purposes only`;

    await sendTelegramMessage(message);
    log.success(`Alert Candle notification sent for Nifty 50`);
};

const sendPutSignalNotification = async (currentCandle, alertCandle) => {
    const message = `🔻 *PUT SIGNAL TRIGGERED*
    
📉 *Nifty 50 Breakdown Alert*
🕐 Entry Time: ${currentCandle.timestamp}
💥 Entry Price: ${currentCandle.low}
📍 Alert Candle Low: ${alertCandle.lowToWatch}
⏰ Alert Time: ${alertCandle.timestamp}

🔻 *Nifty 50 broke below Alert Candle low*
📊 Current OHLC: ${currentCandle.open} | ${currentCandle.high} | ${currentCandle.low} | ${currentCandle.close}

🎯 *PUT Entry Opportunity Detected*
⚠️ Consider risk management and position sizing

⚠️ This is for educational purposes only`;

    await sendTelegramMessage(message);
    log.success(`PUT Signal notification sent for Nifty 50 breakdown`);
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
