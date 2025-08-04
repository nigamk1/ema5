require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;
const INSTRUMENT_KEY = encodeURIComponent(process.env.INSTRUMENT_KEY || 'NSE_INDEX|NIFTY 50');

const testDifferentTimeframes = async () => {
    console.log('🔍 Testing different timeframes and dates...');
    
    const timeframes = ['1minute', '30minute', 'day'];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    
    const dates = [
        today.toISOString().split('T')[0],
        yesterday.toISOString().split('T')[0],
        dayBefore.toISOString().split('T')[0]
    ];
    
    for (const timeframe of timeframes) {
        for (const date of dates) {
            try {
                const url = `https://api.upstox.com/v2/historical-candle/${INSTRUMENT_KEY}/${timeframe}/${date}/${date}`;
                
                const response = await axios.get(url, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${ACCESS_TOKEN}`
                    },
                    timeout: 5000
                });

                const candles = response.data.data.candles;
                console.log(`✅ ${timeframe} ${date}: ${candles?.length || 0} candles`);
                
                if (candles && candles.length > 0) {
                    const latest = candles[0];
                    console.log(`   Latest: ${new Date(latest[0]).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} OHLC: ${latest[1]}/${latest[2]}/${latest[3]}/${latest[4]}`);
                }
                
                // If we found data, let's test EMA calculation
                if (candles && candles.length >= 6) {
                    console.log(`   ✅ Sufficient data for EMA(5) calculation!`);
                    return { timeframe, date, candles };
                }

            } catch (error) {
                console.log(`❌ ${timeframe} ${date}: ${error.response?.data?.message || error.message}`);
            }
        }
    }
    
    return null;
};

const main = async () => {
    const result = await testDifferentTimeframes();
    
    if (result) {
        console.log(`\n🎯 Recommended settings:`);
        console.log(`   TIMEFRAME=${result.timeframe}`);
        console.log(`   Data available: ${result.candles.length} candles`);
    } else {
        console.log('\n⚠️ No sufficient historical data found. This might be because:');
        console.log('1. Market is closed today (weekend/holiday)');
        console.log('2. Nifty 50 index data might not be available in real-time');
        console.log('3. Try using a different instrument like NSE_INDEX|NIFTY BANK');
    }
};

main();
