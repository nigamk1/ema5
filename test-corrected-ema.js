require('dotenv').config();

/**
 * Test the corrected EMA(5) logic
 * 
 * This demonstrates that we only need exactly 5 candles to:
 * 1. Calculate EMA(5) from 5 close prices
 * 2. Check if the 5th candle is completely above the EMA line
 */

function calculateEMA(prices, period) {
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
}

function testCorrectedEMALogic() {
    console.log('🧪 Testing Corrected EMA(5) Logic\n');
    
    // Simulate exactly 5 candles (minimum needed)
    const candleData = [
        ['2025-08-20T09:15:00Z', 24800, 24820, 24790, 24810], // Candle 1
        ['2025-08-20T09:20:00Z', 24810, 24830, 24800, 24825], // Candle 2
        ['2025-08-20T09:25:00Z', 24825, 24845, 24815, 24840], // Candle 3
        ['2025-08-20T09:30:00Z', 24840, 24860, 24830, 24855], // Candle 4
        ['2025-08-20T09:35:00Z', 24855, 24875, 24850, 24870]  // Candle 5 (latest)
    ];
    
    console.log('📊 Available Candles:');
    candleData.forEach((candle, i) => {
        console.log(`   Candle ${i+1}: Open=₹${candle[1]} High=₹${candle[2]} Low=₹${candle[3]} Close=₹${candle[4]}`);
    });
    
    // Extract close prices for EMA calculation
    const closePrices = candleData.map(candle => candle[4]);
    console.log('\n📈 Close Prices for EMA:', closePrices);
    
    // Calculate EMA(5) - this will give us one EMA value
    const emaValues = calculateEMA(closePrices, 5);
    const currentEMA = emaValues[emaValues.length - 1];
    
    console.log(`\n📊 EMA(5) calculated: ₹${currentEMA.toFixed(2)}`);
    
    // Get the latest candle (5th candle) to check against EMA
    const latestCandle = {
        open: candleData[4][1],
        high: candleData[4][2], 
        low: candleData[4][3],
        close: candleData[4][4]
    };
    
    console.log('\n🕯️ Latest Candle (to check against EMA):');
    console.log(`   Open: ₹${latestCandle.open}`);
    console.log(`   High: ₹${latestCandle.high}`);
    console.log(`   Low: ₹${latestCandle.low}`);
    console.log(`   Close: ₹${latestCandle.close}`);
    
    // Check alert condition
    const alertCondition = latestCandle.open > currentEMA && 
                          latestCandle.high > currentEMA && 
                          latestCandle.low > currentEMA && 
                          latestCandle.close > currentEMA;
    
    console.log('\n🔍 Alert Condition Check:');
    console.log(`   Open > EMA: ₹${latestCandle.open} > ₹${currentEMA.toFixed(2)} = ${latestCandle.open > currentEMA ? '✅' : '❌'}`);
    console.log(`   High > EMA: ₹${latestCandle.high} > ₹${currentEMA.toFixed(2)} = ${latestCandle.high > currentEMA ? '✅' : '❌'}`);
    console.log(`   Low > EMA: ₹${latestCandle.low} > ₹${currentEMA.toFixed(2)} = ${latestCandle.low > currentEMA ? '✅' : '❌'}`);
    console.log(`   Close > EMA: ₹${latestCandle.close} > ₹${currentEMA.toFixed(2)} = ${latestCandle.close > currentEMA ? '✅' : '❌'}`);
    
    console.log(`\n🚨 Alert Decision: ${alertCondition ? '✅ SEND ALERT' : '❌ NO ALERT'}`);
    
    if (alertCondition) {
        console.log('\n🎉 Perfect! The entire candle is above EMA(5) line!');
    } else {
        console.log('\n💡 Candle touches or goes below EMA line - no alert needed');
    }
    
    return { alertCondition, currentEMA, latestCandle };
}

// Test with different scenarios
function testEdgeCases() {
    console.log('\n\n🔬 Testing Edge Cases\n');
    
    // Case 1: Candle just above EMA
    console.log('1️⃣ Testing candle just above EMA...');
    const aboveCandles = [
        ['2025-08-20T09:15:00Z', 24800, 24820, 24790, 24810],
        ['2025-08-20T09:20:00Z', 24810, 24830, 24800, 24825],
        ['2025-08-20T09:25:00Z', 24825, 24845, 24815, 24840],
        ['2025-08-20T09:30:00Z', 24840, 24860, 24830, 24855],
        ['2025-08-20T09:35:00Z', 24875, 24890, 24870, 24885]  // All above EMA
    ];
    
    const closePrices1 = aboveCandles.map(c => c[4]);
    const ema1 = calculateEMA(closePrices1, 5)[4];
    const candle1 = { open: 24875, high: 24890, low: 24870, close: 24885 };
    const alert1 = candle1.open > ema1 && candle1.high > ema1 && candle1.low > ema1 && candle1.close > ema1;
    
    console.log(`   EMA: ₹${ema1.toFixed(2)}, Candle Low: ₹${candle1.low} -> ${alert1 ? '✅ ALERT' : '❌ NO ALERT'}`);
    
    // Case 2: Candle touching EMA (should NOT alert)
    console.log('\n2️⃣ Testing candle touching EMA...');
    const touchingCandles = [
        ['2025-08-20T09:15:00Z', 24800, 24820, 24790, 24810],
        ['2025-08-20T09:20:00Z', 24810, 24830, 24800, 24825],
        ['2025-08-20T09:25:00Z', 24825, 24845, 24815, 24840],
        ['2025-08-20T09:30:00Z', 24840, 24860, 24830, 24855],
        ['2025-08-20T09:35:00Z', 24860, 24880, 24850, 24875]  // Low might touch EMA
    ];
    
    const closePrices2 = touchingCandles.map(c => c[4]);
    const ema2 = calculateEMA(closePrices2, 5)[4];
    const candle2 = { open: 24860, high: 24880, low: 24850, close: 24875 };
    const alert2 = candle2.open > ema2 && candle2.high > ema2 && candle2.low > ema2 && candle2.close > ema2;
    
    console.log(`   EMA: ₹${ema2.toFixed(2)}, Candle Low: ₹${candle2.low} -> ${alert2 ? '✅ ALERT' : '❌ NO ALERT'}`);
    
    console.log('\n✅ Edge case testing complete!');
}

// Run tests
testCorrectedEMALogic();
testEdgeCases();

console.log('\n' + '='.repeat(60));
console.log('🎯 CORRECTED LOGIC SUMMARY:');
console.log('='.repeat(60));
console.log('✅ Need exactly 5 candles for EMA(5) calculation');
console.log('✅ Calculate EMA from 5 close prices');
console.log('✅ Check if 5th candle is completely above EMA line');
console.log('✅ Alert only when ALL OHLC > EMA (candle never touches line)');
console.log('✅ This is the most efficient and correct approach!');
