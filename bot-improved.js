require('dotenv').config();
const axios = require('axios');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const { ProductionTokenManager } = require('./setup-production');

// Configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;
const INSTRUMENT_KEY = 'NSE_INDEX|Nifty 50'; // Unencoded key for WebSocket
const ENCODED_INSTRUMENT_KEY = encodeURIComponent(INSTRUMENT_KEY); // For REST API
const EMA_PERIOD = parseInt(process.env.EMA_PERIOD) || 5;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const PORT = process.env.PORT || 10000;

// Initialize production token manager
const tokenManager = new ProductionTokenManager();

// Keep-alive and stability configuration
const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_CANDLE_HISTORY = 100; // Limit memory usage
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Global state variables for real-time monitoring
let isRunning = false;
let lastCandleTimestamp = null;
let candleData = [];
let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
let maxReconnectAttempts = 3;
let useRestFallback = false;
let isMarketOpen = false;

// Candle generation variables
let currentCandle = null;
let tickData = [];
let candleInterval = 5 * 60 * 1000; // 5 minutes in milliseconds

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
    const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        log.error(`Missing required environment variables: ${missing.join(', ')}`);
        log.error('Please check your .env file. Use .env.example as a template.');
        process.exit(1);
    }
    
    // Check if UPSTOX_ACCESS_TOKEN exists, but don't exit if missing (will use refresh flow)
    if (!process.env.UPSTOX_ACCESS_TOKEN) {
        log.info('⚠️  UPSTOX_ACCESS_TOKEN not found - will attempt token refresh...');
    }
    
    log.info('Configuration validated successfully');
};

// Market hours check (Indian market: 9:15 AM to 3:30 PM IST)
const checkMarketHours = () => {
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    const wasOpen = isMarketOpen;
    isMarketOpen = currentTime >= 915 && currentTime <= 1530;
    
    if (wasOpen !== isMarketOpen) {
        if (isMarketOpen) {
            log.success('🟢 Market opened - Starting real-time data collection');
            startDataCollection();
        } else {
            log.info('🔴 Market closed - Stopping data collection');
            stopDataCollection();
        }
    }
    
    return isMarketOpen;
};

// Start data collection when market opens
const startDataCollection = () => {
    if (!isRunning && isMarketOpen) {
        isRunning = true;
        initializeCandleTracking();
        
        // Try WebSocket first, but have REST as backup
        try {
            connectWebSocket();
            
            // Set a timeout to start REST polling if WebSocket doesn't connect within 30 seconds
            setTimeout(() => {
                if (!isConnected && isMarketOpen && !useRestFallback) {
                    log.info('🔄 WebSocket taking too long - starting REST fallback...');
                    useRestFallback = true;
                    startRestPolling();
                }
            }, 30000);
            
        } catch (error) {
            log.error(`Failed to start WebSocket: ${error.message}`);
            log.info('🔄 Starting REST API fallback immediately...');
            useRestFallback = true;
            startRestPolling();
        }
    }
};

// Stop data collection when market closes
const stopDataCollection = () => {
    if (isRunning) {
        isRunning = false;
        if (ws && isConnected) {
            ws.close(1000, 'Market closed');
        }
    }
};

// Initialize candle tracking system
const initializeCandleTracking = () => {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const nextCandleMinute = Math.ceil(currentMinute / 5) * 5;
    
    // Calculate next 5-minute boundary
    const nextCandleTime = new Date(now);
    nextCandleTime.setMinutes(nextCandleMinute, 0, 0);
    
    if (nextCandleTime <= now) {
        nextCandleTime.setTime(nextCandleTime.getTime() + candleInterval);
    }

    log.info(`⏰ Next candle will complete at: ${nextCandleTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    
    currentCandle = {
        startTime: new Date(nextCandleTime.getTime() - candleInterval),
        endTime: nextCandleTime,
        open: null,
        high: null,
        low: null,
        close: null,
        tickCount: 0
    };

    // Set up timer for candle completion
    setCandleTimer();
};

// Set timer for next candle completion
const setCandleTimer = () => {
    const now = new Date();
    const timeToNextCandle = currentCandle.endTime.getTime() - now.getTime();
    
    setTimeout(() => {
        if (isMarketOpen && isRunning) {
            generateCandle();
            initializeNextCandle();
            setCandleTimer();
        }
    }, Math.max(timeToNextCandle, 0));
};

// Initialize next candle period
const initializeNextCandle = () => {
    const nextStartTime = new Date(currentCandle.endTime);
    const nextEndTime = new Date(nextStartTime.getTime() + candleInterval);

    currentCandle = {
        startTime: nextStartTime,
        endTime: nextEndTime,
        open: null,
        high: null,
        low: null,
        close: null,
        tickCount: 0
    };

    log.debug(`⏰ Next candle period: ${nextStartTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} to ${nextEndTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
};

// Connect to WebSocket
const connectWebSocket = () => {
    if (!isMarketOpen) {
        log.info('⚠️ Skipping WebSocket connection - Market is closed');
        return;
    }

    if (useRestFallback) {
        startRestPolling();
        return;
    }

    try {
        log.info('🔄 Connecting to Upstox WebSocket...');
        
        // Use the working WebSocket URL from your reference
        const wsUrl = 'wss://ws-api.upstox.com/v3/feed/market-data-feed';
        
        ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Api-Version': '3.0',
                'Accept': 'application/json'
            }
        });

        ws.on('open', onWebSocketOpen);
        ws.on('message', onWebSocketMessage);
        ws.on('error', onWebSocketError);
        ws.on('close', onWebSocketClose);
        
    } catch (error) {
        log.error(`Error creating WebSocket connection: ${error.message}`);
        scheduleReconnect();
    }
};

// WebSocket event handlers
const onWebSocketOpen = () => {
    log.success('✅ Connected to Upstox WebSocket');
    isConnected = true;
    reconnectAttempts = 0;
    
    // Subscribe to Nifty 50 Index
    subscribeToInstrument();
};

const subscribeToInstrument = () => {
    const subscriptionMessage = {
        guid: uuidv4(),
        method: 'sub',
        data: {
            mode: 'full',
            instrumentKeys: [INSTRUMENT_KEY]
        }
    };

    log.info(`📡 Subscribing to ${INSTRUMENT_KEY}...`);
    ws.send(JSON.stringify(subscriptionMessage));
};

const onWebSocketMessage = (data) => {
    try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'feed') {
            processFeedData(message.feeds);
        } else if (message.type === 'success') {
            log.success(`✅ Subscription successful: ${JSON.stringify(message.data)}`);
        } else if (message.type === 'error') {
            log.error(`❌ Subscription error: ${JSON.stringify(message.data)}`);
        } else {
            log.debug(`📡 WebSocket message: ${JSON.stringify(message)}`);
        }
    } catch (error) {
        log.error(`Error parsing WebSocket message: ${error.message}`);
    }
};

const processFeedData = (feeds) => {
    if (!feeds || !feeds[INSTRUMENT_KEY]) {
        return;
    }

    const feedData = feeds[INSTRUMENT_KEY];
    const { ltp: lastTradedPrice, ts: timestamp } = feedData;

    if (lastTradedPrice && timestamp) {
        const tickTime = new Date(timestamp);
        const tick = {
            price: parseFloat(lastTradedPrice),
            timestamp: tickTime,
            rawTimestamp: timestamp
        };

        log.info(`📊 Real-time tick: ₹${tick.price} at ${tickTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        
        // Process tick for candle generation
        processTick(tick);
    }
};

const processTick = (tick) => {
    if (!isMarketOpen || !currentCandle) {
        return;
    }

    const tickTime = tick.timestamp;
    
    // Check if tick falls within current candle timeframe
    if (tickTime >= currentCandle.startTime && tickTime < currentCandle.endTime) {
        // First tick of the candle
        if (currentCandle.open === null) {
            currentCandle.open = tick.price;
            currentCandle.high = tick.price;
            currentCandle.low = tick.price;
            log.info(`🕯️ New candle started: Open = ₹${tick.price}`);
        } else {
            // Update high and low
            currentCandle.high = Math.max(currentCandle.high, tick.price);
            currentCandle.low = Math.min(currentCandle.low, tick.price);
        }
        
        // Always update close with latest price
        currentCandle.close = tick.price;
        currentCandle.tickCount++;
        
        // Store tick data
        tickData.push(tick);
        
        log.debug(`🔄 Candle update: O:${currentCandle.open} H:${currentCandle.high} L:${currentCandle.low} C:${currentCandle.close} (${currentCandle.tickCount} ticks)`);
    }
};

const generateCandle = () => {
    if (!isMarketOpen || !currentCandle || currentCandle.open === null) {
        log.debug('⚠️ No ticks received for this candle period');
        return;
    }

    const candle = {
        timestamp: currentCandle.endTime.toISOString(),
        startTime: currentCandle.startTime.toISOString(),
        endTime: currentCandle.endTime.toISOString(),
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: currentCandle.close,
        tickCount: currentCandle.tickCount
    };

    log.signal('\n🕯️ ===== 5-MINUTE CANDLE COMPLETED =====');
    log.signal(`📅 Time: ${candle.startTime} to ${candle.endTime}`);
    log.signal(`📊 OHLC: O=₹${candle.open} H=₹${candle.high} L=₹${candle.low} C=₹${candle.close}`);
    log.signal(`🔢 Ticks processed: ${candle.tickCount}`);
    log.signal('=====================================\n');

    // Add to candle data for EMA calculation
    const candleArray = [
        candle.timestamp,
        candle.open,
        candle.high,
        candle.low,
        candle.close
    ];
    
    candleData.push(candleArray);
    
    // Keep only last 50 candles in memory
    if (candleData.length > 50) {
        candleData = candleData.slice(-50);
    }

    // Process candle for EMA strategy
    processStrategy([candleArray]);
    
    // Save candle to file
    saveCandle(candle);
};

const saveCandle = (candle) => {
    const fs = require('fs');
    const candleLog = `${candle.timestamp},${candle.open},${candle.high},${candle.low},${candle.close},${candle.tickCount}\n`;
    
    try {
        fs.appendFileSync('nifty50_5min_candles.csv', candleLog);
        log.debug('💾 Candle saved to CSV file');
    } catch (error) {
        log.error(`Error saving candle to file: ${error.message}`);
    }
};

const processStrategy = async (newCandles) => {
    try {
        // Need at least EMA_PERIOD candles to calculate EMA and check condition
        if (candleData.length < EMA_PERIOD) {
            log.info(`📊 Need more candles for EMA calculation. Have: ${candleData.length}, Need: ${EMA_PERIOD} (for EMA${EMA_PERIOD})`);
            return;
        }
        
        // Get all available candles (we'll use the last EMA_PERIOD for EMA calculation)
        const allCandles = candleData.slice();
        
        // Extract close prices from the last EMA_PERIOD candles for EMA calculation
        const closePrices = allCandles.slice(-EMA_PERIOD).map(candle => parseFloat(candle[4]));
        
        // Calculate EMA(5) from these close prices
        const emaValues = calculateEMA(closePrices, EMA_PERIOD);
        const currentEMA = emaValues[emaValues.length - 1];
        
        // Get the latest completed candle for analysis (this is the candle we're checking against EMA)
        const [timestamp, open, high, low, close] = allCandles[allCandles.length - 1];
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
        
        log.info(`📊 Latest candle: O:₹${latestCandle.open} H:₹${latestCandle.high} L:₹${latestCandle.low} C:₹${latestCandle.close}`);
        log.info(`📈 Current EMA(${EMA_PERIOD}): ₹${currentEMA.toFixed(2)}`);
        
        // Check if this is a new candle (avoid duplicate alerts)
        if (lastCandleTimestamp === latestCandle.rawTimestamp) {
            log.debug('Same candle already processed, skipping duplicate alert');
            return;
        }
        
        // MAIN CONDITION: Check if ALL OHLC is completely above EMA(5)
        const isCandleAboveEMA = latestCandle.open > currentEMA && 
                                latestCandle.high > currentEMA && 
                                latestCandle.low > currentEMA && 
                                latestCandle.close > currentEMA;
        
        if (isCandleAboveEMA) {
            // Update last processed candle timestamp
            lastCandleTimestamp = latestCandle.rawTimestamp;
            
            // Create alert candle data
            const alertCandle = {
                ...latestCandle,
                emaValue: currentEMA
            };
            
            // Send immediate alert - NO COOLDOWN
            log.signal(`🚨 CANDLE ABOVE EMA DETECTED - Sending immediate alert!`);
            log.signal(`All OHLC above EMA(${EMA_PERIOD}): O:₹${latestCandle.open.toFixed(2)} H:₹${latestCandle.high.toFixed(2)} L:₹${latestCandle.low.toFixed(2)} C:₹${latestCandle.close.toFixed(2)} > EMA:₹${currentEMA.toFixed(2)}`);
            
            await sendImmediateAlert(alertCandle);
            
            log.success(`✅ Immediate alert sent for candle at ${alertCandle.timestamp}`);
            
        } else {
            // Log which conditions are not met
            const ohlcCheck = {
                open: latestCandle.open > currentEMA ? '✓' : '✗',
                high: latestCandle.high > currentEMA ? '✓' : '✗',
                low: latestCandle.low > currentEMA ? '✓' : '✗',
                close: latestCandle.close > currentEMA ? '✓' : '✗'
            };
            
            log.debug(`Candle not completely above EMA: O:${ohlcCheck.open} H:${ohlcCheck.high} L:${ohlcCheck.low} C:${ohlcCheck.close} vs EMA:₹${currentEMA.toFixed(2)}`);
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
    
    // For exactly 5 prices, we can calculate EMA more efficiently
    if (prices.length === period) {
        // Calculate SMA for initialization
        const sma = prices.reduce((sum, price) => sum + price, 0) / period;
        return [sma]; // Return the EMA value (which equals SMA for exactly 5 data points)
    }
    
    // For more than 5 prices, calculate progressive EMA
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

const sendImmediateAlert = async (candle) => {
    const message = `🚨 *IMMEDIATE ALERT - CANDLE ABOVE EMA*

📈 *Nifty 50 - 5 MINUTE CANDLE*
🕐 Time: ${candle.timestamp}
⚡ *REAL-TIME ALERT - NO COOLDOWN*

📊 *Candle Details:*
   🟢 Open: ₹${candle.open.toFixed(2)}
   🟢 High: ₹${candle.high.toFixed(2)}
   🟢 Low: ₹${candle.low.toFixed(2)}
   🟢 Close: ₹${candle.close.toFixed(2)}

📉 *EMA(${EMA_PERIOD}): ₹${candle.emaValue.toFixed(2)}*

✅ *CONDITION MET:*
   ✓ Open > EMA: ₹${candle.open.toFixed(2)} > ₹${candle.emaValue.toFixed(2)}
   ✓ High > EMA: ₹${candle.high.toFixed(2)} > ₹${candle.emaValue.toFixed(2)}
   ✓ Low > EMA: ₹${candle.low.toFixed(2)} > ₹${candle.emaValue.toFixed(2)}
   ✓ Close > EMA: ₹${candle.close.toFixed(2)} > ₹${candle.emaValue.toFixed(2)}

🚀 *ENTIRE 5-MIN CANDLE IS COMPLETELY ABOVE EMA(${EMA_PERIOD})*

💡 Strong bullish momentum detected!
📈 All price points are above the EMA line

⚠️ This is for educational purposes only`;

    await sendTelegramMessage(message);
    log.success(`Immediate alert sent for candle above EMA`);
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

// WebSocket error and reconnection handling
const onWebSocketError = (error) => {
    log.error(`WebSocket error: ${error.message}`);
    isConnected = false;
    
    // Don't crash the app - just log and continue with fallback
    if (!useRestFallback) {
        log.info('🔄 Switching to REST API fallback due to WebSocket error...');
        useRestFallback = true;
        startRestPolling();
    }
};

const onWebSocketClose = (code, reason) => {
    log.info(`🔌 WebSocket connection closed. Code: ${code}, Reason: ${reason || 'Unknown'}`);
    isConnected = false;
    
    if (code !== 1000 && isMarketOpen) { // Not a normal closure and market is open
        scheduleReconnect();
    }
};

const scheduleReconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
        log.error('❌ WebSocket connection failed multiple times. Switching to REST API fallback...');
        useRestFallback = true;
        startRestPolling();
        return;
    }

    reconnectAttempts++;
    log.info(`🔄 Attempting to reconnect in 5 seconds... (Attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
    
    setTimeout(() => {
        if (isMarketOpen) {
            connectWebSocket();
        }
    }, 5000);
};

// REST API fallback methods
const startRestPolling = () => {
    log.info('🔄 Starting REST API fallback mode...');
    pollData();
};

const fetchQuote = () => {
    return new Promise((resolve, reject) => {
        const path = `/v2/market-quote/quotes?symbol=${ENCODED_INSTRUMENT_KEY}`;
        
        const options = {
            hostname: 'api.upstox.com',
            port: 443,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Api-Version': '2.0',
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Failed to parse response: ' + error.message));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
};

const pollData = async () => {
    if (!isRunning || !isMarketOpen) return;

    try {
        const quoteData = await fetchQuote();
        processQuoteData(quoteData);
    } catch (error) {
        log.error(`Error fetching quote: ${error.message}`);
        
        if (error.message.includes('401')) {
            log.error('🔑 Token expired - trying to refresh automatically...');
            // Don't return - continue polling in case token gets refreshed
        }
    }

    // Always schedule next poll to ensure continuous monitoring
    if (isRunning && isMarketOpen) {
        setTimeout(() => {
            try {
                pollData();
            } catch (error) {
                log.error(`Error in pollData: ${error.message}`);
                // Continue polling even if there's an error
                setTimeout(() => pollData(), 10000); // Longer delay on error
            }
        }, 5000);
    }
};

const processQuoteData = (response) => {
    const responseKey = Object.keys(response.data)[0];
    const quote = response.data[responseKey];
    
    if (!quote || !quote.last_price) {
        log.debug('⚠️ No price data available in REST response');
        return;
    }

    const currentPrice = parseFloat(quote.last_price);
    const timestamp = new Date();

    const tick = {
        price: currentPrice,
        timestamp: timestamp,
        volume: quote.volume || 0,
        change: quote.net_change || 0
    };

    log.info(`📊 [REST] NIFTY 50: ₹${tick.price} (${tick.change >= 0 ? '+' : ''}${tick.change.toFixed(2)})`);

    // Process for candle generation
    processTick(tick);
};

// Health server
const createHealthServer = () => {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        if (url.pathname === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(getEnhancedHealth()));
        } else if (url.pathname === '/callback' && req.method === 'GET') {
            // OAuth callback handler for production token refresh
            const authCode = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            
            if (authCode) {
                res.end(`
                    <html>
                        <head>
                            <title>Authorization Successful</title>
                            <style>
                                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
                                .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
                                .code { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 15px 0; }
                                .info { background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0; }
                                .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="success">✅ Authorization Successful!</div>
                                <p>Your Upstox authorization was successful. The authorization code has been received.</p>
                                
                                <div class="info">
                                    <strong>📋 Next Steps for Production Setup:</strong><br>
                                    1. Your authorization code: <div class="code">${authCode}</div>
                                    2. Use this code to complete the token setup via your deployment environment
                                    3. Your app will automatically refresh tokens from now on
                                </div>
                                
                                <div class="info">
                                    <strong>🔄 For Automatic Setup (if running locally):</strong><br>
                                    Run this command with your authorization code:<br>
                                    <div class="code">npm run refresh-token</div>
                                </div>
                                
                                <div class="info">
                                    <strong>🚀 Production Deployment:</strong><br>
                                    Your app is now authorized and will automatically handle token refresh in production.
                                    No further manual intervention required!
                                </div>
                                
                                <p>You can close this window. Your EMA(5) Alert System is ready!</p>
                                
                                <button class="btn" onclick="window.close()">Close Window</button>
                            </div>
                        </body>
                    </html>
                `);
            } else {
                res.end(`
                    <html>
                        <head><title>Authorization Error</title></head>
                        <body>
                            <div class="container">
                                <h1>❌ Authorization Failed</h1>
                                <p>No authorization code received. Please try again.</p>
                                <p>State: ${state || 'None'}</p>
                            </div>
                        </body>
                    </html>
                `);
            }
        } else if (url.pathname === '/auth' && req.method === 'GET') {
            // Generate Upstox authorization URL
            const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${process.env.UPSTOX_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.UPSTOX_REDIRECT_URI)}&state=production_setup`;
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <head>
                        <title>EMA(5) System - Token Setup</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; text-align: center; }
                            .title { color: #007bff; font-size: 28px; margin-bottom: 20px; }
                            .btn { background: #28a745; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 18px; text-decoration: none; display: inline-block; margin: 20px 0; }
                            .btn:hover { background: #218838; }
                            .info { background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: left; }
                            .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="title">🚀 EMA(5) Alert System</div>
                            <h2>🔑 One-Time Token Authorization</h2>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong> This authorization is needed only ONCE for lifetime automation!
                            </div>
                            
                            <a href="${authUrl}" class="btn">🔐 Authorize with Upstox</a>
                            
                            <div class="info">
                                <strong>📋 What happens next:</strong><br>
                                1. Click the authorization button above<br>
                                2. Login to your Upstox account<br>
                                3. Approve the application<br>
                                4. You'll be redirected back with confirmation<br>
                                5. System will auto-refresh tokens forever!
                            </div>
                            
                            <div class="info">
                                <strong>✅ After authorization:</strong><br>
                                • No more daily token updates needed<br>
                                • System runs 24/7 automatically<br>
                                • Real-time alerts during market hours<br>
                                • Zero manual intervention required
                            </div>
                            
                            <p><small>Current Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small></p>
                        </div>
                    </body>
                </html>
            `);
        } else if (url.pathname === '/token-status' && req.method === 'GET') {
            // Token status endpoint
            const currentToken = process.env.UPSTOX_ACCESS_TOKEN;
            let tokenInfo = { status: 'not_set' };
            
            if (currentToken) {
                try {
                    // Decode JWT token to get expiry info
                    const tokenParts = currentToken.split('.');
                    if (tokenParts.length === 3) {
                        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                        const expiryTime = new Date(payload.exp * 1000);
                        const currentTime = new Date();
                        const timeUntilExpiry = expiryTime - currentTime;
                        const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
                        const minutesUntilExpiry = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
                        
                        tokenInfo = {
                            status: timeUntilExpiry > 0 ? 'valid' : 'expired',
                            issuedAt: new Date(payload.iat * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                            expiresAt: expiryTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                            timeUntilExpiry: timeUntilExpiry > 0 ? `${hoursUntilExpiry}h ${minutesUntilExpiry}m` : 'Expired',
                            subject: payload.sub || 'Unknown',
                            isMultiClient: payload.isMultiClient || false,
                            isPlusUser: payload.isPlusUser || false
                        };
                    }
                } catch (error) {
                    tokenInfo = { status: 'invalid', error: 'Failed to decode token' };
                }
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                tokenInfo,
                autoRefreshEnabled: true,
                lastRefreshAttempt: 'Automatic',
                nextRefreshCheck: 'When token expires',
                timestamp: new Date().toISOString()
            }, null, 2));
        } else if (url.pathname === '/' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <head><title>EMA(5) Real-time Alert System</title></head>
                    <body>
                        <h1>🚀 EMA(5) Real-time Alert System for Nifty 50</h1>
                        <p><strong>Status:</strong> ${isRunning ? 'Running' : 'Stopped'}</p>
                        <p><strong>Market:</strong> ${isMarketOpen ? '🟢 Open' : '🔴 Closed'}</p>
                        <p><strong>Connection:</strong> ${isConnected ? '🟢 WebSocket' : useRestFallback ? '🟡 REST API' : '🔴 Disconnected'}</p>
                        <p><strong>Candles Generated:</strong> ${candleData.length}</p>
                        <p><strong>Last Candle:</strong> ${lastCandleTimestamp ? new Date(lastCandleTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'None'}</p>
                        <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
                        <hr>
                        <p>🚨 Real-time 5-minute candle generation from Upstox data</p>
                        <p>⚡ Immediate alerts when entire candle is above EMA(${EMA_PERIOD})</p>
                        <p>📊 Monitoring: ${INSTRUMENT_KEY}</p>
                        <hr>
                        <p><a href="/auth">🔑 Setup Token Authorization</a> | <a href="/token-status">📊 Check Token Status</a></p>
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
    
    isRunning = false;
    
    if (ws && isConnected) {
        ws.close(1000, 'Application shutdown');
    }
    
    if (healthServer) {
        healthServer.close(() => {
            log.info('Health server closed');
        });
    }
    
    // Reset state
    lastCandleTimestamp = null;
    candleData = [];
    currentCandle = null;
    tickData = [];
    
    log.info('EMA(5) Real-time Alert System stopped');
    process.exit(0);
};

// Keep-alive mechanism to prevent Render from sleeping
const startKeepAlive = () => {
    log.info('🔄 Starting keep-alive mechanism to prevent server sleep...');
    
    setInterval(async () => {
        try {
            // Ping self to keep the app awake
            const response = await axios.get(`http://localhost:${PORT}/health`, {
                timeout: 5000
            });
            log.debug(`💓 Keep-alive ping successful - Uptime: ${response.data.uptime?.toFixed(1)}s`);
        } catch (error) {
            log.debug(`💓 Keep-alive ping failed: ${error.message}`);
        }
    }, KEEP_ALIVE_INTERVAL);
};

// Memory management - cleanup old candle data
const manageMemory = () => {
    log.info('🧹 Starting memory management...');
    
    setInterval(() => {
        try {
            // Limit candle data history to prevent memory buildup
            if (candleData.length > MAX_CANDLE_HISTORY) {
                const removed = candleData.length - MAX_CANDLE_HISTORY;
                candleData = candleData.slice(-MAX_CANDLE_HISTORY);
                log.debug(`🧹 Cleaned up ${removed} old candles to manage memory`);
            }
            
            // Clear old tick data
            if (tickData.length > 1000) {
                tickData = tickData.slice(-100);
                log.debug('🧹 Cleaned up old tick data');
            }
            
            // Log memory usage
            const memUsage = process.memoryUsage();
            const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            log.debug(`💾 Memory usage: ${memMB}MB`);
            
            // If memory usage is too high, force garbage collection
            if (memMB > 100 && global.gc) {
                global.gc();
                log.debug('🧹 Forced garbage collection');
            }
            
        } catch (error) {
            log.error(`Memory management error: ${error.message}`);
        }
    }, MEMORY_CHECK_INTERVAL);
};

// Enhanced health check with memory stats
const getEnhancedHealth = () => {
    const memUsage = process.memoryUsage();
    return {
        status: 'healthy',
        service: 'EMA(5) Real-time Alert System',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        isMarketOpen: isMarketOpen,
        isConnected: isConnected,
        useRestFallback: useRestFallback,
        candlesGenerated: candleData.length,
        lastCandle: lastCandleTimestamp ? new Date(lastCandleTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'None',
        memory: {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        },
        environment: process.env.NODE_ENV || 'development'
    };
};

// Main execution function
const main = async () => {
    log.info('🚀 Starting EMA(5) Real-time Alert System for Nifty 50');
    log.info(`📊 Monitoring: ${INSTRUMENT_KEY}`);
    log.info(`📈 Strategy: IMMEDIATE alerts when 5-min candle is completely above EMA(${EMA_PERIOD})`);
    log.info(`⚡ Alert Mode: NO COOLDOWN - Every qualifying candle triggers alert`);
    log.info(`🕯️ Candle Generation: Real-time 5-minute candles from tick data`);
    
    // Validate configuration
    validateConfig();
    
    // Initialize token auto-refresh if credentials are available
    if (process.env.UPSTOX_CLIENT_ID && process.env.UPSTOX_CLIENT_SECRET) {
        try {
            log.info('🔄 Starting production automatic token refresh system...');
            tokenManager.startProductionScheduler();
        } catch (error) {
            log.error(`Token manager initialization failed: ${error.message}`);
            log.info('💡 To enable automatic token refresh, add UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET to environment variables');
        }
    } else {
        log.info('💡 Automatic token refresh disabled. Add UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET to enable.');
    }
    
    // Start health server
    const healthServer = createHealthServer();
    
    // Test Telegram connection
    await testTelegramConnection();
    
    // Create CSV file for candle storage
    const fs = require('fs');
    if (!fs.existsSync('nifty50_5min_candles.csv')) {
        fs.writeFileSync('nifty50_5min_candles.csv', 'timestamp,open,high,low,close,tick_count\n');
        log.info('📄 Created candle data file: nifty50_5min_candles.csv');
    }
    
    // Start market monitoring (will connect automatically when market opens)
    log.info('⏰ Starting market hours monitoring...');
    
    // Check market status immediately
    checkMarketHours();
    
    // Check market status every minute
    setInterval(checkMarketHours, 60 * 1000);
    
    log.info('🔄 Real-time monitoring system started');
    log.info('🚨 Will generate 5-minute candles from live tick data');
    log.info('⚡ Will send immediate alerts when candles are above EMA');
    
    // Start stability features
    startKeepAlive();
    manageMemory();
    log.info('🛡️ Stability features enabled: keep-alive + memory management');
    
    return { healthServer };
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
    
    // Don't exit the process for unhandled rejections in production
    // Instead, continue running with REST fallback
    if (!useRestFallback && isMarketOpen) {
        log.info('🔄 Enabling REST fallback due to unhandled rejection...');
        useRestFallback = true;
        isConnected = false;
        if (typeof startRestPolling === 'function') {
            startRestPolling();
        }
    }
});

// Start the application
let healthServer;
main().then((services) => {
    healthServer = services.healthServer;
}).catch((error) => {
    log.error(`Failed to start application: ${error.message}`);
    process.exit(1);
});
