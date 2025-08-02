require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.UPSTOX_ACCESS_TOKEN;

// Common instrument formats to test
const instrumentsToTest = [
    'NSE_INDEX|NIFTY 50',
    'NSE_INDEX|Nifty 50', 
    'NSE_INDEX|NIFTY50',
    'NSE_EQ|NIFTY',
    'NSE_FO|NIFTY24AUGFUT',
    'NSE_FO|NIFTY24SEPFUT',
    'NSE_FO|NIFYY24OCTFUT'
];

// Timeframes to test
const timeframesToTest = ['1minute', '5minute', '15minute', '30minute', '1day'];

const testInstrument = async (instrument, timeframe) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const encodedInstrument = encodeURIComponent(instrument);
        const url = `https://api.upstox.com/v2/historical-candle/${encodedInstrument}/${timeframe}/${today}/${today}`;
        
        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            timeout: 10000
        });

        if (response.data.status === 'success') {
            const candles = response.data.data.candles;
            return {
                success: true,
                candleCount: candles?.length || 0,
                instrument,
                timeframe
            };
        }
        
        return { success: false, instrument, timeframe, error: 'No success status' };
        
    } catch (error) {
        return { 
            success: false, 
            instrument, 
            timeframe, 
            error: error.response?.status || error.message 
        };
    }
};

const findValidInstruments = async () => {
    console.log('🔍 Testing different instrument keys and timeframes...\n');
    
    for (const instrument of instrumentsToTest) {
        console.log(`📊 Testing instrument: ${instrument}`);
        
        for (const timeframe of timeframesToTest) {
            const result = await testInstrument(instrument, timeframe);
            
            if (result.success) {
                console.log(`  ✅ ${timeframe}: ${result.candleCount} candles available`);
            } else {
                console.log(`  ❌ ${timeframe}: ${result.error}`);
            }
            
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(''); // Empty line between instruments
    }
    
    console.log('🎯 Look for instruments with ✅ status and sufficient candle data');
    console.log('💡 Use the working combination in your .env file');
};

// Run the test
findValidInstruments().catch(error => {
    console.error('❌ Test failed:', error.message);
});
