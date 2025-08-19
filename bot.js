require('dotenv').config();
const axios = require('axios');
const http = require('http');
const WebSocket = require('ws');

// Configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;
const INSTRUMENT_KEY = encodeURIComponent(process.env.INSTRUMENT_KEY || 'NSE_INDEX|NIFTY 50');
const TIMEFRAME = process.env.TIMEFRAME || '5minute';
const EMA_PERIOD = parseInt(process.env.EMA_PERIOD) || 5;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const PORT = process.env.PORT || 10000;

// Real-time alert configuration - NO COOLDOWN for immediate alerts
const ENABLE_IMMEDIATE_ALERTS = true; // Send alert for every candle above EMA

// Global state variables for real-time monitoring
let isRunning = false;
let lastCandleTimestamp = null; // Track last processed candle to avoid duplicates
let currentPrice = null; // Store current real-time price
let candleData = []; // Store candle data for EMA calculation
let ws = null; // WebSocket connection
let lastAlertCandle = null; // Track last alerted candle to avoid duplicates

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
        
        // Store candle data for real-time processing
        candleData = candles;
        
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

// Real-time WebSocket connection for live price updates
const connectWebSocket = async () => {
    try {
        // Get WebSocket URL from Upstox API
        const wsResponse = await axios.get('https://api.upstox.com/v2/feed/market-data-feed/authorize', {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        });

        const wsUrl = wsResponse.data.data.authorizedRedirectUri;
        log.info(`Connecting to Upstox WebSocket: ${wsUrl}`);

        ws = new WebSocket(wsUrl, {
            headers: {
                'Api-Version': '2.0',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            }
        });

        ws.on('open', () => {
            log.success('WebSocket connected successfully');
            
            // Subscribe to Nifty 50 real-time data
            const subscribeMessage = {
                "guid": "someguid",
                "method": "sub",
                "data": {
                    "mode": "full",
                    "instrumentKeys": [INSTRUMENT_KEY.replace(encodeURIComponent('NSE_INDEX|NIFTY 50'), 'NSE_INDEX|NIFTY 50')]
                }
            };
            
            ws.send(JSON.stringify(subscribeMessage));
            log.info(`Subscribed to real-time data for ${INSTRUMENT_KEY}`);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'feed' && message.feeds) {
                    for (const instrumentKey in message.feeds) {
                        const feed = message.feeds[instrumentKey];
                        
                        if (feed.ff && feed.ff.marketFF && feed.ff.marketFF.ltpc) {
                            const ltp = feed.ff.marketFF.ltpc.ltp;
                            currentPrice = parseFloat(ltp);
                            
                            log.debug(`Real-time price update: ${currentPrice}`);
                            
                            // Process real-time price for strategy
                            processRealTimePrice(currentPrice);
                        }
                    }
                }
            } catch (error) {
                log.error(`Error processing WebSocket message: ${error.message}`);
            }
        });

        ws.on('error', (error) => {
            log.error(`WebSocket error: ${error.message}`);
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
                log.info('Attempting to reconnect WebSocket...');
                connectWebSocket();
            }, 5000);
        });

        ws.on('close', (code, reason) => {
            log.error(`WebSocket closed: ${code} - ${reason}`);
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
                log.info('Attempting to reconnect WebSocket...');
                connectWebSocket();
            }, 5000);
        });

    } catch (error) {
        log.error(`Failed to connect WebSocket: ${error.message}`);
        
        // Fallback to periodic API calls if WebSocket fails
        log.info('Falling back to periodic API calls...');
        startPeriodicFetch();
    }
};

// Process real-time price updates
const processRealTimePrice = (price) => {
    if (!candleData || candleData.length < EMA_PERIOD + 1) {
        log.debug('Not enough historical data for real-time processing');
        return;
    }

    // Update the current minute's candle with latest price
    const now = new Date();
    const currentMinute = Math.floor(now.getMinutes() / 5) * 5; // Round to 5-minute intervals
    
    // Create or update current 5-minute candle
    const currentTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), currentMinute);
    
    // Check if we need to create a new candle or update existing one
    const lastCandle = candleData[candleData.length - 1];
    const lastCandleTime = new Date(lastCandle[0]);
    
    if (currentTime.getTime() > lastCandleTime.getTime()) {
        // New candle period started
        log.info('New 5-minute candle started');
        
        // Add new candle with current price as OHLC
        const newCandle = [
            currentTime.toISOString(),
            price, // open
            price, // high
            price, // low
            price  // close
        ];
        
        candleData.push(newCandle);
        
        // Keep only last 50 candles for memory efficiency
        if (candleData.length > 50) {
            candleData = candleData.slice(-50);
        }
        
        // Process strategy with updated data
        processStrategy(candleData);
    } else {
        // Update current candle
        if (lastCandle) {
            lastCandle[2] = Math.max(lastCandle[2], price); // Update high
            lastCandle[3] = Math.min(lastCandle[3], price); // Update low
            lastCandle[4] = price; // Update close
            
            log.debug(`Updated current candle: H:${lastCandle[2]} L:${lastCandle[3]} C:${lastCandle[4]}`);
        }
    }
};

// Fallback function for periodic API calls
const startPeriodicFetch = () => {
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
    
    return monitoringInterval;
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
            log.signal(`All OHLC above EMA(${EMA_PERIOD}): O:${latestCandle.open.toFixed(2)} H:${latestCandle.high.toFixed(2)} L:${latestCandle.low.toFixed(2)} C:${latestCandle.close.toFixed(2)} > EMA:${currentEMA.toFixed(2)}`);
            
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
            
            log.debug(`Candle not completely above EMA: O:${ohlcCheck.open} H:${ohlcCheck.high} L:${ohlcCheck.low} C:${ohlcCheck.close} vs EMA:${currentEMA.toFixed(2)}`);
        }
        
        // Log current monitoring status
        log.info(`📊 Status: Monitoring for 5-min candles completely above EMA(${EMA_PERIOD}): ${currentEMA.toFixed(2)}`);

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

const sendImmediateAlert = async (candle) => {
    const message = `🚨 *IMMEDIATE ALERT - CANDLE ABOVE EMA*

📈 *Nifty 50 - 5 MINUTE CANDLE*
🕐 Time: ${candle.timestamp}
⚡ *REAL-TIME ALERT - NO COOLDOWN*

📊 *Candle Details:*
   🟢 Open: ${candle.open.toFixed(2)}
   🟢 High: ${candle.high.toFixed(2)}
   🟢 Low: ${candle.low.toFixed(2)}
   🟢 Close: ${candle.close.toFixed(2)}

📉 *EMA(${EMA_PERIOD}): ${candle.emaValue.toFixed(2)}*

✅ *CONDITION MET:*
   ✓ Open > EMA: ${candle.open.toFixed(2)} > ${candle.emaValue.toFixed(2)}
   ✓ High > EMA: ${candle.high.toFixed(2)} > ${candle.emaValue.toFixed(2)}
   ✓ Low > EMA: ${candle.low.toFixed(2)} > ${candle.emaValue.toFixed(2)}
   ✓ Close > EMA: ${candle.close.toFixed(2)} > ${candle.emaValue.toFixed(2)}

🚀 *ENTIRE 5-MIN CANDLE IS COMPLETELY ABOVE EMA(${EMA_PERIOD})*

💡 Strong bullish momentum detected!
� All price points are above the EMA line

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

// Create HTTP server for health checks (required for Render deployment)
const createHealthServer = () => {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                service: 'EMA(5) Immediate Alert System',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                isMarketHours: isMarketHours(),
                lastCandleProcessed: lastCandleTimestamp ? new Date(lastCandleTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'None',
                alertMode: 'Immediate - No Cooldown'
            }));
        } else if (req.url === '/' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <head><title>EMA(5) Immediate Alert System</title></head>
                    <body>
                        <h1>🚀 EMA(5) Immediate Alert System for Nifty 50</h1>
                        <p><strong>Status:</strong> Running</p>
                        <p><strong>Market Hours:</strong> ${isMarketHours() ? 'Open' : 'Closed'}</p>
                        <p><strong>Alert Mode:</strong> Immediate - No Cooldown</p>
                        <p><strong>Last Candle:</strong> ${lastCandleTimestamp ? new Date(lastCandleTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'None'}</p>
                        <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
                        <hr>
                        <p>🚨 IMMEDIATE ALERTS: Every 5-min candle completely above EMA(5)</p>
                        <p>⚡ Real-time monitoring: ${decodeURIComponent(INSTRUMENT_KEY)} on ${TIMEFRAME}</p>
                        <p>📊 Condition: Open, High, Low, Close ALL above EMA(5)</p>
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

// Graceful shutdown handler
const gracefulShutdown = () => {
    log.info('Received shutdown signal. Cleaning up...');
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        log.info('Monitoring interval cleared');
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
        log.info('WebSocket connection closed');
    }
    
    if (healthServer) {
        healthServer.close(() => {
            log.info('Health server closed');
        });
    }
    
    // Reset strategy state
    lastCandleTimestamp = null;
    lastAlertCandle = null;
    candleData = [];
    currentPrice = null;
    
    log.info('EMA(5) Alert System for Nifty 50 stopped');
    process.exit(0);
};

// Main execution function
const main = async () => {
    log.info('🚀 Starting EMA(5) Immediate Alert System for Nifty 50 with Real-time Data');
    log.info(`📊 Monitoring: ${decodeURIComponent(INSTRUMENT_KEY)} (${TIMEFRAME})`);
    log.info(`📈 Strategy: IMMEDIATE alerts when 5-min candle is completely above EMA(${EMA_PERIOD})`);
    log.info(`⚡ Alert Mode: NO COOLDOWN - Every qualifying candle triggers alert`);
    
    // Validate configuration
    validateConfig();
    
    // Start health server for Render deployment
    const healthServer = createHealthServer();
    
    // Test Telegram connection
    await testTelegramConnection();
    
    // Initial fetch for historical data
    log.info('Fetching initial historical candle data...');
    await fetchCandles();
    
    // Connect to real-time WebSocket for live updates
    log.info('Connecting to real-time data feed...');
    await connectWebSocket();
    
    // Set up fallback monitoring interval as backup
    const intervalMinutes = parseInt(TIMEFRAME.replace('minute', ''));
    const intervalMs = intervalMinutes * 60 * 1000;
    
    const monitoringInterval = setInterval(async () => {
        if (!isMarketHours()) {
            log.debug('Outside market hours, skipping fetch');
            return;
        }
        
        // Only fetch if WebSocket is not connected
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            log.debug(`WebSocket not connected, running backup ${TIMEFRAME} candle fetch...`);
            await fetchCandles();
        }
    }, intervalMs);
    
    log.info(`🔄 Real-time monitoring started with WebSocket connection`);
    log.info(`🔄 Backup polling every ${intervalMinutes} minutes during market hours`);
    log.info('� IMMEDIATE ALERTS: Every 5-min candle completely above EMA triggers alert');
    log.info('⚡ NO COOLDOWN: Real-time alerts for every qualifying candle');
    
    return { monitoringInterval, healthServer };
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
let healthServer;
main().then((services) => {
    monitoringInterval = services.monitoringInterval;
    healthServer = services.healthServer;
}).catch((error) => {
    log.error(`Failed to start application: ${error.message}`);
    process.exit(1);
});
