// Two-Stage EMA Strategy Example for Nifty 50
// This script demonstrates how the Alert Candle + PUT breakdown strategy works

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

// Example usage with sample Nifty 50 5-minute candle data
const sampleCandles = [
    // [timestamp, open, high, low, close] format
    ['2025-08-02T09:15:00.000Z', 24780.50, 24795.25, 24775.00, 24790.50], // Candle 1
    ['2025-08-02T09:20:00.000Z', 24790.75, 24805.50, 24785.25, 24800.25], // Candle 2
    ['2025-08-02T09:25:00.000Z', 24800.50, 24810.75, 24795.75, 24805.75], // Candle 3
    ['2025-08-02T09:30:00.000Z', 24806.00, 24825.50, 24801.25, 24820.00], // Candle 4
    ['2025-08-02T09:35:00.000Z', 24820.25, 24845.75, 24815.50, 24840.50], // Candle 5
    ['2025-08-02T09:40:00.000Z', 24841.00, 24865.25, 24835.50, 24855.25], // Candle 6 (Alert Candle)
    ['2025-08-02T09:45:00.000Z', 24855.50, 24870.00, 24850.25, 24862.75], // Candle 7 (monitoring)
    ['2025-08-02T09:50:00.000Z', 24863.00, 24875.50, 24830.00, 24832.50]  // Candle 8 (breakdown)
];

console.log('📊 Two-Stage EMA(5) Strategy Example for Nifty 50 (5-minute)\n');

// Stage 1: Identify Alert Candle
const closePricesForEMA = sampleCandles.slice(0, 5).map(candle => candle[4]); // First 5 closes
const emaValues = calculateEMA(closePricesForEMA, 5);
const currentEMA = emaValues[emaValues.length - 1];

console.log('📈 EMA Calculation:');
console.log('Close prices used for EMA:', closePricesForEMA);
console.log('EMA(5) value:', currentEMA.toFixed(2));

// Check 6th candle for Alert Candle condition
const alertCandleData = sampleCandles[5];
const [timestamp, open, high, low, close] = alertCandleData;
const alertCandle = { open, high, low, close };

console.log('\n🎯 Stage 1: Alert Candle Analysis');
console.log('Candidate Candle OHLC:', alertCandle);
console.log('EMA(5) Value:', currentEMA.toFixed(2));

// Check if all OHLC values are above EMA
const isAlertCandle = alertCandle.open > currentEMA && 
                     alertCandle.high > currentEMA && 
                     alertCandle.low > currentEMA && 
                     alertCandle.close > currentEMA;

console.log('\n✅ Alert Candle Validation:');
console.log('Open > EMA:', alertCandle.open > currentEMA, `(${alertCandle.open} > ${currentEMA.toFixed(2)})`);
console.log('High > EMA:', alertCandle.high > currentEMA, `(${alertCandle.high} > ${currentEMA.toFixed(2)})`);
console.log('Low > EMA:', alertCandle.low > currentEMA, `(${alertCandle.low} > ${currentEMA.toFixed(2)})`);
console.log('Close > EMA:', alertCandle.close > currentEMA, `(${alertCandle.close} > ${currentEMA.toFixed(2)})`);

if (isAlertCandle) {
    console.log('\n� STAGE 1 RESULT: ALERT CANDLE DETECTED!');
    console.log(`📍 Low to watch for breakdown: ${alertCandle.low}`);
    
    console.log('\n📱 Alert would be sent:');
    console.log('✅ ALERT CANDLE DETECTED');
    console.log('📈 Nifty 50 - 5MINUTE Chart');
    console.log(`📊 OHLC: ${alertCandle.open} | ${alertCandle.high} | ${alertCandle.low} | ${alertCandle.close}`);
    console.log(`📉 EMA(5): ${currentEMA.toFixed(2)}`);
    console.log(`🎯 Watching for breakdown below: ${alertCandle.low}`);
    console.log('💡 Strong bullish momentum detected!');
    console.log('🔻 Monitoring for PUT entry signal...');
    
    // Stage 2: Monitor subsequent candles for breakdown
    console.log('\n� Stage 2: Breakdown Monitoring');
    
    for (let i = 6; i < sampleCandles.length; i++) {
        const [ts, o, h, l, c] = sampleCandles[i];
        const monitorCandle = { timestamp: new Date(ts).toLocaleTimeString(), open: o, high: h, low: l, close: c };
        
        console.log(`\nCandle ${i + 1}: ${monitorCandle.timestamp}`);
        console.log(`OHLC: ${monitorCandle.open} | ${monitorCandle.high} | ${monitorCandle.low} | ${monitorCandle.close}`);
        console.log(`Low vs Alert Low: ${monitorCandle.low} vs ${alertCandle.low}`);
        
        if (monitorCandle.low < alertCandle.low) {
            console.log('\n🔻 STAGE 2 RESULT: PUT SIGNAL TRIGGERED!');
            console.log('📉 Nifty 50 broke below Alert Candle low');
            console.log(`💥 Entry Price: ${monitorCandle.low}`);
            console.log(`📍 Alert Candle Low: ${alertCandle.low}`);
            console.log('🎯 PUT Entry Opportunity Detected');
            
            console.log('\n📱 PUT Alert would be sent:');
            console.log('🔻 PUT SIGNAL TRIGGERED');
            console.log('📉 Nifty 50 Breakdown Alert');
            console.log(`🕐 Entry Time: ${monitorCandle.timestamp}`);
            console.log(`💥 Entry Price: ${monitorCandle.low}`);
            console.log(`📍 Alert Candle Low: ${alertCandle.low}`);
            console.log('🔻 Nifty 50 broke below Alert Candle low');
            console.log('🎯 PUT Entry Opportunity Detected');
            break;
        } else {
            console.log('✅ No breakdown yet - continuing to monitor');
        }
    }
    
} else {
    console.log('\n❌ STAGE 1 RESULT: Not an Alert Candle - condition not met');
}

console.log('\n📚 Strategy Summary:');
console.log('🎯 Stage 1: Alert Candle Detection');
console.log('  • Calculate EMA(5) using the previous 5 candle closes');
console.log('  • Check if current candle has ALL OHLC values above EMA(5)');
console.log('  • If yes, mark as Alert Candle and record its low');
console.log('  • Send Alert Candle notification');

console.log('\n🔻 Stage 2: PUT Entry Signal');
console.log('  • Monitor subsequent candles after Alert Candle detection');
console.log('  • Check if any candle breaks below the Alert Candle low');
console.log('  • If breakdown occurs, trigger PUT entry signal');
console.log('  • Send PUT signal notification');

console.log('\n🎛️ Strategy Rules:');
console.log('  • New Alert Candle replaces previous one if detected');
console.log('  • PUT signal resets the monitoring state');
console.log('  • Only operates during market hours (9:15 AM - 3:30 PM IST)');
console.log('  • Built-in cooldown prevents spam alerts');
console.log('  • Designed for 5-minute Nifty 50 index data');

console.log('\n⚠️ Risk Management:');
console.log('  • This is for educational purposes only');
console.log('  • Always use proper position sizing');
console.log('  • Consider stop losses and profit targets');
console.log('  • Backtest before using with real money');
console.log('  • Market conditions can change rapidly');
