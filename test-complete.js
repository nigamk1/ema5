require('dotenv').config();

// Mock Telegram functions for testing
const mockSendTelegramMessage = async (message) => {
    console.log('\n📱 TELEGRAM MESSAGE WOULD BE SENT:');
    console.log('='.repeat(50));
    console.log(message);
    console.log('='.repeat(50) + '\n');
};

// EMA calculation function
const calculateEMA = (prices, period) => {
    if (!prices || prices.length < period) {
        throw new Error(`Insufficient data for EMA calculation. Required: ${period}, Available: ${prices?.length || 0}`);
    }
    
    const k = 2 / (period + 1);
    let emaArray = [];
    
    let sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    emaArray[period - 1] = sma;

    for (let i = period; i < prices.length; i++) {
        const ema = prices[i] * k + emaArray[i - 1] * (1 - k);
        emaArray[i] = ema;
    }
    
    return emaArray;
};

// Mock alert functions
const sendAlertCandleNotification = async (candle) => {
    const message = `✅ *ALERT CANDLE DETECTED*

📈 *Nifty 50 - 5MINUTE Chart*
🕐 Time: ${candle.timestamp}

📊 *Candle Details:*
   Open: ${candle.open.toFixed(2)}
   High: ${candle.high.toFixed(2)}
   Low: ${candle.low.toFixed(2)}
   Close: ${candle.close.toFixed(2)}

📉 EMA(5): ${candle.emaValue.toFixed(2)}

✅ *Entire candle is ABOVE EMA(5)*
🎯 *Watching for breakdown below: ${candle.lowToWatch.toFixed(2)}*

💡 Strong bullish momentum detected!
🔻 Will alert when price breaks below ${candle.lowToWatch.toFixed(2)}

⚠️ This is for educational purposes only`;

    await mockSendTelegramMessage(message);
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

🔻 *Current Candle:*
   OHLC: ${currentCandle.open.toFixed(2)} | ${currentCandle.high.toFixed(2)} | ${currentCandle.low.toFixed(2)} | ${currentCandle.close.toFixed(2)}

🎯 *PUT Entry Opportunity*
💡 Consider buying PUT options at current levels

⚠️ This is for educational purposes only`;

    await mockSendTelegramMessage(message);
};

// Complete test scenario that shows both Alert Candle and PUT signal
const runCompleteTestScenario = async () => {
    console.log('🧪 COMPLETE EMA(5) STRATEGY TEST - ALERT CANDLE + PUT SIGNAL\n');
    
    // Sample 5-minute candle data showing a complete cycle
    const sampleCandles = [
        // Base candles for EMA calculation
        ['2025-08-04T09:15:00.000Z', 24280, 24295, 24275, 24290],
        ['2025-08-04T09:20:00.000Z', 24290, 24305, 24285, 24300],
        ['2025-08-04T09:25:00.000Z', 24300, 24315, 24295, 24310],
        ['2025-08-04T09:30:00.000Z', 24310, 24325, 24305, 24320],
        ['2025-08-04T09:35:00.000Z', 24320, 24335, 24315, 24330],
        ['2025-08-04T09:40:00.000Z', 24330, 24345, 24325, 24340],
        ['2025-08-04T09:45:00.000Z', 24340, 24355, 24335, 24350],
        ['2025-08-04T09:50:00.000Z', 24350, 24365, 24345, 24360],
        ['2025-08-04T09:55:00.000Z', 24360, 24375, 24355, 24370],
        ['2025-08-04T10:00:00.000Z', 24370, 24385, 24365, 24380],
        
        // 1. Alert Candle - ALL OHLC above EMA
        ['2025-08-04T10:05:00.000Z', 24385, 24400, 24390, 24395], // Alert Candle (Low = 24390)
        
        // 2. Normal candle - price stays above Alert Candle low
        ['2025-08-04T10:10:00.000Z', 24395, 24405, 24392, 24400], // No breakdown (Low = 24392 > 24390)
        
        // 3. Breakdown candle - triggers PUT signal
        ['2025-08-04T10:15:00.000Z', 24398, 24402, 24385, 24390], // PUT signal (Low = 24385 < 24390)
        
        // 4. After PUT signal - new normal candles
        ['2025-08-04T10:20:00.000Z', 24390, 24395, 24382, 24388],
        
        // 5. New Alert Candle after reset
        ['2025-08-04T10:25:00.000Z', 24405, 24420, 24410, 24415], // New Alert Candle if above EMA
    ];
    
    const EMA_PERIOD = 5;
    let alertCandle = null;
    let isWaitingForBreakdown = false;
    let stepCounter = 0;
    
    // Process each candle starting from after EMA period
    for (let i = EMA_PERIOD + 5; i < sampleCandles.length; i++) {
        stepCounter++;
        console.log(`\n🎯 STEP ${stepCounter}: Processing Candle ${i + 1}/${sampleCandles.length}`);
        console.log('='.repeat(60));
        
        // Get historical data for EMA calculation
        const historicalCandles = sampleCandles.slice(0, i + 1);
        const recentCandles = historicalCandles.slice(-(EMA_PERIOD + 10));
        
        // Calculate EMA
        const closePrices = recentCandles.slice(0, -1).map(candle => parseFloat(candle[4]));
        const emaValues = calculateEMA(closePrices, EMA_PERIOD);
        const currentEMA = emaValues[emaValues.length - 1];
        
        // Get current candle
        const [timestamp, open, high, low, close] = recentCandles[recentCandles.length - 1];
        const latestCandle = {
            timestamp: new Date(timestamp).toLocaleString('en-IN', { 
                timeZone: 'Asia/Kolkata',
                hour12: false,
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }),
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close)
        };
        
        console.log(`⏰ Time: ${latestCandle.timestamp}`);
        console.log(`📊 OHLC: ${latestCandle.open} | ${latestCandle.high} | ${latestCandle.low} | ${latestCandle.close}`);
        console.log(`📉 EMA(${EMA_PERIOD}): ${currentEMA.toFixed(2)}`);
        
        // Check for Alert Candle
        const isAlertCandle = latestCandle.open > currentEMA && 
                             latestCandle.high > currentEMA && 
                             latestCandle.low > currentEMA && 
                             latestCandle.close > currentEMA;
        
        console.log(`🔍 Above EMA Check: O:${latestCandle.open > currentEMA ? '✅' : '❌'} H:${latestCandle.high > currentEMA ? '✅' : '❌'} L:${latestCandle.low > currentEMA ? '✅' : '❌'} C:${latestCandle.close > currentEMA ? '✅' : '❌'}`);
        
        if (isAlertCandle) {
            if (alertCandle) {
                console.log('🔄 NEW ALERT CANDLE - Replacing previous one');
            } else {
                console.log('🚨 FIRST ALERT CANDLE DETECTED!');
            }
            
            alertCandle = {
                ...latestCandle,
                emaValue: currentEMA,
                lowToWatch: latestCandle.low
            };
            
            isWaitingForBreakdown = true;
            console.log(`🎯 Now watching for breakdown below: ${alertCandle.lowToWatch}`);
            await sendAlertCandleNotification(alertCandle);
            
        } else if (isWaitingForBreakdown && alertCandle) {
            console.log(`🔍 Monitoring breakdown: Current Low ${latestCandle.low} vs Alert Low ${alertCandle.lowToWatch}`);
            
            if (latestCandle.low < alertCandle.lowToWatch) {
                console.log('🔻 PUT SIGNAL TRIGGERED!');
                console.log(`💥 Breakdown: ${latestCandle.low} < ${alertCandle.lowToWatch} (${(alertCandle.lowToWatch - latestCandle.low).toFixed(2)} points)`);
                await sendPutSignalNotification(latestCandle, alertCandle);
                
                // Reset state
                isWaitingForBreakdown = false;
                alertCandle = null;
                console.log('🔄 Strategy state reset - ready for new Alert Candle');
            } else {
                console.log('⏳ No breakdown yet, continuing to monitor...');
            }
        } else {
            if (isWaitingForBreakdown) {
                console.log('📈 Current candle not above EMA but still monitoring existing Alert Candle');
            } else {
                console.log('📈 Normal candle - no alert conditions met');
            }
        }
        
        // Show current state
        if (isWaitingForBreakdown && alertCandle) {
            console.log(`📊 Current State: Monitoring Alert Candle (Low: ${alertCandle.lowToWatch})`);
        } else {
            console.log('📊 Current State: Waiting for new Alert Candle');
        }
        
        // Wait a moment for readability in test
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ COMPLETE TEST SCENARIO FINISHED!');
    console.log('='.repeat(60));
    console.log('\n📋 What we demonstrated:');
    console.log('   1. ✅ Alert Candle detection when ALL OHLC > EMA(5)');
    console.log('   2. ✅ Alert Candle replacement with newer ones');
    console.log('   3. ✅ PUT Signal when candle low breaks Alert Candle low');
    console.log('   4. ✅ Strategy reset after PUT signal is sent');
    console.log('   5. ✅ Ready to detect new Alert Candles after reset');
    console.log('\n🎯 Your bot is now configured correctly for the 5-minute strategy!');
};

// Run the complete test
runCompleteTestScenario().catch(console.error);
