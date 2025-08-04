require('dotenv').config();
const axios = require('axios');

// Configuration from environment variables
const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;
const INSTRUMENT_KEY = encodeURIComponent(process.env.INSTRUMENT_KEY || 'NSE_INDEX|NIFTY 50');
const TIMEFRAME = process.env.TIMEFRAME || '5minute';
const EMA_PERIOD = parseInt(process.env.EMA_PERIOD) || 5;

// EMA calculation function
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

// Test the strategy logic
const testStrategy = async () => {
    console.log('🧪 Testing EMA(5) Alert Strategy Logic...\n');
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const url = `https://api.upstox.com/v2/historical-candle/${INSTRUMENT_KEY}/${TIMEFRAME}/${today}/${today}`;
        
        console.log(`📊 Fetching ${TIMEFRAME} candles for: ${decodeURIComponent(INSTRUMENT_KEY)}`);
        
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            timeout: 10000
        });

        const candles = response.data.data.candles;
        
        if (!candles || candles.length < (EMA_PERIOD + 10)) {
            console.log(`❌ Not enough candle data. Available: ${candles?.length || 0}, Required: ${EMA_PERIOD + 10}`);
            return;
        }

        console.log(`✅ Retrieved ${candles.length} candles\n`);
        
        // Analyze last few candles
        const analysisCount = Math.min(5, candles.length - EMA_PERIOD);
        console.log(`📈 Analyzing last ${analysisCount} candles:\n`);
        
        for (let i = 0; i < analysisCount; i++) {
            const candleIndex = candles.length - analysisCount + i;
            const requiredCandles = candleIndex + 1;
            
            if (requiredCandles < EMA_PERIOD + 10) continue;
            
            // Get candles up to this point
            const historicalCandles = candles.slice(0, requiredCandles);
            const recentCandles = historicalCandles.slice(-(EMA_PERIOD + 10));
            
            // Calculate EMA
            const closePrices = recentCandles.slice(0, -1).map(candle => parseFloat(candle[4]));
            const emaValues = calculateEMA(closePrices, EMA_PERIOD);
            const currentEMA = emaValues[emaValues.length - 1];
            
            // Get current candle
            const [timestamp, open, high, low, close] = recentCandles[recentCandles.length - 1];
            const candle = {
                timestamp: new Date(timestamp).toLocaleString('en-IN', { 
                    timeZone: 'Asia/Kolkata',
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                open: parseFloat(open),
                high: parseFloat(high),
                low: parseFloat(low),
                close: parseFloat(close)
            };
            
            // Check Alert Candle condition
            const isAlertCandle = candle.open > currentEMA && 
                                 candle.high > currentEMA && 
                                 candle.low > currentEMA && 
                                 candle.close > currentEMA;
            
            console.log(`⏰ Time: ${candle.timestamp}`);
            console.log(`   OHLC: ${candle.open.toFixed(2)} | ${candle.high.toFixed(2)} | ${candle.low.toFixed(2)} | ${candle.close.toFixed(2)}`);
            console.log(`   EMA(${EMA_PERIOD}): ${currentEMA.toFixed(2)}`);
            console.log(`   Above EMA: O:${candle.open > currentEMA ? '✅' : '❌'} H:${candle.high > currentEMA ? '✅' : '❌'} L:${candle.low > currentEMA ? '✅' : '❌'} C:${candle.close > currentEMA ? '✅' : '❌'}`);
            console.log(`   ${isAlertCandle ? '🚨 ALERT CANDLE' : '📊 Normal Candle'}`);
            console.log('');
        }
        
        console.log('✅ Strategy test completed!');
        console.log('\n💡 Key Points:');
        console.log('   - Alert Candle = ALL OHLC values above EMA(5)');
        console.log('   - PUT Signal = Current candle low < Alert Candle low');
        console.log('   - New Alert Candle replaces previous one');

    } catch (error) {
        console.error('❌ Error testing strategy:', error.message);
    }
};

console.log('🔍 EMA(5) Alert Strategy - Logic Test\n');
testStrategy();
